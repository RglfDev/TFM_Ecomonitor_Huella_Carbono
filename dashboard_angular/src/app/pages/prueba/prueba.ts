import { Component, computed, inject, signal } from '@angular/core';
import { forkJoin, timer } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';

import { CarbonService } from '../../core/services/carbon';
import { DatosEmpresaService } from '../../core/services/datos-empresa';
import { mensajeErrorHttp } from '../../core/services/http-error';
import { AnalysisResult, tieneDatos } from '../../core/models/analysis-result';
import { Device } from '../../core/models/device';
import { DatosEmpresa } from '../../core/models/datos-empresa';
import { DataCollectionAnimation } from './data-collection-animation/data-collection-animation';
import { AnalysisResultView } from '../../shared/analysis-result-view/analysis-result-view';

/** Tiempo mínimo (ms) que se muestra la animación, aunque la respuesta llegue antes. */
const MIN_ANIMACION_MS = 3000;

/** Identificador de los 3 modos de prueba (mapean a 'source' del backend). */
type TabKey = 'sim' | 'ok' | 'ko';

/** Información estática que se muestra para cada tab. */
interface TabInfo {
  key: TabKey;
  tabLabel: string;
  titulo: string;
  descripcion: string;
  features: string[];
  imagen: string;
  origenLabel: string;
}

@Component({
  selector: 'app-prueba',
  imports: [DataCollectionAnimation, AnalysisResultView],
  templateUrl: './prueba.html',
  styleUrl: './prueba.css'
})
export class Prueba {
  readonly datosEmpresa = inject(DatosEmpresaService);
  private readonly carbon = inject(CarbonService);

  // Estado del flujo (formulario → pruebas)
  readonly paso = signal<'formulario' | 'pruebas'>('formulario');

  // Tab activa dentro de la sección de pruebas
  readonly tabActiva = signal<TabKey>('sim');

  // Dispositivos detectados (solo relevante para 'sim')
  readonly dispositivos = signal<Device[]>([]);
  readonly cargandoDispositivos = signal(false);

  // Estado del análisis (compartido por todas las tabs, se resetea al cambiar)
  readonly ejecutando = signal(false);
  readonly resultado = signal<AnalysisResult | null>(null);
  readonly datosUsados = signal<DatosEmpresa | null>(null);
  readonly sinDatos = signal(false);
  readonly error = signal<string | null>(null);

  // Información estática de cada tab
  readonly tabs: TabInfo[] = [
    {
      key: 'sim',
      tabLabel: 'Simulación',
      titulo: 'Simulación Controlada',
      descripcion: 'Análisis sobre los datos reales que están enviando los equipos simulados ' +
                   '(PC 1, PC 2…). Ideal para validar el pipeline antes de una auditoría oficial.',
      features: [
        'Lecturas auténticas desde IoT Hub',
        'Cálculo de CO₂ con el factor MITECO',
        'Veredicto y recomendaciones generadas por IA'
      ],
      imagen: '/img/prueba_simulacion.png',
      origenLabel: 'Simulación'
    },
    {
      key: 'ok',
      tabLabel: 'Prueba Favorable',
      titulo: 'Diagnóstico Favorable',
      descripcion: 'Genera un escenario con consumos eficientes y propios de una oficina verde. ' +
                   'Sirve para mostrar cómo se ve un informe que CUMPLE la normativa.',
      features: [
        'Lote de datos aislado del histórico',
        'Consumo bajo, equipos eficientes',
        'Resultado esperado: CUMPLE'
      ],
      imagen: '/img/prueba_pass.png',
      origenLabel: 'Escenario favorable'
    },
    {
      key: 'ko',
      tabLabel: 'Prueba Fallida',
      titulo: 'Prueba de Estrés',
      descripcion: 'Genera un escenario con consumos desmesurados, propios de un entorno ' +
                   'ineficiente. Sirve para mostrar cómo se ve un informe que NO CUMPLE.',
      features: [
        'Lote de datos aislado del histórico',
        'Consumo alto, equipos ineficientes',
        'Resultado esperado: NO CUMPLE'
      ],
      imagen: '/img/prueba_fallida.png',
      origenLabel: 'Escenario desfavorable'
    }
  ];

  // Tab actualmente seleccionada
  readonly tabActual = computed(() =>
    this.tabs.find(t => t.key === this.tabActiva())!);

  // -----------------------------------------------------------------
  // Paso 1 → Paso 2 (formulario → pruebas)
  // -----------------------------------------------------------------
  siguiente(): void {
    if (!this.datosEmpresa.valido()) return;
    this.paso.set('pruebas');
    this.cargarDispositivosSiCorresponde();
  }

  volverAlFormulario(): void {
    this.paso.set('formulario');
    this.limpiarResultado();
  }

  // Helpers para los inputs (escribe en los signals del servicio)
  set(signalRef: { set: (v: string) => void }, event: Event): void {
    signalRef.set((event.target as HTMLInputElement).value);
  }

  setAcepta(event: Event): void {
    this.datosEmpresa.acepta.set((event.target as HTMLInputElement).checked);
  }

  // -----------------------------------------------------------------
  // Tabs
  // -----------------------------------------------------------------
  cambiarTab(key: TabKey): void {
    if (this.tabActiva() === key) return;
    this.tabActiva.set(key);
    this.limpiarResultado();
    this.cargarDispositivosSiCorresponde();
  }

  private cargarDispositivosSiCorresponde(): void {
    if (this.tabActiva() !== 'sim') return;
    this.cargarDispositivos();
  }

  cargarDispositivos(): void {
    this.cargandoDispositivos.set(true);
    this.carbon.obtenerDispositivos('sim')
      .pipe(finalize(() => this.cargandoDispositivos.set(false)))
      .subscribe({
        next: (devs) => this.dispositivos.set(devs),
        error: () => this.dispositivos.set([])
      });
  }

  // -----------------------------------------------------------------
  // Iniciar prueba
  // -----------------------------------------------------------------
  iniciarPrueba(): void {
    if (this.ejecutando()) return;

    const tab = this.tabActual();
    this.ejecutando.set(true);
    this.resultado.set(null);
    this.datosUsados.set(this.datosEmpresa.snapshot());
    this.sinDatos.set(false);
    this.error.set(null);

    // Simulación → analizar directamente
    // Favorable/Fallida → primero sembrar el escenario y luego analizar
    const flujo$ = tab.key === 'sim'
      ? forkJoin({
          respuesta: this.carbon.analizar('sim'),
          _espera: timer(MIN_ANIMACION_MS)
        })
      : this.carbon.sembrarEscenario(tab.key).pipe(
          switchMap(() => forkJoin({
            respuesta: this.carbon.analizar(tab.key),
            _espera: timer(MIN_ANIMACION_MS)
          }))
        );

    flujo$
      .pipe(finalize(() => this.ejecutando.set(false)))
      .subscribe({
        next: ({ respuesta }) =>
          tieneDatos(respuesta) ? this.resultado.set(respuesta) : this.sinDatos.set(true),
        error: (err) => this.error.set(mensajeErrorHttp(err))
      });
  }

  private limpiarResultado(): void {
    this.resultado.set(null);
    this.datosUsados.set(null);
    this.sinDatos.set(false);
    this.error.set(null);
  }

  // -----------------------------------------------------------------
  // Helpers para el template
  // -----------------------------------------------------------------
  hora(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-ES');
  }
}
