import { Injectable, computed, signal } from '@angular/core';
import { DatosEmpresa } from '../models/datos-empresa';

/**
 * Estado compartido con los datos de la empresa que se rellenan en la página de prueba.
 * Lo usan todos los generadores de informe (simulación y escenarios).
 *
 * El campo 'acepta' (consentimiento) es obligatorio para poder generar, pero NO forma
 * parte de los datos del informe: solo actúa como requisito.
 */
@Injectable({ providedIn: 'root' })
export class DatosEmpresaService {
  readonly empresa     = signal('');
  readonly telefono    = signal('');
  readonly responsable = signal('');
  readonly email       = signal('');
  readonly acepta      = signal(false);

  readonly emailValido = computed(() =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim()));

  /** True solo si los 4 campos están completos, el email es válido y se acepta el consentimiento. */
  readonly valido = computed(() =>
    this.empresa().trim().length > 0 &&
    this.telefono().trim().length > 0 &&
    this.responsable().trim().length > 0 &&
    this.emailValido() &&
    this.acepta());

  /** Copia de los 4 datos (sin el consentimiento) en el momento de generar el informe. */
  snapshot(): DatosEmpresa {
    return {
      empresa:     this.empresa().trim(),
      telefono:    this.telefono().trim(),
      responsable: this.responsable().trim(),
      email:       this.email().trim()
    };
  }
}
