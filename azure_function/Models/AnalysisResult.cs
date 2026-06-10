using System.Text.Json.Serialization;

namespace EcoMonitorFunction.Models;

/// <summary>
/// Resultado completo del análisis de huella de carbono devuelto por CarbonFootprintAnalyzer.
/// </summary>
public class AnalysisResult
{
    [JsonPropertyName("periodo")]
    public PeriodoInfo Periodo { get; set; } = new();

    [JsonPropertyName("resumen")]
    public ResumenLecturas Resumen { get; set; } = new();

    [JsonPropertyName("analisis_ia")]
    public string AnalisisIa { get; set; } = string.Empty;

    [JsonPropertyName("veredicto")]
    public string Veredicto { get; set; } = string.Empty;

    [JsonPropertyName("timestamp_analisis")]
    public DateTime TimestampAnalisis { get; set; } = DateTime.UtcNow;
}

public class PeriodoInfo
{
    [JsonPropertyName("desde")]
    public string Desde { get; set; } = string.Empty;

    [JsonPropertyName("hasta")]
    public string Hasta { get; set; } = string.Empty;

    [JsonPropertyName("horas")]
    public double Horas { get; set; }
}

public class ResumenLecturas
{
    [JsonPropertyName("total_lecturas")]
    public int TotalLecturas { get; set; }

    [JsonPropertyName("total_kwh")]
    public double TotalKwh { get; set; }

    [JsonPropertyName("total_co2_kg")]
    public double TotalCo2Kg { get; set; }

    [JsonPropertyName("co2_por_dispositivo")]
    public Dictionary<string, double> Co2PorDispositivo { get; set; } = new();

    [JsonPropertyName("kwh_por_dispositivo")]
    public Dictionary<string, double> KwhPorDispositivo { get; set; } = new();

    [JsonPropertyName("factor_emisión_usado")]
    public double FactorEmisionUsado { get; set; }

    [JsonPropertyName("num_dispositivos")]
    public int NumDispositivos { get; set; }
}
