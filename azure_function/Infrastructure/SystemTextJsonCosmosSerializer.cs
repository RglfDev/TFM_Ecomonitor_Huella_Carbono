using Microsoft.Azure.Cosmos;
using System.Text.Json;

namespace EcoMonitorFunction.Infrastructure;

/// <summary>
/// Serializador personalizado para Cosmos DB que usa System.Text.Json.
/// Necesario para que los atributos [JsonPropertyName] del modelo (snake_case)
/// sean reconocidos correctamente al leer documentos de Cosmos DB.
/// </summary>
public class SystemTextJsonCosmosSerializer : CosmosSerializer
{
    private readonly JsonSerializerOptions _options;

    public SystemTextJsonCosmosSerializer(JsonSerializerOptions options)
    {
        _options = options;
    }

    public override T FromStream<T>(Stream stream)
    {
        using (stream)
        {
            if (typeof(Stream).IsAssignableFrom(typeof(T)))
                return (T)(object)stream;

            return JsonSerializer.Deserialize<T>(stream, _options)
                ?? throw new InvalidOperationException("Deserialización de Cosmos devolvió null.");
        }
    }

    public override Stream ToStream<T>(T input)
    {
        var stream = new MemoryStream();
        JsonSerializer.Serialize(stream, input, _options);
        stream.Position = 0;
        return stream;
    }
}
