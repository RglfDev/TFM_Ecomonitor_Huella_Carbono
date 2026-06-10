using System.ClientModel;
using Azure;
using Azure.AI.OpenAI;
using Azure.Search.Documents;
using Azure.Search.Documents.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using OpenAI.Chat;
using EcoMonitorFunction.Models;

namespace EcoMonitorFunction.Services;

/// <summary>
/// Orquesta el análisis de huella de carbono usando IA:
///   1. Recupera fragmentos relevantes del PDF MITECO desde Azure AI Search (RAG).
///   2. Construye un prompt estructurado con los datos de consumo y el contexto del PDF.
///   3. Llama a Azure OpenAI GPT-4o para generar el análisis y veredicto de cumplimiento.
/// </summary>
public class AiAnalysisService
{
    private readonly SearchClient _searchClient;
    private readonly ChatClient   _chatClient;
    private readonly ILogger<AiAnalysisService> _logger;

    private readonly string _indexName;

    public AiAnalysisService(IConfiguration config, ILogger<AiAnalysisService> logger)
    {
        _logger = logger;

        // Azure AI Search
        var searchEndpoint = config["AiSearchEndpoint"]
            ?? throw new InvalidOperationException("AiSearchEndpoint no configurado.");
        var searchKey = config["AiSearchKey"]
            ?? throw new InvalidOperationException("AiSearchKey no configurado.");
        _indexName = config["AiSearchIndexName"] ?? "normativa-index";

        _searchClient = new SearchClient(
            new Uri(searchEndpoint),
            _indexName,
            new AzureKeyCredential(searchKey));

        // Azure OpenAI
        var openAiEndpoint   = config["OpenAiEndpoint"]
            ?? throw new InvalidOperationException("OpenAiEndpoint no configurado.");
        var openAiKey        = config["OpenAiKey"]
            ?? throw new InvalidOperationException("OpenAiKey no configurado.");
        var deploymentChat   = config["OpenAiDeploymentChat"] ?? "gpt-4o-ecomonitor";

        var openAiClient = new AzureOpenAIClient(
            new Uri(openAiEndpoint),
            new AzureKeyCredential(openAiKey));

        _chatClient = openAiClient.GetChatClient(deploymentChat);
    }

    /// <summary>
    /// Genera el análisis completo de cumplimiento para los datos de consumo proporcionados.
    /// Devuelve el texto del análisis y el veredicto (CUMPLE / NECESITA MEJORA / NO CUMPLE).
    /// </summary>
    public async Task<(string analisis, string veredicto)> AnalizarCumplimientoAsync(
        ResumenLecturas resumen,
        string desde,
        string hasta)
    {
        // 1 — Obtener contexto del PDF desde AI Search
        var contextoPdf = await BuscarContextoMitecoAsync();

        // 2 — Construir detalle por dispositivo
        var detalle = string.Join("\n", resumen.Co2PorDispositivo.Select(kv =>
            $"  - {kv.Key}: {kv.Value:F6} kg CO2  ({resumen.KwhPorDispositivo.GetValueOrDefault(kv.Key):F6} kWh)"));

        // 3 — Construir prompt
        var userPrompt = $"""
            Analiza los siguientes datos de consumo eléctrico de una oficina y determina
            si cumple con las buenas prácticas según la Guía de Huella de Carbono del MITECO.

            === DATOS REGISTRADOS ===
            Período analizado: {desde} a {hasta} ({resumen.TotalLecturas} lecturas en {resumen.NumDispositivos} dispositivos)
            Consumo total: {resumen.TotalKwh:F6} kWh
            Huella de carbono total: {resumen.TotalCo2Kg:F6} kg CO2
            Factor de emisión MITECO usado: {resumen.FactorEmisionUsado} kg CO2/kWh

            Detalle por dispositivo (PCs de oficina):
            {detalle}

            === FRAGMENTOS DE LA GUÍA MITECO ===
            {contextoPdf}

            === CÁLCULO DEL INDICADOR ===
            Calcula el indicador clave dividiendo la HUELLA TOTAL del período registrado
            entre el NÚMERO de dispositivos:

                Indicador = huella_total / num_dispositivos    (en kg CO2 por equipo)

            IMPORTANTE: USA EL DATO TAL CUAL, NO lo extrapoles a 24 horas ni a otro
            período. El veredicto se basa en el valor observado en la muestra registrada.

            === REFERENCIA ORIENTATIVA (buenas prácticas) ===
            Compara el indicador con estos umbrales (referencia MITECO para una
            jornada típica de oficina):
              - Indicador <= 0,30 kg CO2 por equipo → CUMPLE
              - Indicador entre 0,30 y 1,00         → NECESITA MEJORA
              - Indicador > 1,00                    → NO CUMPLE

            NO consideres la muestra insuficiente por el simple hecho de tener pocos
            dispositivos: una oficina puede operar con 1 o 2 PCs y ser certificable.

            === REGLA DE MUESTRA INSUFICIENTE ===
            La muestra es INSUFICIENTE para certificar (típico de un sistema recién
            arrancado, no de una jornada de trabajo) cuando se cumple CUALQUIERA de:
              - Menos de 100 lecturas en total, o
              - Consumo total menor a 0,5 kWh, o
              - Huella total menor a 0,10 kg CO2.

            Si la muestra es insuficiente:
              1. Indícalo claramente en el análisis ("muestra insuficiente para
                 certificar; datos preliminares, se necesita un período más amplio").
              2. NO emitas CUMPLE aunque los valores sean bajos; usa siempre
                 VEREDICTO: NECESITA MEJORA en este caso.

            === ANÁLISIS SOLICITADO ===
            1. ¿A qué Alcance (1, 2 o 3) corresponde este consumo según la metodología MITECO?
            2. Valoración del nivel de consumo registrado para una oficina (incluye el cálculo de
               kg CO2 por equipo y día e indica si la muestra es representativa o insuficiente).
            3. ¿Cumple con las buenas prácticas descritas en la guía? Si la muestra es insuficiente,
               no afirmes que cumple; indica que se necesitan más datos.
            4. Proporciona exactamente 3 recomendaciones específicas para reducir la huella.
            5. En la última línea escribe SOLO el veredicto en este formato exacto:
               VEREDICTO: CUMPLE  o  VEREDICTO: NECESITA MEJORA  o  VEREDICTO: NO CUMPLE
            """;

        var messages = new List<ChatMessage>
        {
            new SystemChatMessage(
                "Eres un experto en sostenibilidad y huella de carbono para organizaciones españolas. " +
                "Analizas datos de consumo eléctrico de oficinas según la metodología oficial del MITECO. " +
                "Respondes siempre en español, de forma clara, estructurada y con criterio técnico. " +
                "Cuando no tienes suficiente contexto del PDF, indícalo y basa tu análisis en la metodología MITECO estándar."),
            new UserChatMessage(userPrompt)
        };

        _logger.LogInformation("Llamando a Azure OpenAI para análisis de cumplimiento...");

        var textoCompleto = await CompletarConReintentosAsync(messages);

        // 4 — Extraer veredicto de la última línea
        var veredicto = ExtraerVeredicto(textoCompleto);

        _logger.LogInformation("Análisis completado. Veredicto: {Veredicto}", veredicto);
        return (textoCompleto, veredicto);
    }

