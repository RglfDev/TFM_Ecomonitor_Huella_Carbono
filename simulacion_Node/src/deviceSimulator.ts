/**
 * Simulador de dispositivo IoT (equivalente a device_simulator.py).
 *
 * Cada instancia representa un PC virtual que:
 *   - Se conecta a Azure IoT Hub mediante MQTT (SDK oficial azure-iot-device).
 *   - Genera datos realistas de consumo electrico (kWh).
 *   - Envia un mensaje JSON cada N segundos.
 *
 * En Node el envio se hace con setInterval (asincrono), sin necesidad de hilos.
 */
import { Client, Message } from 'azure-iot-device';
import { Mqtt } from 'azure-iot-device-mqtt';

export type EventType = 'sent' | 'info' | 'warn' | 'error';
export type EventCallback = (deviceId: string, type: EventType, data: unknown) => void;

export interface DevicePayload {
  deviceId: string;
  displayName: string;
  timestamp: string;
  consumo_kwh: number;
  potencia_w: number;
  voltaje_v: number;
  corriente_a: number;
  factor_potencia: number;
  zona: string;
  intervalo_s: number;
}

export interface DeviceStatus {
  device_id: string;
  display_name: string;
  zona: string;
  running: boolean;
  messages_sent: number;
  last_payload: DevicePayload | null;
  configured: boolean;
}

export interface OperationResult {
  ok: boolean;
  message: string;
}

/** Numero aleatorio uniforme entre min y max (equivalente a random.uniform). */
function uniform(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function round(value: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}

export class DeviceSimulator {
  private client: Client | null = null;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private messagesSent = 0;
  private lastPayload: DevicePayload | null = null;

  constructor(
    public readonly deviceId: string,
    public readonly displayName: string,
    public readonly zona: string,
    private readonly connectionString: string,
    private readonly potenciaBaseW: number,
    private readonly sendInterval: number,
    private readonly onEvent: EventCallback = () => { /* noop */ },
  ) {}

  // -----------------------------------------------------------------
  // Generacion de datos simulados
  // -----------------------------------------------------------------
  private generatePayload(): DevicePayload {
    // Variacion alrededor de la potencia base (+/- 30%)
    const potenciaW = this.potenciaBaseW * uniform(0.7, 1.3);

    // kWh consumidos durante el intervalo: kWh = (W * s) / (1000 * 3600)
    const consumoKwh = (potenciaW * this.sendInterval) / (1000 * 3600);

    const voltaje = uniform(228.0, 232.0);
    const corriente = potenciaW / voltaje;
    const factorPotencia = uniform(0.92, 0.98);

    return {
      deviceId: this.deviceId,
      displayName: this.displayName,
      timestamp: new Date().toISOString(),
      consumo_kwh: round(consumoKwh, 6),
      potencia_w: round(potenciaW, 2),
      voltaje_v: round(voltaje, 2),
      corriente_a: round(corriente, 3),
      factor_potencia: round(factorPotencia, 3),
      zona: this.zona,
      intervalo_s: this.sendInterval,
    };
  }

  // -----------------------------------------------------------------
  // Ciclo de vida
  // -----------------------------------------------------------------
  async start(): Promise<OperationResult> {
    if (this.running) {
      return { ok: false, message: 'El dispositivo ya esta enviando datos.' };
    }
    if (!this.connectionString) {
      return { ok: false, message: 'No hay connection string configurada. Revisa el archivo .env.' };
    }

    try {
      this.client = Client.fromConnectionString(this.connectionString, Mqtt);
      await this.client.open();
      this.onEvent(this.deviceId, 'info', `Conectado a Azure IoT Hub como ${this.deviceId}`);
    } catch (err) {
      this.onEvent(this.deviceId, 'error', `No se pudo conectar: ${(err as Error).message}`);
      await this.disconnect();
      return { ok: false, message: 'No se pudo conectar a Azure IoT Hub.' };
    }

    this.running = true;
    // Primer envio inmediato y luego cada 'sendInterval' segundos
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.sendInterval * 1000);

    return { ok: true, message: 'Envio iniciado.' };
  }

  async stop(): Promise<OperationResult> {
    if (!this.running) {
      return { ok: false, message: 'El dispositivo no estaba activo.' };
    }

    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.disconnect();
    this.onEvent(this.deviceId, 'info', 'Conexion cerrada.');

    return { ok: true, message: 'Envio detenido.' };
  }

  status(): DeviceStatus {
    return {
      device_id: this.deviceId,
      display_name: this.displayName,
      zona: this.zona,
      running: this.running,
      messages_sent: this.messagesSent,
      last_payload: this.lastPayload,
      configured: Boolean(this.connectionString),
    };
  }

  // -----------------------------------------------------------------
  // Envio y conexion
  // -----------------------------------------------------------------
  private async tick(): Promise<void> {
    if (!this.client || !this.running) {
      return;
    }

    const payload = this.generatePayload();
    try {
      const msg = new Message(JSON.stringify(payload));
      msg.contentEncoding = 'utf-8';
      msg.contentType = 'application/json';
      await this.client.sendEvent(msg);

      this.messagesSent += 1;
      this.lastPayload = payload;
      this.onEvent(this.deviceId, 'sent', payload);
    } catch (err) {
      this.onEvent(this.deviceId, 'error', `Error enviando mensaje: ${(err as Error).message}`);
    }
  }

  private async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch (err) {
        this.onEvent(this.deviceId, 'warn', `Error al desconectar: ${(err as Error).message}`);
      } finally {
        this.client = null;
      }
    }
  }
}
