using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using EcoMonitorFunction.Services;

namespace EcoMonitorFunction.Functions;

/// <summary>
/// Función auxiliar — Lista de dispositivos activos.
///
/// Trigger: HTTP GET  →  /api/devices
///
/// Parámetros opcionales (query string):
///   source   → "sim" (Python) o "real" (Node). Por defecto: todos.
///
/// Devuelve los equipos ACTIVOS (han enviado en los últimos 90 s), con el nº de lecturas
/// acumuladas durante todo el día actual, para que el dashboard muestre qué equipos están
/// "conectados" en cada sección.
/// </summary>
public class DeviceStatus
{
    private readonly ILogger<DeviceStatus> _logger;
    private readonly CosmosQueryService _cosmosService;

    public DeviceStatus(ILogger<DeviceStatus> logger, CosmosQueryService cosmosService)
    {
        _logger        = logger;
        _cosmosService = cosmosService;
    }

    [Function("DeviceStatus")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Function, "get", Route = "devices")]
        HttpRequest req)
    {
        var source = req.Query["source"].FirstOrDefault();

        _logger.LogInformation("=== DeviceStatus (source={Source}) ===", source ?? "todos");

        var dispositivos = await _cosmosService.GetActiveDevicesAsync(source);

        return new OkObjectResult(dispositivos);
    }
}
