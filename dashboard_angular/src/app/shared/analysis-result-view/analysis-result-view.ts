import { Component, computed, inject, input, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { marked } from 'marked';

import { AnalysisResult } from '../../core/models/analysis-result';
import { DatosEmpresa } from '../../core/models/datos-empresa';
import { PdfService } from '../../core/services/pdf';
import { CarbonService } from '../../core/services/carbon';
import { mensajeErrorHttp } from '../../core/services/http-error';

/**
 * Vista presentacional del resultado de un análisis: cabecera con los datos de la
 * empresa, veredicto, resumen, texto de la IA (markdown) y botón para enviar el
 * informe (PDF + enlace a Power BI) por correo a través de Power Automate.
 */
@Component({
  selector: 'app-analysis-result-view',
  templateUrl: './analysis-result-view.html',
  styleUrl: './analysis-result-view.css'
})
export class AnalysisResultView {
  /** Resultado a mostrar. */
  result = input.required<AnalysisResult>();
  /** Etiqueta del origen (para el nombre del PDF). */
  origenLabel = input<string>('Informe');
  /** Datos de la empresa que encabezan el informe (snapshot al generar). */
  datos = input<DatosEmpresa | null>(null);

  private readonly pdf = inject(PdfService);
  private readonly carbon = inject(CarbonService);

  readonly enviando = signal(false);
  readonly enviado = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly analisisHtml = computed(() =>
    marked.parse(this.result().analisis_ia, { async: false }) as string);

  readonly veredictoClase = computed(() => {
    const v = (this.result().veredicto ?? '').toUpperCase();
    if (v.includes('NO CUMPLE')) return 'bg-nocumple';
    if (v.includes('MEJORA'))    return 'bg-mejora';
    if (v.includes('CUMPLE'))    return 'bg-cumple';
    return 'bg-desc';
  });

  enviarEmail(): void {
    const datos = this.datos();
    if (!datos) {
      this.error.set('No hay datos de empresa para enviar el informe.');
      return;
    }

    this.enviando.set(true);
    this.enviado.set(null);
    this.error.set(null);

    const pdfBase64 = this.pdf.generarBase64(this.result(), this.origenLabel(), datos);

    this.carbon.enviarInforme({
      email:       datos.email,
      empresa:     datos.empresa,
      responsable: datos.responsable,
      telefono:    datos.telefono,
      veredicto:   this.result().veredicto,
      fileName:    this.pdf.nombreArchivo(this.origenLabel()),
      pdfBase64
    })
      .pipe(finalize(() => this.enviando.set(false)))
      .subscribe({
        next: (r) => this.enviado.set(r.mensaje ?? `Informe enviado a ${datos.email}.`),
        error: (err) => this.error.set(mensajeErrorHttp(err))
      });
  }
}
