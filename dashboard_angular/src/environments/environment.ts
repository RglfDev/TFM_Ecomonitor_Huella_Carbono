/**
 * Configuración por defecto (desarrollo local).
 * La usa `ng serve`. Las Azure Functions corren en local con `func start` (puerto 7071)
 * y no requieren clave porque localhost está abierto.
 *
 * En build de producción este archivo se sustituye por environment.prod.ts
 * (ver fileReplacements en angular.json).
 */
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:7071/api',
  functionKey: '' // se añade como ?code=... si está presente
};
