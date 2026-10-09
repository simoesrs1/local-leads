import { Routes } from '@angular/router';

/** Pages are lazy-loaded so the globe (d3-geo + map data) only downloads on the home page. */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'search',
    loadComponent: () =>
      import('./components/lead-finder/lead-finder.component').then((m) => m.LeadFinderComponent),
  },
  {
    path: 'templates',
    loadComponent: () =>
      import('./components/templates/templates.component').then((m) => m.TemplatesComponent),
  },
  {
    path: 'history',
    loadComponent: () =>
      import('./components/history/history.component').then((m) => m.HistoryComponent),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./components/settings/settings.component').then((m) => m.SettingsComponent),
  },
  { path: '**', redirectTo: '' },
];
