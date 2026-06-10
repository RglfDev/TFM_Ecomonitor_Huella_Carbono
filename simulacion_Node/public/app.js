/**
 * EcoMonitor (Node) - Lógica del frontend.
 * Gestiona los botones Iniciar/Parar de cada dispositivo y refleja los eventos
 * que llegan por Socket.IO en la pantalla virtual del monitor + tarjeta de stats.
 */

// ===== Conexión Socket.IO =====
const socket = io();

// ===== Helpers =====
function el(deviceId, role) {
  return document.querySelector(`[data-device-id="${deviceId}"] [data-role="${role}"]`);
}

function setBadge(deviceId, text, cls) {
  const b = el(deviceId, 'badge');
  if (!b) return;
  b.textContent = text;
  b.className = 'stats-badge ' + cls;
}

function appendLog(deviceId, text, cls) {
  const log = el(deviceId, 'log');
  if (!log) return;
  const line = document.createElement('div');
  line.className = 'terminal-line ' + (cls || '');
  const ts = new Date().toLocaleTimeString();
  line.textContent = `[${ts}] ${text}`;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
  while (log.children.length > 80) log.removeChild(log.firstChild);
}

function setScreen(deviceId, running) {
  const term = document.querySelector(
    `.pc-frame-wrapper[data-device-id="${deviceId}"] [data-role="terminal"]`
  );
  if (!term) return;
  if (running) {
    term.classList.remove('off');
  } else {
    term.classList.add('off');
  }
}

/**
 * Actualiza el estado visual de una tarjeta (botones + badge + pantalla).
 * El "permDisabled" se detecta por CLASE CSS estable (.perm-disabled),
 * NO por el atributo disabled, que cambia con cada toggle.
 */
function setRunning(deviceId, running) {
  const card = document.querySelector(`.stats-card[data-device-id="${deviceId}"]`);
  if (!card) return;
  const startBtn = card.querySelector('[data-role="start"]');
  const stopBtn  = card.querySelector('[data-role="stop"]');

  const startPermDisabled = startBtn.classList.contains('perm-disabled');

  // Si está enviando -> start deshabilitado, stop habilitado
  // Si está parado  -> stop deshabilitado, start habilitado (salvo permDisabled)
  startBtn.disabled = running || startPermDisabled;
  stopBtn.disabled  = !running;

  setBadge(deviceId, running ? 'ENVIANDO' : 'PARADO', running ? '' : 'stopped');
  setScreen(deviceId, running);
}

async function callApi(deviceId, action) {
  const res  = await fetch(`/api/devices/${deviceId}/${action}`, { method: 'POST' });
  const data = await res.json();
  appendLog(deviceId, data.message, data.ok ? 'info' : 'error');
  if (data.status) setRunning(deviceId, data.status.running);
}

// ===== Bind de botones =====
document.querySelectorAll('.stats-card').forEach(card => {
  const id = card.dataset.deviceId;
  card.querySelector('[data-role="start"]').addEventListener('click', () => callApi(id, 'start'));
  card.querySelector('[data-role="stop"]').addEventListener('click',  () => callApi(id, 'stop'));
});

// ===== Eventos Socket.IO =====
socket.on('device_event', evt => {
  const { device_id, type, data } = evt;
  if (type === 'sent') {
    const count = el(device_id, 'count');
    count.textContent = (parseInt(count.textContent.replace(/[^\d]/g, '') || '0') + 1).toLocaleString();
    el(device_id, 'last-kwh').textContent = data.consumo_kwh;
    el(device_id, 'last-w').textContent   = data.potencia_w;
    appendLog(device_id, `Enviado -> ${data.consumo_kwh} kWh (${data.potencia_w} W)`, 'sent');
    setBadge(device_id, 'ENVIANDO', '');
    setScreen(device_id, true);
  } else if (type === 'info') {
    appendLog(device_id, data, 'info');
  } else if (type === 'warn') {
    appendLog(device_id, data, 'warn');
  } else if (type === 'error') {
    appendLog(device_id, data, 'error');
    setBadge(device_id, 'ERROR', 'error');
  }
});

// ===== Estado inicial =====
fetch('/api/devices').then(r => r.json()).then(list => {
  list.forEach(d => setRunning(d.device_id, d.running));
});
