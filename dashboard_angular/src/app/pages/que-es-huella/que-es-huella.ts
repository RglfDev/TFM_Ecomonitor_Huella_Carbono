import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Paso {
  numero: string;
  icono: string;
  titulo: string;
  descripcion: string;
}

@Component({
  selector: 'app-que-es-huella',
  imports: [RouterLink],
  templateUrl: './que-es-huella.html',
  styleUrl: './que-es-huella.css'
})
export class QueEsHuella {
  readonly pasos: Paso[] = [
    {
      numero: '01',
      icono: 'computer',
      titulo: 'Captura',
      descripcion: 'Tus equipos miden su consumo'
    },
    {
      numero: '02',
      icono: 'cloud_sync',
      titulo: 'Análisis',
      descripcion: 'La nube procesa y calcula el CO₂'
    },
    {
      numero: '03',
      icono: 'verified',
      titulo: 'Reporte',
      descripcion: 'Obtienes tu resultado y certificado'
    }
  ];
}
