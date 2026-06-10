/**
 * Modelos que reflejan la respuesta de la Azure Function CarbonFootprintAnalyzer
 * (GET /api/analyze). Los nombres de campo coinciden con el JSON del backend.
 */
export interface Periodo {
  desde: string;
  hasta: string;
  horas: number;
}

export interface Resumen {
  total_lecturas: number;
  total_kwh: number;
  total_co2_kg: number;
  co2_por_dispositivo: Record<string, number>;
  kwh_por_dispositivo: Record<string, number>;
  'factor_emisión_usado': number;
  num_dispositivos: number;
}

export interface AnalysisResult {
  periodo: Periodo;
  resumen: Resumen;
  analisis_ia: string;
  veredicto: string;
  timestamp_analisis: string;
}

/** Respuesta cuando no hay lecturas en el período. */
export interface NoDataResponse {
  mensaje: string;
  desde: string;
  hasta: string;
  source?: string;
}

export type AnalyzeResponse = AnalysisResult | NoDataResponse;

/** Type guard: distingue una respuesta con datos de una respuesta vacía. */
export function tieneDatos(r: AnalyzeResponse): r is AnalysisResult {
  return (r as AnalysisResult).analisis_ia !== undefined;
}
