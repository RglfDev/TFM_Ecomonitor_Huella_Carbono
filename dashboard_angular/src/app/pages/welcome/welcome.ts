import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface FeatureCard {
  icon: string;
  titulo: string;
  texto: string;
  enlace: string;
  cta: string;
  /** Si es true, la tarjeta se renderiza en verde corporativo (destacada). */
  destacada: boolean;
}

interface Estandar {
  icono: string;
  nombre: string;
}

@Component({
  selector: 'app-welcome',
  imports: [RouterLink],
  templateUrl: './welcome.html',
  styleUrl: './welcome.css'
})
export class Welcome {
  readonly features: FeatureCard[] = [
    {
      icon: 'query_stats',
      titulo: '¿Qué es la huella?',
      texto: 'Entiende el rastro de gases de efecto invernadero y cómo impacta en tu entorno operativo.',
      enlace: '/huella',
      cta: 'Ver más',
      destacada: false
    },
    {
      icon: 'gavel',
      titulo: 'Normativa',
      texto: 'Mantente al día con el Marco Estratégico de Energía y Clima y las obligaciones legales vigentes.',
      enlace: '/normativa',
      cta: 'Ver más',
      destacada: false
    },
    {
      icon: 'rocket_launch',
      titulo: 'Realiza tu prueba',
      texto: 'Calcula tu huella de carbono en minutos con nuestra interfaz guiada paso a paso.',
      enlace: '/prueba',
      cta: 'Empezar ahora',
      destacada: true
    }
  ];

  readonly estandares: Estandar[] = [
    { icono: 'policy',    nombre: 'MITECO' },
    { icono: 'analytics', nombre: 'GHG Protocol' }
  ];
}
