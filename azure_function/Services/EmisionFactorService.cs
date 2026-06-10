using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace EcoMonitorFunction.Services;

/// <summary>
/// Servicio Singleton que consulta Azure SQL DB para obtener el factor de emisión
/// (kg CO2/kWh) del año requerido, según los datos oficiales del MITECO.
///
/// Mantiene una caché en memoria para evitar una consulta SQL por cada mensaje
/// del IoT Hub (se reusa el factor del mismo año sin volver a consultar).
/// </summary>
public class EmisionFactorService
{
    private readonly string _connectionString;
    private readonly ILogger<EmisionFactorService> _logger;
    private readonly Dictionary<int, decimal> _cache = new();

    public EmisionFactorService(IConfiguration configuration, ILogger<EmisionFactorService> logger)
    {
        _connectionString = configuration["SqlDbConnection"]
            ?? throw new InvalidOperationException(
                "SqlDbConnection no está configurada en local.settings.json / Application Settings.");
        _logger = logger;
    }

    /// <summary>
    /// Devuelve el factor de emisión para el año indicado.
    /// Si no existe ese año exacto en la tabla, usa el año más reciente disponible.
    /// Fallback hardcoded a 0.179 (MITECO 2024) si falla la consulta SQL.
    /// </summary>
    public async Task<decimal> GetFactorAsync(int anio)
    {
        // Devolver desde caché si ya se consultó este año
        if (_cache.TryGetValue(anio, out var cached))
            return cached;

        try
        {
            await using var conn = new SqlConnection(_connectionString);
            await conn.OpenAsync();

            // Busca el factor del año solicitado; si no existe, usa el más reciente anterior
            const string sql = """
                SELECT TOP 1 factor_kg_co2_kwh
                FROM coeficientes_emision
                WHERE anio <= @anio
                ORDER BY anio DESC
                """;

            await using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@anio", anio);

            var result = await cmd.ExecuteScalarAsync();
            var factor = result is not null
                ? Convert.ToDecimal(result)
                : 0.179m;

            _cache[anio] = factor;
            _logger.LogInformation(
                "Factor de emisión consultado para {Anio}: {Factor} kg CO2/kWh", anio, factor);

            return factor;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error al consultar SQL para año {Anio}. Usando fallback 0.179 kg CO2/kWh.", anio);
            return 0.179m;
        }
    }
}
