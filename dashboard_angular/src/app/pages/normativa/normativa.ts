import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface PasoCertificacion {
  numero: string;
  icono: string;
  titulo: string;
  descripcion: string;
}

interface Requisito {
  /** Texto con HTML opcional para resaltar palabras clave con <strong>. */
  html: string;
}

interface Recurso {
  icono: string;
  iconoAccion: string;
  titulo: string;
  subtitulo: string;
  url: string;
}

@Component({
  selector: 'app-normativa',
  imports: [RouterLink],
  templateUrl: './normativa.html',
  styleUrl: './normativa.css'
})
export class Normativa {

  readonly pasos: PasoCertificacion[] = [
    {
      numero: '01',
      icono: 'calculate',
      titulo: 'Calcula',
      descripcion: 'Realiza el inventario completo de tus emisiones utilizando nuestras herramientas verificadas.'
    },
    {
      numero: '02',
      icono: 'description',
      titulo: 'Elabora',
      descripcion: 'Genera el plan de reducción de emisiones y la memoria técnica detallada según la normativa.'
    },
    {
      numero: '03',
      icono: 'how_to_reg',
      titulo: 'Inscríbete',
      descripcion: 'Accede al registro del MITECO y presenta toda la documentación recopilada.'
    },
    {
      numero: '04',
      icono: 'stars',
      titulo: 'Obtén',
      descripcion: 'Consigue el sello oficial que acredita tu compromiso con la descarbonización.'
    }
  ];

  readonly requisitos: Requisito[] = [
    { html: 'Calcular las emisiones de <strong>Alcance 1</strong> (directas) y <strong>Alcance 2</strong> (electricidad consumida).' },
    { html: 'Usar el <strong>factor de emisión oficial</strong> publicado por el MITECO para la electricidad.' },
    { html: 'Disponer de datos <strong>verificables y trazables</strong> del consumo energético.' },
    { html: 'Presentar un <strong>plan de reducción</strong> de emisiones con medidas concretas.' },
    { html: 'Renovar la inscripción <strong>anualmente</strong> para mantener el sello.' }
  ];

  readonly recursos: Recurso[] = [
    {
      icono: 'app_registration',
      iconoAccion: 'open_in_new',
      titulo: 'Acceso al Registro',
      subtitulo: 'Portal oficial MITECO',
      url: 'https://www.miteco.gob.es/es/cambio-climatico/temas/registro-huella.html'
    },
    {
      icono: 'picture_as_pdf',
      iconoAccion: 'download',
      titulo: 'Guía de Inscripción (PDF)',
      subtitulo: 'Manual completo MITECO',
      url: 'https://www.miteco.gob.es/content/dam/miteco/es/cambio-climatico/temas/mitigacion-politicas-y-medidas/guia_huella_carbono_tcm30-479093.pdf'
    },
    {
      icono: 'calculate',
      iconoAccion: 'table_view',
      titulo: 'Calculadoras Sectoriales',
      subtitulo: 'Herramientas Excel MITECO',
      url: 'https://www.miteco.gob.es/es/cambio-climatico/temas/mitigacion-politicas-y-medidas/calculadoras.html'
    }
  ];
}
