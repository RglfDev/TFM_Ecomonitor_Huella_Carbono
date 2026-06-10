/**
 * Configuracion de los dispositivos simulados (equivalente a config.py).
 *
 * Para anadir un nuevo dispositivo:
 *   1. Registrar la device identity en Azure IoT Hub.
 *   2. Anadir su connection string al archivo .env (ej: DEVICE_3_CONNECTION_STRING).
 *   3. Anadir una nueva entrada a la lista DEVICES con su envVar asociada.
 */
import dotenv from 'dotenv';
import path from 'path';

// Busca el .env junto al proyecto (raíz de simulacion_Node), no en el CWD del proceso.
// Así funciona aunque arranques con `node simulacion_Node/dist/server.js` desde la raíz.
// __dirname está en simulacion_Node/dist/ → subir 1 nivel → simulacion_Node/.env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const SEND_INTERVAL_SECONDS = parseInt(process.env.SEND_INTERVAL_SECONDS ?? '30', 10);
export const PORT = parseInt(process.env.FLASK_PORT ?? process.env.PORT ?? '5000', 10);

export interface DeviceConfig {
  id: string;
  displayName: string;
  zona: string;
  envVar: string;
  potenciaBaseW: number;
}

export const DEVICES: DeviceConfig[] = [
  {
    id: 'pc-sim-001',
    displayName: 'PC 1',
    zona: 'Oficina-Planta-1',
    envVar: 'DEVICE_1_CONNECTION_STRING',
    potenciaBaseW: 150,
  },
  {
    id: 'pc-sim-002',
    displayName: 'PC 2',
    zona: 'Oficina-Planta-2',
    envVar: 'DEVICE_2_CONNECTION_STRING',
    potenciaBaseW: 180,
  },
];

export function getDeviceConnectionString(envVar: string): string {
  const cs = process.env[envVar];
  if (!cs || cs.startsWith('HostName=YOUR_HUB')) {
    return '';
  }
  return cs;
}
