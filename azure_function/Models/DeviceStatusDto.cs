using System.Text.Json.Serialization;

namespace EcoMonitorFunction.Models;

/// <summary>
/// Estado resumido de un dispositivo que ha enviado datos recientemente.
/// Devuelto por la función DeviceStatus (GET /api/devices).
/// </summary>
public class DeviceStatusDto
{
    [JsonPropertyName("deviceId")]
    public string DeviceId { get; set; } = string.Empty;

    [JsonPropertyName("displayName")]
    public string DisplayName { get; set; } = string.Empty;

    /// <summary>Origen del dispositivo: "sim" (Python) o "real" (Node).</summary>
    [JsonPropertyName("source")]
    public string Source { get; set; } = string.Empty;

    /// <summary>Última vez que el dispositivo envió datos (UTC).</summary>
    [JsonPropertyName("lastSeen")]
    public DateTime LastSeen { get; set; }

    /// <summary>Número de lecturas recibidas en la ventana consultada.</summary>
    [JsonPropertyName("lecturas")]
    public int Lecturas { get; set; }
}
