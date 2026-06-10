import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';

import { AnalysisResult } from '../models/analysis-result';
import { DatosEmpresa } from '../models/datos-empresa';

/**
 * Genera un PDF descargable a partir del resultado del análisis de huella de carbono,
 * usando la misma paleta corporativa que el dashboard.
 */
@Injectable({ providedIn: 'root' })
export class PdfService {

  // --- Paleta (replica de la del dashboard) ---------------------------
  // Verde principal #012d1d / verde acento #1b4332 / claro #cce6d0
  private readonly C_PRIMARY      : [number, number, number] = [1, 45, 29];
  private readonly C_PRIMARY_SOFT : [number, number, number] = [27, 67, 50];
  private readonly C_SECONDARY    : [number, number, number] = [76, 100, 82];
  private readonly C_SUBTLE_BG    : [number, number, number] = [240, 247, 244];
  private readonly C_SUBTLE_BORDER: [number, number, number] = [193, 232, 211];
  private readonly C_TEXT         : [number, number, number] = [24, 26, 46];
  private readonly C_MUTED        : [number, number, number] = [65, 72, 68];

  // --- Layout ----------------------------------------------------------
  private readonly margin = 20;     // mm
  private readonly lineHeight = 5;  // mm
  private readonly headerHeight = 32;

  // --------------------------------------------------------------------
  // API pública
  // --------------------------------------------------------------------

  /** Genera el PDF y lo descarga. */
  generarInforme(result: AnalysisResult, origenLabel: string, datos?: DatosEmpresa | null): void {
    const doc = this.construirDoc(result, origenLabel, datos);
    doc.save(this.nombreArchivo(origenLabel));
  }

  /** Devuelve el PDF en base64 (sin la cabecera data:...;base64,) para enviarlo por correo. */
  generarBase64(result: AnalysisResult, origenLabel: string, datos?: DatosEmpresa | null): string {
    const doc = this.construirDoc(result, origenLabel, datos);
    const dataUri = doc.output('datauristring');
    return dataUri.substring(dataUri.indexOf('base64,') + 'base64,'.length);
  }

  /** Nombre de archivo del informe. */
  nombreArchivo(origenLabel: string): string {
    return `informe-huella-carbono-${origenLabel.toLowerCase().replace(/\s+/g, '-')}.pdf`;
  }

  // --------------------------------------------------------------------
  // Construcción
  // --------------------------------------------------------------------

  private construirDoc(result: AnalysisResult, origenLabel: string, datos?: DatosEmpresa | null): jsPDF {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const usableWidth = pageWidth - this.margin * 2;

    // ----- Cabecera -----
    this.dibujarCabecera(doc, pageWidth);
    let y = this.headerHeight + 12;

    // ----- Datos de empresa -----
    if (datos) {
      y = this.dibujarDatosEmpresa(doc, datos, y, usableWidth);
    }

    // ----- Metadatos -----
    doc.setTextColor(...this.C_MUTED);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const fecha = new Date(result.timestamp_analisis).toLocaleString('es-ES');
    doc.text(`Origen de los datos: ${this.txt(origenLabel)}`, this.margin, y);  y += this.lineHeight;
    doc.text(`Generado: ${fecha}`, this.margin, y);                              y += this.lineHeight;
    doc.text(
      `Período analizado: ${this.fecha(result.periodo.desde)} -> ${this.fecha(result.periodo.hasta)} (${result.periodo.horas} h)`,
      this.margin, y
    );
    y += this.lineHeight * 1.8;

    // ----- Veredicto -----
    y = this.dibujarVeredicto(doc, result.veredicto, y, usableWidth);
    y += 6;

    // ----- Resumen -----
    y = this.dibujarResumen(doc, result, y, usableWidth, pageHeight);

    // ----- Análisis IA -----
    y = this.dibujarAnalisisIA(doc, result.analisis_ia, y, usableWidth, pageHeight);

    // ----- Pie en todas las páginas -----
    this.dibujarPies(doc, pageWidth, pageHeight);

    return doc;
  }

  // --------------------------------------------------------------------
  // Bloques visuales
  // --------------------------------------------------------------------

