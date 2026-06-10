using System.ClientModel;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using EcoMonitorFunction.Infrastructure;
using EcoMonitorFunction.Models;
using EcoMonitorFunction.Services;

namespace EcoMonitorFunction.Functions;

/// <summary>
/// Function 2 — Análisis de huella de carbono con IA.
///
/// Trigger: HTTP GET/POST  →  /api/analyze
///
/// Parámetros opcionales (query string o JSON body):
///   desde   → fecha inicio ISO-8601  (default: hoy a las 00:00)
///   hasta   → fecha fin ISO-8601     (default: ahora)
///   deviceId → filtrar por dispositivo (default: todos)
///   source   → "sim" | "real"        (default: todos)
///
/// Flujo:
///   1. Consultar Cosmos DB → obtener lecturas del período.
///   2. Calcular totales: kWh, kg CO2, desglose por dispositivo.
///   3. AI Search → recuperar fragmentos del PDF MITECO (RAG).
///   4. Azure OpenAI GPT-4o → generar análisis y veredicto de cumplimiento.
///   5. Devolver JSON con resumen + análisis IA.
///
/// Ejemplo de llamada:
///   GET http://localhost:7071/api/analyze
///   GET http://localhost:7071/api/analyze?desde=2026-05-29T00:00:00Z&hasta=2026-05-29T23:59:59Z
/// </summary>
public class CarbonFootprintAnalyzer
{
    private readonly ILogger<CarbonFootprintAnalyzer> _logger;
    private readonly CosmosQueryService _cosmosService;
    private readonly AiAnalysisService  _aiService;

    public CarbonFootprintAnalyzer(
        ILogger<CarbonFootprintAnalyzer> logger,
        CosmosQueryService cosmosService,
        AiAnalysisService aiService)
    {
        _logger        = logger;
        _cosmosService = cosmosService;
        _aiService     = aiService;
    }

    [Function("CarbonFootprintAnalyzer")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Function, "get", "post", Route = "analyze")]
        HttpRequest req)
    {
        _logger.LogInformation("=== CarbonFootprintAnalyzer iniciado ===");

        // 1 — Parsear parámetros de fecha
        var desdeStr  = req.Query["desde"].FirstOrDefault();
        var hastaStr  = req.Query["hasta"].FirstOrDefault();
        var deviceId  = req.Query["deviceId"].FirstOrDefault();
        var source    = req.Query["source"].FirstOrDefault();   // "sim" | "real" | null

        // Por defecto, el informe cubre SOLO el día actual (desde las 00:00 de hoy).
        var desde = desdeStr  is not null ? DateTime.Parse(desdeStr).ToUniversalTime()
                                          : DateTime.Today.ToUniversalTime();
        var hasta = hastaStr  is not null ? DateTime.Parse(hastaStr).ToUniversalTime()
                                          : DateTime.UtcNow;

        if (desde >= hasta)
            return new BadRequestObjectResult(new { error = "La fecha 'desde' debe ser anterior a 'hasta'." });

        _logger.LogInformation("Período: {Desde} → {Hasta}", desde, hasta);

        // 2 — Obtener lecturas de Cosmos DB
        var lecturas = await _cosmosService.GetLecturasAsync(desde, hasta);

        if (!string.IsNullOrEmpty(deviceId))
            lecturas = lecturas.Where(l => l.DeviceId == deviceId).ToList();

        // Filtrar por origen (sim/real) si se indica
        if (!string.IsNullOrWhiteSpace(source))
            lecturas = lecturas.Where(l => DeviceSourceHelper.MatchesSource(l.DeviceId, source)).ToList();

        if (lecturas.Count == 0)
        {
            return new OkObjectResult(new
            {
                mensaje = "No se encontraron lecturas en el período indicado.",
                desde   = desde.ToString("o"),
                hasta   = hasta.ToString("o"),
                source  = source ?? "todos"
            });
        }

        // 3 — Calcular resumen
        var resumen = CalcularResumen(lecturas);

        // 4 — Análisis IA (AI Search + OpenAI)
        string analisis;
        string veredicto;
        try
        {
            (analisis, veredicto) = await _aiService.AnalizarCumplimientoAsync(
                resumen,
                desde.ToString("o"),
                hasta.ToString("o"));
        }
        catch (ClientResultException ex) when (ex.Status == 429)
        {
            _logger.LogWarning("Azure OpenAI saturado (429) tras los reintentos.");
            return new ObjectResult(new
            {
                error = "El servicio de IA está saturado (límite de Azure OpenAI por minuto). " +
                        "Espera un minuto y vuelve a intentarlo."
            })
            { StatusCode = 503 };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error inesperado al generar el análisis con IA.");
            return new ObjectResult(new
            {
                error = "No se pudo generar el análisis con IA. Revisa la configuración de Azure OpenAI."
            })
            { StatusCode = 502 };
        }

        // 5 — Construir y devolver resultado
        var resultado = new AnalysisResult
        {
            Periodo = new PeriodoInfo
            {
                Desde = desde.ToString("o"),
                Hasta = hasta.ToString("o"),
                Horas = Math.Round((hasta - desde).TotalHours, 2)
            },
            Resumen         = resumen,
            AnalisisIa      = analisis,
            Veredicto       = veredicto,
            TimestampAnalisis = DateTime.UtcNow
        };

        _logger.LogInformation(
            "Análisis completado: {TotalCo2:F6} kg CO2 | Veredicto: {Veredicto}",
            resumen.TotalCo2Kg, veredicto);

        return new OkObjectResult(resultado);
    }

    // -----------------------------------------------------------------
    // Cálculo del resumen de lecturas
    // -----------------------------------------------------------------
    private static ResumenLecturas CalcularResumen(List<LecturaDocument> lecturas)
    {
        var co2PorDispositivo  = new Dictionary<string, double>();
        var kwhPorDispositivo  = new Dictionary<string, double>();

        foreach (var l in lecturas)
        {
            var nombre = l.DisplayName ?? l.DeviceId;
            co2PorDispositivo[nombre]  = co2PorDispositivo.GetValueOrDefault(nombre) + l.Co2Kg;
            kwhPorDispositivo[nombre]  = kwhPorDispositivo.GetValueOrDefault(nombre) + l.ConsumoKwh;
        }

        return new ResumenLecturas
        {
            TotalLecturas       = lecturas.Count,
            TotalKwh            = Math.Round(lecturas.Sum(l => l.ConsumoKwh), 8),
            TotalCo2Kg          = Math.Round(lecturas.Sum(l => l.Co2Kg), 8),
            Co2PorDispositivo   = co2PorDispositivo.ToDictionary(k => k.Key, v => Math.Round(v.Value, 8)),
            KwhPorDispositivo   = kwhPorDispositivo.ToDictionary(k => k.Key, v => Math.Round(v.Value, 8)),
            FactorEmisionUsado  = lecturas.Select(l => l.FactorUsado).FirstOrDefault(),
            NumDispositivos     = co2PorDispositivo.Count
        };
    }
}
