/** Origen de los datos de un dispositivo (endpoint de equipos). */
export type DeviceSource = 'sim' | 'real';

/** Orígenes válidos para el análisis (incluye los escenarios de demostración). */
export type AnalysisSource = 'sim' | 'real' | 'ok' | 'ko';

/** Escenarios de demostración. */
export type ScenarioKey = 'ok' | 'ko';

/**
 * Estado de un dispositivo activo, devuelto por la Azure Function DeviceStatus
 * (GET /api/devices).
 */
export interface Device {
  deviceId: string;
  displayName: string;
  source: DeviceSource;
  lastSeen: string;
  lecturas: number;
}
