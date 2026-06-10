/**
 * EcoMonitor (Node) - Servidor Express que gestiona varios dispositivos simulados.
 * Equivalente a app.py (Flask + Flask-SocketIO).
 *
 * Endpoints:
 *   GET  /                       -> Frontend con tarjetas por dispositivo.
 *   GET  /api/devices            -> Estado de todos los dispositivos.
 *   POST /api/devices/:id/start  -> Inicia envio del dispositivo.
 *   POST /api/devices/:id/stop   -> Detiene envio del dispositivo.
 *
 * Eventos Socket.IO:
 *   device_event  -> Emitido cada vez que un dispositivo envia/conecta/falla.
 */
import express from 'express';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';

import { DEVICES, SEND_INTERVAL_SECONDS, PORT, getDeviceConnectionString } from './config';
import { DeviceSimulator, EventType } from './deviceSimulator';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(express.json());

// Sirve los archivos estáticos del frontend
app.use('/img', express.static(path.join(__dirname, '..', 'img')));
app.use(express.static(path.join(__dirname, '..', 'public')));

// -----------------------------------------------------------------
// Inicializacion de los dispositivos simulados
// -----------------------------------------------------------------
/** Callback que cada simulador llama para publicar eventos al frontend. */
function broadcastEvent(deviceId: string, type: EventType, data: unknown): void {
  io.emit('device_event', { device_id: deviceId, type, data });
}

const devices = new Map<string, DeviceSimulator>();
for (const cfg of DEVICES) {
  devices.set(
    cfg.id,
    new DeviceSimulator(
      cfg.id,
      cfg.displayName,
      cfg.zona,
      getDeviceConnectionString(cfg.envVar),
      cfg.potenciaBaseW,
      SEND_INTERVAL_SECONDS,
      broadcastEvent,
    ),
  );
}

// -----------------------------------------------------------------
// Rutas
// -----------------------------------------------------------------
app.get('/', (_req, res) => {
  res.render('index', {
    devices: [...devices.values()].map((d) => d.status()),
    interval: SEND_INTERVAL_SECONDS,
  });
});

app.get('/api/devices', (_req, res) => {
  res.json([...devices.values()].map((d) => d.status()));
});

app.post('/api/devices/:id/start', async (req, res) => {
  const device = devices.get(req.params.id);
  if (!device) {
    return res.status(404).json({ ok: false, message: 'Dispositivo no encontrado.' });
  }
  const result = await device.start();
  return res.json({ ok: result.ok, message: result.message, status: device.status() });
});

app.post('/api/devices/:id/stop', async (req, res) => {
  const device = devices.get(req.params.id);
  if (!device) {
    return res.status(404).json({ ok: false, message: 'Dispositivo no encontrado.' });
  }
  const result = await device.stop();
  return res.json({ ok: result.ok, message: result.message, status: device.status() });
});

// -----------------------------------------------------------------
// Arranque
// -----------------------------------------------------------------
server.listen(PORT, () => {
  console.log(`EcoMonitor (Node) arrancando en http://127.0.0.1:${PORT}`);
  console.log(`Intervalo de envio: ${SEND_INTERVAL_SECONDS}s`);
  console.log(`Dispositivos cargados: ${[...devices.values()].map((d) => d.displayName).join(', ')}`);
});