  private dibujarCabecera(doc: jsPDF, pageWidth: number): void {
    // Banda principal verde oscuro
    doc.setFillColor(...this.C_PRIMARY);
    doc.rect(0, 0, pageWidth, this.headerHeight, 'F');

    // Acento decorativo: trapecio claro
    doc.setFillColor(...this.C_PRIMARY_SOFT);
    doc.triangle(
      pageWidth - 60, 0,
      pageWidth,      0,
      pageWidth,      this.headerHeight,
      'F'
    );

    // Línea de acento clarito en la base
    doc.setFillColor(...this.C_SUBTLE_BORDER);
    doc.rect(0, this.headerHeight, pageWidth, 1.2, 'F');

    // Texto: marca
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('EcoMonitor', this.margin, 15);

    // Texto: tagline
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(193, 232, 211);
    doc.text('Informe de huella de carbono', this.margin, 22);

    // Texto: badge MITECO arriba derecha
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('METODOLOGIA MITECO', pageWidth - this.margin, 15, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(193, 232, 211);
    doc.text('Calculo verificado', pageWidth - this.margin, 22, { align: 'right' });
  }

  private dibujarDatosEmpresa(doc: jsPDF, datos: DatosEmpresa, y: number, usableWidth: number): number {
    doc.setDrawColor(...this.C_SUBTLE_BORDER);
    doc.setFillColor(...this.C_SUBTLE_BG);
    doc.roundedRect(this.margin, y, usableWidth, 26, 2.5, 2.5, 'FD');

    doc.setTextColor(...this.C_PRIMARY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DE LA EMPRESA', this.margin + 5, y + 6);

    doc.setTextColor(...this.C_TEXT);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const colX = this.margin + 5 + usableWidth / 2;
    doc.text(`Empresa: ${this.txt(datos.empresa)}`, this.margin + 5, y + 13);
    doc.text(`Responsable: ${this.txt(datos.responsable)}`, colX, y + 13);
    doc.text(`Telefono: ${this.txt(datos.telefono)}`, this.margin + 5, y + 20);
    doc.text(`Correo: ${this.txt(datos.email)}`, colX, y + 20);

    return y + 34;
  }

  private dibujarVeredicto(doc: jsPDF, veredicto: string, y: number, usableWidth: number): number {
    const [r, g, b] = this.colorVeredicto(veredicto);
    doc.setFillColor(r, g, b);
    doc.roundedRect(this.margin, y, usableWidth, 12, 2.5, 2.5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`VEREDICTO: ${this.txt(veredicto)}`, this.margin + 5, y + 8);

    return y + 12;
  }

  private dibujarResumen(doc: jsPDF, result: AnalysisResult, y: number, usableWidth: number, pageHeight: number): number {
    const res = result.resumen;

    doc.setTextColor(...this.C_PRIMARY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Resumen de mediciones', this.margin, y);
    y += 7;

    doc.setTextColor(...this.C_TEXT);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    const filas = [
      `Equipos analizados: ${res.num_dispositivos}`,
      `Lecturas totales: ${res.total_lecturas}`,
      `Consumo total: ${res.total_kwh.toFixed(6)} kWh`,
      `Huella de carbono total: ${res.total_co2_kg.toFixed(6)} kg CO2`,
      `Factor de emision (MITECO): ${res['factor_emisión_usado']} kg CO2 / kWh`
    ];
    for (const f of filas) {
      y = this.verificarSalto(doc, y, pageHeight);
      doc.text(`  -  ${f}`, this.margin, y);
      y += this.lineHeight;
    }

    y += 2;
    y = this.verificarSalto(doc, y, pageHeight);
    doc.setFont('helvetica', 'bold');
    doc.text('Desglose por equipo:', this.margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');

    for (const [nombre, co2] of Object.entries(res.co2_por_dispositivo)) {
      const kwh = res.kwh_por_dispositivo[nombre] ?? 0;
      y = this.verificarSalto(doc, y, pageHeight);
      doc.text(`  -  ${nombre}: ${co2.toFixed(6)} kg CO2  (${kwh.toFixed(6)} kWh)`, this.margin, y);
      y += this.lineHeight;
    }

    return y + 6;
  }

  private dibujarAnalisisIA(doc: jsPDF, analisisMd: string, y: number, usableWidth: number, pageHeight: number): number {
    y = this.verificarSalto(doc, y, pageHeight, 24);
    doc.setTextColor(...this.C_PRIMARY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Analisis de cumplimiento (IA)', this.margin, y);
    y += 7;

    // Parseamos el markdown a bloques con estilo (parrafo, encabezado, viñeta...)
    const bloques = this.parsearMarkdown(analisisMd);

    for (const b of bloques) {
      switch (b.tipo) {
        case 'heading': {
          y = this.verificarSalto(doc, y, pageHeight, 12);
          doc.setTextColor(...this.C_PRIMARY);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          y = this.escribirParrafo(doc, b.texto, this.margin, y, usableWidth, pageHeight);
          y += 2;
          break;
        }
        case 'bullet': {
          doc.setTextColor(...this.C_TEXT);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          y = this.escribirBullet(doc, b.texto, y, usableWidth, pageHeight);
          break;
        }
        case 'separator': {
          y = this.verificarSalto(doc, y, pageHeight, 6);
          doc.setDrawColor(...this.C_SUBTLE_BORDER);
          doc.line(this.margin, y, this.margin + usableWidth, y);
          y += 4;
          break;
        }
        default: {
          doc.setTextColor(...this.C_TEXT);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          y = this.escribirParrafo(doc, b.texto, this.margin, y, usableWidth, pageHeight);
          y += 1.5;
        }
      }
    }

    return y;
  }

  private dibujarPies(doc: jsPDF, pageWidth: number, pageHeight: number): void {
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setDrawColor(...this.C_SUBTLE_BORDER);
      doc.line(this.margin, pageHeight - 12, pageWidth - this.margin, pageHeight - 12);

      doc.setTextColor(...this.C_MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('EcoMonitor  -  Calculo de huella de carbono segun la metodologia MITECO',
        this.margin, pageHeight - 7);
      doc.text(`Pagina ${i} de ${total}`, pageWidth - this.margin, pageHeight - 7, { align: 'right' });
    }
  }

  // --------------------------------------------------------------------
  // Helpers de texto
  // --------------------------------------------------------------------

  /** Escribe un párrafo con word-wrap (sin justificar). Devuelve la nueva 'y'. */
  private escribirParrafo(doc: jsPDF, texto: string, x: number, y: number, ancho: number, pageHeight: number): number {
    const lineas = doc.splitTextToSize(texto, ancho) as string[];
    for (const linea of lineas) {
      y = this.verificarSalto(doc, y, pageHeight);
      doc.text(linea, x, y, { align: 'left' });
      y += this.lineHeight;
    }
    return y;
  }

  /** Escribe una viñeta con sangría. */
  private escribirBullet(doc: jsPDF, texto: string, y: number, ancho: number, pageHeight: number): number {
    const indent = 5;
    const bulletX = this.margin;
    const textX  = this.margin + indent;
    const anchoText = ancho - indent;

    const lineas = doc.splitTextToSize(texto, anchoText) as string[];
    for (let i = 0; i < lineas.length; i++) {
      y = this.verificarSalto(doc, y, pageHeight);
      if (i === 0) doc.text('-', bulletX, y);
      doc.text(lineas[i], textX, y, { align: 'left' });
      y += this.lineHeight;
    }
    return y;
  }

  /** Si quedaría poco espacio, salta a una página nueva. */
  private verificarSalto(doc: jsPDF, y: number, pageHeight: number, extra = this.lineHeight): number {
    if (y + extra > pageHeight - 18) {
      doc.addPage();
      return this.margin;
    }
    return y;
  }

  private fecha(iso: string): string {
    return new Date(iso).toLocaleString('es-ES');
  }

  /** Color del veredicto, alineado con la paleta de la web. */
  private colorVeredicto(v: string): [number, number, number] {
    const upper = (v || '').toUpperCase();
    if (upper.includes('NO CUMPLE')) return [186, 26, 26];   // rojo error
    if (upper.includes('MEJORA'))    return [245, 159, 0];   // ámbar
    return this.C_PRIMARY;                                    // verde corporativo
  }

  // --------------------------------------------------------------------
  // Sanitización y parseo de texto
  // --------------------------------------------------------------------

  /**
   * Limpia un texto para que sea seguro en jsPDF con la fuente Helvetica
   * (Latin1): elimina caracteres Unicode problemáticos, separaciones
   * letra-a-letra y normaliza espacios.
   */
  private txt(s: string | undefined | null): string {
    if (!s) return '';
    let t = String(s);

    // 1) Caracteres Unicode tipográficos -> ASCII equivalente
    t = t
      .replace(/[‘’ʼ′]/g, "'")
      .replace(/[“”″]/g, '"')
      .replace(/[–—−]/g, '-')
      .replace(/[…]/g, '...')
      .replace(/[→➔]/g, '->')
      .replace(/[←]/g, '<-')
      .replace(/[•◦]/g, '-')
      .replace(/[≤]/g, '<=')
      .replace(/[≥]/g, '>=')
      .replace(/[²]/g, '2')
      .replace(/[³]/g, '3')
      // Espacios no-rompibles y similares
      .replace(/[    ]/g, ' ');

    // 2) Subíndice CO₂ -> CO2
    t = t.replace(/CO₂/g, 'CO2');

    // 3) Quita caracteres no representables (deja Latin1 + Latin Extended básico)
    t = t.replace(/[^\x09\x0A\x0D\x20-\x7E¡-ſ]/g, '');

    // 4) Normaliza espacios múltiples consecutivos
    t = t.replace(/ {2,}/g, ' ');

    return t;
  }

  /** Devuelve los bloques estructurados de un texto markdown. */
  private parsearMarkdown(md: string): Array<{ tipo: 'heading' | 'paragraph' | 'bullet' | 'separator'; texto: string }> {
    const limpio = this.txt(md.replace(/\r\n/g, '\n'));
    const lineas = limpio.split('\n');
    const bloques: Array<{ tipo: 'heading' | 'paragraph' | 'bullet' | 'separator'; texto: string }> = [];

    let buffer: string[] = [];
    const flush = () => {
      if (buffer.length) {
        const texto = this.quitarMarkdownInline(buffer.join(' ').trim());
        if (texto) bloques.push({ tipo: 'paragraph', texto });
        buffer = [];
      }
    };

    for (const lineaRaw of lineas) {
      const linea = lineaRaw.trimEnd();

      // Separador horizontal
      if (/^-{3,}$/.test(linea.trim())) {
        flush();
        bloques.push({ tipo: 'separator', texto: '' });
        continue;
      }

      // Encabezado markdown
      const headingMatch = linea.match(/^#{1,6}\s+(.+)$/);
      if (headingMatch) {
        flush();
        bloques.push({ tipo: 'heading', texto: this.quitarMarkdownInline(headingMatch[1]) });
        continue;
      }

      // Encabezado "1. Titulo" o "1) Titulo" en línea propia
      const numHeading = linea.match(/^(\d+)[.)]\s+(.+)$/);
      if (numHeading && /[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(numHeading[2]) && numHeading[2].length < 90) {
        flush();
        bloques.push({ tipo: 'heading', texto: this.quitarMarkdownInline(`${numHeading[1]}. ${numHeading[2]}`) });
        continue;
      }

      // Viñeta (- * +)
      const bulletMatch = linea.match(/^\s*[-*+]\s+(.+)$/);
      if (bulletMatch) {
        flush();
        bloques.push({ tipo: 'bullet', texto: this.quitarMarkdownInline(bulletMatch[1]) });
        continue;
      }

      // Línea en blanco -> cierra el párrafo en curso
      if (linea.trim() === '') {
        flush();
        continue;
      }

      // Línea normal -> sigue el párrafo
      buffer.push(linea.trim());
    }
    flush();

    return bloques;
  }

  /** Quita el formato markdown inline (negritas, cursivas, código). */
  private quitarMarkdownInline(t: string): string {
    return t
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/(?<!\*)\*(?!\*)([^*\n]+?)\*(?!\*)/g, '$1')
      .replace(/(?<!_)_(?!_)([^_\n]+?)_(?!_)/g, '$1')
      .replace(/`([^`\n]+?)`/g, '$1');
  }
}
