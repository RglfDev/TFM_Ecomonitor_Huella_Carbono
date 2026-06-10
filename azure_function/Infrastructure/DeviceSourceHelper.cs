namespace EcoMonitorFunction.Infrastructure;

/// <summary>
/// Clasifica los dispositivos por su origen según el prefijo del deviceId:
///   - "pc-esc-ok*" → escenario de demostración FAVORABLE (debe cumplir).
///   - "pc-esc-ko*" → escenario de demostración DESFAVORABLE (no debe cumplir).
///   - "pc-real*"   → datos reales (app Node).
///   - cualquier otro (p.ej. "pc-sim*") → datos simulados (app Python).
///
/// Esta separación por prefijo garantiza que los informes de cada origen
/// NUNCA mezclen lecturas entre sí.
/// </summary>
public static class DeviceSourceHelper
{
    public const string Simulado     = "sim";
    public const string Real         = "real";
    public const string Favorable    = "ok";
    public const string Desfavorable = "ko";

    public static string Classify(string deviceId)
    {
        if (deviceId.StartsWith("pc-esc-ok", StringComparison.OrdinalIgnoreCase)) return Favorable;
        if (deviceId.StartsWith("pc-esc-ko", StringComparison.OrdinalIgnoreCase)) return Desfavorable;
        if (deviceId.StartsWith("pc-real",   StringComparison.OrdinalIgnoreCase)) return Real;
        return Simulado;
    }

    /// <summary>
    /// Indica si un deviceId pertenece al 'source' solicitado.
    /// Si 'source' es null o vacío, acepta todos.
    /// </summary>
    public static bool MatchesSource(string deviceId, string? source)
    {
        if (string.IsNullOrWhiteSpace(source))
            return true;

        return Classify(deviceId).Equals(source.Trim(), StringComparison.OrdinalIgnoreCase);
    }
}
