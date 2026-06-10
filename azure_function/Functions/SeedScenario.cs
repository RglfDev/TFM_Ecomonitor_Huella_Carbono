using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using EcoMonitorFunction.Models;
using EcoMonitorFunction.Services;

namespace EcoMonitorFunction.Functions;

/// <summary>
/// Función de DEMOSTRACIÓN — Genera un lote de lecturas para un escenario y lo guarda en Cosmos.
///
/// Trigger: HTTP GET/POST  →  /api/seed?scenario=ok|ko
///
///   scenario=ok  → dispositivo "pc-esc-ok-001" con consumo eficiente  → informe CUMPLE
///   scenario=ko  → dispositivo "pc-esc-ko-001" con consumo desmesurado → informe NO CUMPLE
///
/// Los datos quedan aislados por prefijo de deviceId, así que NUNCA se cruzan con la
/// simulación normal (pc-sim-*) ni con los datos reales (pc-real-*).
/// Cada llamada reemplaza el lote anterior del escenario (totales estables).
/// </summary>
public class SeedScenario
{
    private readonly ILogger<SeedScenario> _logger;
    private readonly CosmosQueryService _cosmos;

    // Factor de emisión MITECO (coherente con el resto del sistema)
    private const double FactorEmision = 0.179;
    // Nº de lecturas del lote (60 > 50 → pasa la regla "muestra suficiente" del prompt IA)
    // y duración representada por cada una (15 min → cabe ~15h del día actual).
    private const int NumLecturas = 60;
    private const int IntervaloSegundos = 900;

    public SeedScenario(ILogger<SeedScenario> logger, CosmosQueryService cosmos)
    {
        _logger = logger;
        _cosmos = cosmos;
    }

    // Para evitar que la IA considere la muestra "insuficiente por número de equipos",
    // cada escenario simula una oficina con varios dispositivos reales.
    private const int NumDevicesPorEscenario = 3;

    [Function("SeedScenario")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Function, "get", "post", Route = "seed")]
        HttpRequest req)
    {
        var scenario = (req.Query["scenario"].FirstOrDefault() ?? "").Trim().ToLowerInvariant();

        // Rangos de potencia (W) muy alejados de los umbrales, con margen amplio:
        //   Favorable    -> ~0,08 kg CO2/equipo (claramente < 0,30 → CUMPLE rotundo)
        //   Desfavorable -> ~18  kg CO2/equipo (claramente > 1,00 → NO CUMPLE rotundo)
        (string nombreBase, int minW, int maxW, int seedBase, string zona) perfil = scenario switch
        {
            "ok" => ("Oficina eficiente",       20,   40, 4242, "Oficina-eficiente"),
            "ko" => ("Nave ineficiente",      6000, 8000, 1729, "Nave-ineficiente"),
            _    => default
        };

        if (perfil.nombreBase is null)
            return new BadRequestObjectResult(new { error = "Parámetro 'scenario' debe ser 'ok' o 'ko'." });

        _logger.LogInformation(
            "=== SeedScenario ({Scenario}, {N} dispositivos) ===",
            scenario, NumDevicesPorEscenario);

        var ahora = DateTime.UtcNow;
        var totalLecturas = 0;
        var totalKwh = 0.0;
        var totalCo2 = 0.0;

        // Genera N dispositivos por escenario. Cada uno con su propia semilla determinista
        // para que las potencias varíen ligeramente entre equipos (más realista) pero
        // los valores sean reproducibles en cada llamada.
        for (var d = 0; d < NumDevicesPorEscenario; d++)
        {
            var deviceId    = $"pc-esc-{scenario}-{d + 1:D3}";
            var displayName = $"{perfil.nombreBase} {d + 1}";
            var rnd = new Random(perfil.seedBase + d);
            var lecturas = new List<LecturaDocument>(NumLecturas);

            for (var i = 0; i < NumLecturas; i++)
            {
                var potenciaW = rnd.Next(perfil.minW, perfil.maxW + 1) + rnd.NextDouble();
                var kwh = potenciaW * IntervaloSegundos / (1000.0 * 3600.0);
                var co2 = kwh * FactorEmision;

                // Timestamps espaciados 90s, todos dentro del día actual
                var ts = ahora.AddSeconds(-(NumLecturas - i) * 90);

                lecturas.Add(new LecturaDocument
                {
                    Id          = Guid.NewGuid().ToString(),
                    DeviceId    = deviceId,
                    DisplayName = displayName,
                    Timestamp   = ts,
                    ConsumoKwh  = Math.Round(kwh, 6),
                    PotenciaW   = Math.Round(potenciaW, 2),
                    Co2Kg       = Math.Round(co2, 8),
                    FactorUsado = FactorEmision,
                    AnioFactor  = ts.Year,
                    Zona        = perfil.zona,
                    IntervaloS  = IntervaloSegundos
                });
            }

            await _cosmos.ReplaceScenarioReadingsAsync(deviceId, lecturas);

            totalLecturas += lecturas.Count;
            totalKwh      += lecturas.Sum(l => l.ConsumoKwh);
            totalCo2      += lecturas.Sum(l => l.Co2Kg);
        }

        _logger.LogInformation(
            "Escenario {Scenario}: {N} lecturas en {D} dispositivos · {Kwh:F3} kWh · {Co2:F3} kg CO2",
            scenario, totalLecturas, NumDevicesPorEscenario, totalKwh, totalCo2);

        return new OkObjectResult(new
        {
            scenario,
            dispositivos = NumDevicesPorEscenario,
            generadas    = totalLecturas,
            total_kwh    = Math.Round(totalKwh, 6),
            total_co2    = Math.Round(totalCo2, 6)
        });
    }
}
