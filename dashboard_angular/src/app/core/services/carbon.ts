import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AnalyzeResponse } from '../models/analysis-result';
import { Device, DeviceSource, AnalysisSource, ScenarioKey } from '../models/device';

/** Payload para enviar el informe por correo. */
export interface EnvioInforme {
  email: string;
  empresa: string;
  responsable: string;
  telefono: string;
  veredicto: string;
  fileName: string;
  pdfBase64: string;
}

/**
 * Servicio que comunica el dashboard con las Azure Functions:
 *   - GET /api/analyze  → análisis de huella de carbono con IA.
 *   - GET /api/devices  → equipos que están enviando datos ahora mismo.
 */
@Injectable({ providedIn: 'root' })
export class CarbonService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /** Lanza el análisis de cumplimiento para un origen (sim/real/ok/ko). */
  analizar(source: AnalysisSource): Observable<AnalyzeResponse> {
    return this.http.get<AnalyzeResponse>(`${this.base}/analyze`, {
      params: this.buildParams({ source })
    });
  }

  /** Genera (siembra) en Cosmos el lote de datos de un escenario de demostración. */
  sembrarEscenario(scenario: ScenarioKey): Observable<unknown> {
    return this.http.post<unknown>(`${this.base}/seed`, null, {
      params: this.buildParams({ scenario })
    });
  }

  /** Envía el informe (PDF + datos) por correo a través de la Function/Power Automate. */
  enviarInforme(payload: EnvioInforme): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.post<{ ok: boolean; mensaje: string }>(
      `${this.base}/send-report`, payload, { params: this.buildParams({}) });
  }

  /** Lista los equipos activos ahora mismo (han enviado en los últimos 90 s) para un origen. */
  obtenerDispositivos(source: DeviceSource): Observable<Device[]> {
    return this.http.get<Device[]>(`${this.base}/devices`, {
      params: this.buildParams({ source })
    });
  }

  /** Añade la function key (?code=) si está configurada (entorno desplegado). */
  private buildParams(values: Record<string, string>): HttpParams {
    let params = new HttpParams();
    for (const key of Object.keys(values)) {
      params = params.set(key, values[key]);
    }
    if (environment.functionKey) {
      params = params.set('code', environment.functionKey);
    }
    return params;
  }
}
