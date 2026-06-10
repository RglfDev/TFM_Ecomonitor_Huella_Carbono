/**
 * PLANTILLA de configuracion de produccion.
 *
 * Copia este archivo a `environment.prod.ts` y rellena los valores reales.
 * La functionKey se obtiene en el portal de Azure:
 *   Function App -> Funciones -> Claves de aplicacion -> host key "default".
 *
 * `environment.prod.ts` esta en .gitignore para no exponer la clave en el repositorio.
 */
export const environment = {
  production: true,
  apiBaseUrl: 'https://func-ecomonitor.azurewebsites.net/api',
  functionKey: '' // <- pega aqui la function key (NO subir a git)
};
