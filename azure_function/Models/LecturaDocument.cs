using System.Text.Json.Serialization;

namespace EcoMonitorFunction.Models;

/// <summary>
/// Documento que se guarda en Cosmos DB por cada mensaje procesado.
/// Contiene los datos originales del IoT más el cálculo de huella de carbono.
/// La partition key es "deviceId" (configurada en el contenedor "lecturas").
/// </summary>
public class LecturaDocument
{
    /// <summary>GUID único — campo obligatorio de Cosmos DB.</summary>
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    /// <summary>Partition key del contenedor. Ej: "pc-sim-001".</summary>
    [JsonPropertyName("deviceId")]
    public string DeviceId { get; set; } = string.Empty;

    [JsonPropertyName("displayName")]
    public string DisplayName { get; set; } = string.Empty;

    [JsonPropertyName("timestamp")]
    public DateTime Timestamp { get; set; }

    /// <summary>Consumo eléctrico durante el intervalo (kWh).</summary>
    [JsonPropertyName("consumo_kwh")]
    public double ConsumoKwh { get; set; }

    /// <summary>Potencia media durante el intervalo (W).</summary>
    [JsonPropertyName("potencia_w")]
    public double PotenciaW { get; set; }

    /// <summary>Huella de carbono calculada: consumo_kwh × factor_kg_co2_kwh.</summary>
    [JsonPropertyName("co2_kg")]
    public double Co2Kg { get; set; }

    /// <summary>Factor de emisión usado en el cálculo (kg CO2/kWh), obtenido de Azure SQL.</summary>
    [JsonPropertyName("factor_usado")]
    public double FactorUsado { get; set; }

    /// <summary>Año del factor de emisión consultado.</summary>
    [JsonPropertyName("anio_factor")]
    public int AnioFactor { get; set; }

    [JsonPropertyName("zona")]
    public string Zona { get; set; } = string.Empty;

    /// <summary>Duración del intervalo de muestreo en segundos (normalmente 30).</summary>
    [JsonPropertyName("intervalo_s")]
    public int IntervaloS { get; set; }
}
