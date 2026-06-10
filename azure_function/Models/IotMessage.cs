using System.Text.Json.Serialization;

namespace EcoMonitorFunction.Models;

/// <summary>
/// Modelo del JSON que envía el simulador Python cada 30 segundos.
/// Los nombres de campo coinciden exactamente con el payload del simulador.
/// </summary>
public class IotMessage
{
    [JsonPropertyName("deviceId")]
    public string DeviceId { get; set; } = string.Empty;

    [JsonPropertyName("displayName")]
    public string DisplayName { get; set; } = string.Empty;

    [JsonPropertyName("timestamp")]
    public DateTime Timestamp { get; set; }

    [JsonPropertyName("consumo_kwh")]
    public double ConsumoKwh { get; set; }

    [JsonPropertyName("potencia_w")]
    public double PotenciaW { get; set; }

    [JsonPropertyName("voltaje_v")]
    public double VoltajeV { get; set; }

    [JsonPropertyName("corriente_a")]
    public double CorrienteA { get; set; }

    [JsonPropertyName("factor_potencia")]
    public double FactorPotencia { get; set; }

    [JsonPropertyName("zona")]
    public string Zona { get; set; } = string.Empty;

    [JsonPropertyName("intervalo_s")]
    public int IntervaloS { get; set; }
}
