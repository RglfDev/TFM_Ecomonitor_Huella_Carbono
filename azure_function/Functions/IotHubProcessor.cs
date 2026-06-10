using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using EcoMonitorFunction.Models;
using EcoMonitorFunction.Services;

namespace EcoMonitorFunction.Functions;

/// <summary>
/// Azure Function que procesa los mensajes del IoT Hub (PC simulados).
///
/// Trigger:  EventHub compatible con IoT Hub — se ejecuta automáticamente
///           cada vez que llega un mensaje de pc-sim-001 o pc-sim-002.
///
/// Flujo por mensaje:
///   1. Deserializar JSON del simulador Python.
///   2. Consultar Azure SQL → factor de emisión MITECO del año actual.
///   3. Calcular huella de carbono: co2_kg = consumo_kwh × factor.
///   4. Guardar documento enriquecido en Cosmos DB (colección "lecturas").
/// </summary>
public class IotHubProcessor
{
    private readonly ILogger<IotHubProcessor> _logger;
    private readonly EmisionFactorService _emisionService;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public IotHubProcessor(ILogger<IotHubProcessor> logger, EmisionFactorService emisionService)
    {
        _logger = logger;
        _emisionService = emisionService;
    }

    [Function("IotHubProcessor")]
    [CosmosDBOutput("ecomonitor-db", "lecturas", Connection = "CosmosDBConnection",
        CreateIfNotExists = true, PartitionKey = "/deviceId")]
    public async Task<LecturaDocument[]?> Run(
        [EventHubTrigger("%IoTHubEventHubName%", Connection = "IoTHubConnection")]
        string[] messages,
        FunctionContext context)
    {
        _logger.LogInformation(
            "=== IotHubProcessor — lote de {Count} mensaje(s) recibido ===", messages.Length);

        var resultados = new List<LecturaDocument>(messages.Length);

        foreach (var message in messages)
        {
            try
            {
                // 1 — Deserializar
                var iotMsg = JsonSerializer.Deserialize<IotMessage>(message, JsonOpts);
                if (iotMsg is null)
                {
                    _logger.LogWarning("Mensaje no deserializable, ignorado: {Raw}", message);
                    continue;
                }

                // 2 — Obtener factor de emisión del año del mensaje
                var anio = iotMsg.Timestamp == default
                    ? DateTime.UtcNow.Year
                    : iotMsg.Timestamp.Year;

                var factor = await _emisionService.GetFactorAsync(anio);

                // 3 — Calcular huella de carbono
                var co2Kg = Math.Round((double)((decimal)iotMsg.ConsumoKwh * factor), 8);

                // 4 — Construir documento para Cosmos DB
                var lectura = new LecturaDocument
                {
                    Id          = Guid.NewGuid().ToString(),
                    DeviceId    = iotMsg.DeviceId,
                    DisplayName = iotMsg.DisplayName,
                    Timestamp   = (iotMsg.Timestamp == default ? DateTime.UtcNow : iotMsg.Timestamp).ToUniversalTime(),
                    ConsumoKwh  = iotMsg.ConsumoKwh,
                    PotenciaW   = iotMsg.PotenciaW,
                    Co2Kg       = co2Kg,
                    FactorUsado = (double)factor,
                    AnioFactor  = anio,
                    Zona        = iotMsg.Zona,
                    IntervaloS  = iotMsg.IntervaloS
                };

                resultados.Add(lectura);

                _logger.LogInformation(
                    "[{DeviceId}] {ConsumoKwh:F6} kWh  →  {Co2Kg:F8} kg CO2  |  factor {Factor} ({Anio})",
                    lectura.DeviceId, lectura.ConsumoKwh, lectura.Co2Kg, lectura.FactorUsado, anio);
            }
            catch (JsonException jex)
            {
                _logger.LogError(jex, "Error deserializando JSON: {Raw}", message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error inesperado procesando mensaje.");
            }
        }

        // Devolver null si no hay resultados válidos (evita escrituras vacías en Cosmos DB)
        return resultados.Count > 0 ? resultados.ToArray() : null;
    }
}
