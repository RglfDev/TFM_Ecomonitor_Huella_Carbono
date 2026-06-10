/** Extrae un mensaje legible de un error HTTP devuelto por las Azure Functions. */
export function mensajeErrorHttp(err: unknown): string {
  const e = err as { error?: { error?: string }; status?: number };
  if (e?.error?.error) {
    return e.error.error;
  }
  if (e?.status === 0) {
    return 'No se pudo contactar con las Azure Functions. Comprueba que están en marcha (func start).';
  }
  return 'No se pudo completar el análisis. Inténtalo de nuevo en unos segundos.';
}
