# Simulacion Node - Dispositivos IoT EcoMonitor (Node.js + TypeScript)

Réplica del proyecto `simulacion_Python` en **Node.js + TypeScript**. Mismas funciones,
mismas conexiones (Azure IoT Hub) y misma interfaz. Simula PCs de oficina que envían su
consumo eléctrico (kWh) al IoT Hub mediante **MQTT** en formato **JSON**, cada 30 segundos.

## Equivalencias con el proyecto Python

| Python | Node + TypeScript |
|---|---|
| Flask | Express |
| Flask-SocketIO | Socket.IO |
| `azure-iot-device` | `azure-iot-device` + `azure-iot-device-mqtt` |
| `python-dotenv` | `dotenv` |
| hilos (threads) | `setInterval` (asíncrono) |
| Jinja (`index.html`) | EJS (`index.ejs`) |

## Estructura

```
simulacion_Node/
├── package.json
├── tsconfig.json
├── .env / .env.example
├── src/
│   ├── config.ts            (= config.py)
│   ├── deviceSimulator.ts   (= device_simulator.py)
│   └── server.ts            (= app.py)
└── views/
    └── index.ejs            (= templates/index.html)
```

## Instalación

```powershell
cd C:\Users\Administrador\Desktop\TFM_EcoMonitor\simulacion_Node
npm install
```

## Configuración

El archivo `.env` ya viene con las connection strings de `pc-sim-001` y `pc-sim-002`
(las mismas que el proyecto Python). Si necesitas cambiarlas, edita `.env`
(plantilla en `.env.example`).

## Ejecución

Compilar y arrancar:
```powershell
npm run build
npm start
```

O en modo desarrollo (sin compilar):
```powershell
npm run dev
```

Abrir en el navegador: <http://127.0.0.1:5000>

Verás las tarjetas **PC 1** y **PC 2** con botones **Iniciar** / **Parar** y un log en vivo,
igual que en la versión de Python.

## ⚠️ Importante

No ejecutes a la vez el simulador de **Python** y el de **Node** apuntando a los mismos
dispositivos: Azure IoT Hub permite una sola conexión MQTT por dispositivo, así que el
segundo desconectaría al primero. Arranca uno u otro.

## Payload enviado a IoT Hub

```json
{
  "deviceId": "pc-sim-001",
  "displayName": "PC 1",
  "timestamp": "2026-06-06T10:30:00.000Z",
  "consumo_kwh": 0.001250,
  "potencia_w": 150.00,
  "voltaje_v": 230.10,
  "corriente_a": 0.651,
  "factor_potencia": 0.950,
  "zona": "Oficina-Planta-1",
  "intervalo_s": 30
}
```
