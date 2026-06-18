# EcoMonitor

Plataforma en la nube para medir la **huella de carbono de los equipos informáticos**
de una oficina, siguiendo la metodología oficial del **MITECO**. Los equipos envían su
consumo eléctrico en tiempo real; el sistema lo convierte en CO2, lo almacena y, bajo
demanda, genera un **informe de cumplimiento con inteligencia artificial** (veredicto:
CUMPLE / NECESITA MEJORA / NO CUMPLE) que se puede consultar y enviar por correo en PDF.

## Qué hace

1. Los dispositivos (simulados) envían su consumo por MQTT a Azure IoT Hub cada 30 s.
2. Una Azure Function procesa cada mensaje, calcula el CO2 con el factor oficial del
   MITECO y lo guarda en la base de datos.
3. Desde el dashboard, el usuario solicita un informe: una IA analiza los datos
   apoyandose en la normativa real (RAG) y emite un veredicto con recomendaciones.
4. El informe se muestra en pantalla y se puede enviar por correo en PDF; los historicos
   se visualizan en Power BI.

## Arquitectura


<img width="1272" height="892" alt="arquitectura ecomonitor" src="https://github.com/user-attachments/assets/09a771eb-d5b4-4fea-b513-8d7df5b29468" />

## Tecnologias

| Componente              | Tecnologia                                                        |
|-------------------------|-------------------------------------------------------------------|
| Dashboard               | Angular 21 + TypeScript (standalone, signals)                     |
| Backend / API           | Azure Functions, .NET 8 (modelo aislado), C#                      |
| Simulador de equipos    | Node.js 20 + TypeScript (Express, Socket.IO, azure-iot-device)    |
| Inteligencia artificial | Azure OpenAI (GPT-4o) + Azure AI Search + Document Intelligence (RAG) |
| Servicios Azure         | IoT Hub, Cosmos DB, Azure SQL, Blob Storage, Key Vault            |
| Visualizacion / envio   | Power BI (graficas) y Power Automate (correo con PDF)             |

## Estructura del repositorio

```
.
├── azure_function/      Backend: API y procesado (Azure Functions, .NET 8 / C#)
├── dashboard_angular/   Frontend: dashboard web (Angular 21)
└── simulacion_Node/     Simulador de equipos IoT (Node.js + TypeScript)
```

## Requisitos previos

- Node.js 20+ y npm
- .NET 8 SDK
- Azure Functions Core Tools v4 (`func`)
- Azurite (emulador de almacenamiento): `npm install -g azurite`
- Una suscripcion de Azure con los servicios desplegados (IoT Hub, Cosmos DB, Azure SQL,
  AI Search, Azure OpenAI, etc.) para que el flujo funcione de extremo a extremo.

## Configuracion

Cada subproyecto necesita sus credenciales (no incluidas en el repositorio). Copia las
plantillas de ejemplo y rellenalas con tus valores:

- `azure_function/local.settings.example.json` -> `local.settings.json`
- `simulacion_Node/.env.example` -> `.env`
- (Produccion) `dashboard_angular/src/environments/environment.prod.example.ts` ->
  `environment.prod.ts`

En local, el dashboard ya apunta a las Functions en `http://localhost:7071/api`.

## Ejecucion en local

Se necesitan varias terminales. El orden importa (Azurite antes que las Functions).

**1. Azurite (emulador de almacenamiento que necesitan las Functions)**

```bash
azurite --silent --location C:\azurite
```

**2. Azure Functions (puerto 7071)**

```bash
cd azure_function
func start
```

**3. Simulador de equipos (puerto 5000)**

```bash
cd simulacion_Node
npm install
npm run build
npm start
```

Abre `http://localhost:5000` y pulsa Iniciar en PC 1 y PC 2 para empezar a enviar datos.

**4. Dashboard (puerto 4200)**

```bash
cd dashboard_angular
npm install
npm start
```

Abre `http://localhost:4200`.

## Notas

- El simulador y las Functions usan los mismos identificadores de dispositivo
  (`pc-sim-001`, `pc-sim-002`); no ejecutes a la vez otro cliente con esos mismos IDs
  (Azure IoT Hub admite una unica conexion por dispositivo).
- Ninguna credencial esta en el codigo: en local se leen de `local.settings.json` / `.env`
  y en Azure desde Azure Key Vault.
- Tras arrancar todo, espera unos minutos para que se acumulen lecturas antes de generar
  el primer informe en el dashboard.
