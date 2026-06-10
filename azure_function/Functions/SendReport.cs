using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace EcoMonitorFunction.Functions;

/// <summary>
/// Function — Envío del informe por correo a través de Power Automate.
///
/// Trigger: HTTP POST → /api/send-report
///
/// Recibe del dashboard el PDF (base64) y los datos del formulario, y los reenvía
/// al flujo de Power Automate (su URL se guarda en local.settings.json como secreto).
/// El flujo se encarga de enviar el correo con el PDF adjunto y el enlace a Power BI.
///
/// Actúa como PROXY por dos motivos:
///   1. CORS: los disparadores HTTP de Power Automate no devuelven cabeceras CORS.
///   2. Seguridad: la URL del flujo lleva un token SAS que no debe exponerse en el navegador.
/// </summary>
public class SendReport
{
    private readonly ILogger<SendReport> _logger;
    private readonly IHttpClientFactory _httpFactory;
    private readonly string? _flowUrl;
    private readonly string? _powerBiUrl;

    public SendReport(ILogger<SendReport> logger, IHttpClientFactory httpFactory, IConfiguration config)
    {
        _logger = logger;
        _httpFactory = httpFactory;
        _flowUrl = config["PowerAutomateUrl"];
        _powerBiUrl = config["PowerBiPublicUrl"];
    }

    [Function("SendReport")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "send-report")]
        HttpRequest req)
    {
        _logger.LogInformation("=== SendReport iniciado ===");

        if (string.IsNullOrWhiteSpace(_flowUrl) || _flowUrl.Contains("REEMPLAZAR"))
        {
            _logger.LogError("PowerAutomateUrl no está configurada en local.settings.json.");
            return new ObjectResult(new { error = "El envío por correo no está configurado todavía (falta la URL del flujo de Power Automate)." })
            { StatusCode = 503 };
        }

        // 1 — Leer el cuerpo enviado por el dashboard
        using var reader = new StreamReader(req.Body);
        var body = await reader.ReadToEndAsync();

        SolicitudEnvio? datos;
        try
        {
            datos = JsonSerializer.Deserialize<SolicitudEnvio>(body,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch (JsonException)
        {
            return new BadRequestObjectResult(new { error = "Cuerpo JSON no válido." });
        }

        if (datos is null || string.IsNullOrWhiteSpace(datos.Email) || string.IsNullOrWhiteSpace(datos.PdfBase64))
            return new BadRequestObjectResult(new { error = "Faltan datos obligatorios (email y pdfBase64)." });

        // 2 — Construir el payload que espera el flujo de Power Automate
        var payload = new
        {
            email       = datos.Email,
            empresa     = datos.Empresa,
            responsable = datos.Responsable,
            telefono    = datos.Telefono,
            veredicto   = datos.Veredicto,
            fileName    = string.IsNullOrWhiteSpace(datos.FileName) ? "informe-huella-carbono.pdf" : datos.FileName,
            pdfBase64   = datos.PdfBase64,
            powerbiUrl  = _powerBiUrl ?? ""
        };

        // 3 — Reenviar al flujo
        try
        {
            var client = _httpFactory.CreateClient();
            var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            var resp = await client.PostAsync(_flowUrl, content);

            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogError("El flujo respondió {Code}.", (int)resp.StatusCode);
                return new ObjectResult(new { error = "El flujo de Power Automate devolvió un error." })
                { StatusCode = 502 };
            }

            _logger.LogInformation("Informe enviado a {Email} (empresa: {Empresa}).", datos.Email, datos.Empresa);
            return new OkObjectResult(new { ok = true, mensaje = $"Informe enviado a {datos.Email}." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al contactar con el flujo de Power Automate.");
            return new ObjectResult(new { error = "No se pudo contactar con el servicio de envío." })
            { StatusCode = 502 };
        }
    }

    /// <summary>Cuerpo que envía el dashboard.</summary>
    private sealed class SolicitudEnvio
    {
        public string Email { get; set; } = string.Empty;
        public string Empresa { get; set; } = string.Empty;
        public string Responsable { get; set; } = string.Empty;
        public string Telefono { get; set; } = string.Empty;
        public string Veredicto { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public string PdfBase64 { get; set; } = string.Empty;
    }
}
