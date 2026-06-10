import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/welcome/welcome').then(m => m.Welcome),
    title: 'EcoMonitor · Inicio'
  },
  {
    path: 'huella',
    loadComponent: () => import('./pages/que-es-huella/que-es-huella').then(m => m.QueEsHuella),
    title: '¿Qué es la huella de carbono?'
  },
  {
    path: 'normativa',
    loadComponent: () => import('./pages/normativa/normativa').then(m => m.Normativa),
    title: 'Normativa del Gobierno'
  },
  {
    path: 'prueba',
    loadComponent: () => import('./pages/prueba/prueba').then(m => m.Prueba),
    title: 'Realiza tu prueba'
  },
  { path: '**', redirectTo: '' }
];
