import { Component, input } from '@angular/core';

/**
 * Animación reutilizable que se muestra mientras se recopilan los datos
 * y se genera el informe con IA. Puramente visual.
 */
@Component({
  selector: 'app-data-collection-animation',
  templateUrl: './data-collection-animation.html',
  styleUrl: './data-collection-animation.css'
})
export class DataCollectionAnimation {
  /** Texto que se muestra bajo la animación. */
  mensaje = input('Recopilando datos y generando el informe…');
}