    /// <summary>
    /// Llama a GPT-4o con reintentos y backoff exponencial ante el error 429
    /// (too_many_requests), típico al superar la cuota de tokens/min del deployment.
    /// </summary>
    private async Task<string> CompletarConReintentosAsync(List<ChatMessage> messages, int maxIntentos = 4)
    {
        var espera = TimeSpan.FromSeconds(5);

        for (var intento = 1; ; intento++)
        {
            try
            {
                ChatCompletion completion = await _chatClient.CompleteChatAsync(messages);
                return completion.Content[0].Text;
            }
            catch (ClientResultException ex) when (ex.Status == 429 && intento < maxIntentos)
            {
                _logger.LogWarning(
                    "Azure OpenAI devolvió 429 (intento {Intento}/{Max}). Reintentando en {Seg}s…",
                    intento, maxIntentos, espera.TotalSeconds);
                await Task.Delay(espera);
                espera += espera; // backoff: 5s → 10s → 20s
            }
        }
    }

    // -----------------------------------------------------------------
    // Métodos privados
    // -----------------------------------------------------------------

    private async Task<string> BuscarContextoMitecoAsync()
    {
        try
        {
            var options = new SearchOptions
            {
                Size = 5,
                Select = { "content" }
            };

            // Búsqueda sobre el PDF del MITECO
            var resultados = await _searchClient.SearchAsync<SearchDocument>(
                "emisiones CO2 electricidad alcance 2 consumo oficinas buenas prácticas límites",
                options);

            var fragmentos = new List<string>();
            await foreach (var r in resultados.Value.GetResultsAsync())
            {
                if (r.Document.TryGetValue("content", out var content) && content is string texto)
                    fragmentos.Add(texto.Trim());
            }

            if (fragmentos.Count == 0)
            {
                _logger.LogWarning("AI Search no devolvió fragmentos. El índice puede estar vacío.");
                return "(No se encontraron fragmentos en el índice. El análisis se basará en la metodología MITECO estándar.)";
            }

            _logger.LogInformation("AI Search devolvió {Count} fragmentos del PDF.", fragmentos.Count);
            return string.Join("\n\n---\n\n", fragmentos);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error consultando AI Search. Continuando sin contexto PDF.");
            return "(Error al consultar el índice del PDF. El análisis se basará en la metodología MITECO estándar.)";
        }
    }

    private static string ExtraerVeredicto(string texto)
    {
        var lineas = texto.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        foreach (var linea in lineas.Reverse())
        {
            var upper = linea.ToUpperInvariant();
            if (upper.Contains("VEREDICTO:"))
            {
                if (upper.Contains("NO CUMPLE"))        return "NO CUMPLE";
                if (upper.Contains("NECESITA MEJORA"))  return "NECESITA MEJORA";
                if (upper.Contains("CUMPLE"))           return "CUMPLE";
            }
        }
        return "NO DETERMINADO";
    }
}
