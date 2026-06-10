using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Logging;
using EcoMonitorFunction.Infrastructure;
using EcoMonitorFunction.Models;

namespace EcoMonitorFunction.Services;

/// <summary>
/// Consulta la colección "lecturas" de Cosmos DB para obtener
/// los registros de consumo en un rango de fechas.
/// Usado por CarbonFootprintAnalyzer (Function 2).
/// </summary>
public class CosmosQueryService
{
    private readonly Container _container;
    private readonly ILogger<CosmosQueryService> _logger;

    private const string DatabaseName  = "ecomonitor-db";
    private const string ContainerName = "lecturas";

    public CosmosQueryService(CosmosClient cosmosClient, ILogger<CosmosQueryService> logger)
    {
        _container = cosmosClient.GetContainer(DatabaseName, ContainerName);
        _logger    = logger;
    }

    /// <summary>
    /// Devuelve todos los documentos de lecturas entre dos fechas (UTC).
    /// Si no se pasan fechas, devuelve las últimas 24 horas.
    /// </summary>
    public async Task<List<LecturaDocument>> GetLecturasAsync(
        DateTime? desde = null,
        DateTime? hasta = null)
    {
        var desdeUtc = (desde ?? DateTime.UtcNow.AddHours(-24)).ToUniversalTime();
        var hastaUtc = (hasta ?? DateTime.UtcNow).ToUniversalTime();

        _logger.LogInformation(
            "Consultando lecturas de Cosmos DB: {Desde} → {Hasta}", desdeUtc, hastaUtc);

        // Traemos las lecturas y filtramos por fecha EN MEMORIA comparando en UTC real.
        // (No se filtra por texto en la query porque los timestamps almacenados pueden tener
        //  distinta zona horaria y la comparación lexicográfica de Cosmos sería incorrecta.)
        var query = new QueryDefinition(
            "SELECT c.deviceId, c.displayName, c.consumo_kwh, c.co2_kg, " +
            "c.timestamp, c.zona, c.factor_usado, c.potencia_w FROM c");

        var todas = new List<LecturaDocument>();

        using var iterator = _container.GetItemQueryIterator<LecturaDocument>(
            query,
            requestOptions: new QueryRequestOptions { MaxConcurrency = -1 });

        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync();
            todas.AddRange(page);
        }

        var lecturas = todas
            .Where(l =>
            {
                var t = l.Timestamp.ToUniversalTime();
                return t >= desdeUtc && t <= hastaUtc;
            })
            .OrderBy(l => l.Timestamp.ToUniversalTime())
            .ToList();

        _logger.LogInformation(
            "Lecturas totales en Cosmos: {Todas} · dentro del período: {Count}",
            todas.Count, lecturas.Count);

        return lecturas;
    }

    /// <summary>
    /// Segundos sin enviar datos tras los cuales un equipo se considera desconectado.
    /// Se usan 180s (3 min) porque el IoT Hub entrega los mensajes al trigger en lotes
    /// ("ráfagas") y la lectura más reciente en Cosmos puede tener 1-3 min de antigüedad
    /// aunque el equipo siga enviando cada 30s.
    /// </summary>
    private const int VentanaActivaSegundos = 180;

    /// <summary>
    /// Devuelve los dispositivos que están ACTIVOS ahora mismo (han enviado datos en los
    /// últimos 3 minutos), pero con el número de lecturas acumuladas durante TODO el día actual.
    /// Si 'source' es "sim" o "real", filtra por ese origen.
    /// </summary>
    public async Task<List<DeviceStatusDto>> GetActiveDevicesAsync(string? source = null)
    {
        var inicioDia    = DateTime.Today.ToUniversalTime();           // 00:00 de hoy (hora local) en UTC
        var ahora        = DateTime.UtcNow;
        var umbralActivo = ahora.AddSeconds(-VentanaActivaSegundos);

        // Todas las lecturas del día actual
        var lecturasDia = await GetLecturasAsync(inicioDia, ahora);

        var dispositivos = lecturasDia
            .Where(l => DeviceSourceHelper.MatchesSource(l.DeviceId, source))
            .GroupBy(l => l.DeviceId)
            .Select(g => new DeviceStatusDto
            {
                DeviceId    = g.Key,
                DisplayName = g.Select(x => x.DisplayName).FirstOrDefault(d => !string.IsNullOrEmpty(d)) ?? g.Key,
                Source      = DeviceSourceHelper.Classify(g.Key),
                // Normalizamos a UTC ANTES del Max: las lecturas pueden tener distinta zona
                // horaria y Max() compara el valor de reloj ignorando el Kind, lo que elegiría
                // mal la "última" actividad.
                LastSeen    = g.Max(x => x.Timestamp.ToUniversalTime()),
                Lecturas    = g.Count()   // total acumulado del día
            })
            // Solo los que siguen activos (han enviado en los últimos 3 min)
            .Where(d => d.LastSeen >= umbralActivo)
            .OrderBy(d => d.DisplayName)
            .ToList();

        _logger.LogInformation(
            "Dispositivos activos (ventana {Seg}s, source={Source}): {Count}",
            VentanaActivaSegundos, source ?? "todos", dispositivos.Count);

        return dispositivos;
    }

    /// <summary>
    /// Reemplaza por completo las lecturas de un dispositivo de escenario:
    /// borra las que hubiera y guarda el lote nuevo. Así cada prueba de demostración
    /// parte de un conjunto de datos limpio y los totales son estables.
    /// </summary>
    public async Task<int> ReplaceScenarioReadingsAsync(string deviceId, IReadOnlyList<LecturaDocument> nuevas)
    {
        var pk = new PartitionKey(deviceId);

        // 1 — Borrar las lecturas existentes de ese dispositivo
        var query = new QueryDefinition("SELECT c.id FROM c WHERE c.deviceId = @id")
            .WithParameter("@id", deviceId);

        var ids = new List<string>();
        using (var it = _container.GetItemQueryIterator<IdOnly>(
                   query, requestOptions: new QueryRequestOptions { PartitionKey = pk }))
        {
            while (it.HasMoreResults)
            {
                foreach (var item in await it.ReadNextAsync())
                    ids.Add(item.Id);
            }
        }

        foreach (var id in ids)
            await _container.DeleteItemAsync<LecturaDocument>(id, pk);

        // 2 — Insertar el lote nuevo
        foreach (var doc in nuevas)
            await _container.CreateItemAsync(doc, new PartitionKey(doc.DeviceId));

        _logger.LogInformation(
            "Escenario {Device}: borradas {Borradas}, insertadas {Insertadas}.",
            deviceId, ids.Count, nuevas.Count);

        return nuevas.Count;
    }

    /// <summary>Proyección mínima para leer solo el id en el borrado.</summary>
    private sealed class IdOnly
    {
        [System.Text.Json.Serialization.JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;
    }
}
