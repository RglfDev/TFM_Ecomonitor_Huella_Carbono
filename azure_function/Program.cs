using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.Text.Json;
using EcoMonitorFunction.Infrastructure;
using EcoMonitorFunction.Services;

var host = new HostBuilder()
    .ConfigureFunctionsWebApplication()   // necesario para el HTTP trigger de CarbonFootprintAnalyzer
    .ConfigureServices((context, services) =>
    {
        // Function 1: factor de emisión desde SQL (Singleton con caché)
        services.AddSingleton<EmisionFactorService>();

        // Function 2: cliente Cosmos DB con serializador System.Text.Json
        // (necesario para que [JsonPropertyName] en snake_case funcione correctamente)
        services.AddSingleton(sp =>
        {
            var cfg = sp.GetRequiredService<IConfiguration>();
            var cs = cfg["CosmosDBConnection"]
                ?? throw new InvalidOperationException("CosmosDBConnection no configurada.");

            var jsonOptions = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };

            return new CosmosClient(cs, new CosmosClientOptions
            {
                Serializer = new SystemTextJsonCosmosSerializer(jsonOptions)
            });
        });

        // Function 2: servicio de consultas a Cosmos DB
        services.AddSingleton<CosmosQueryService>();

        // Function 2: servicio de análisis IA (AI Search + OpenAI)
        services.AddSingleton<AiAnalysisService>();

        // SendReport: cliente HTTP para reenviar el informe al flujo de Power Automate
        services.AddHttpClient();
    })
    .Build();

await host.RunAsync();
