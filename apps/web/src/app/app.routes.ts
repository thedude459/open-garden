import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'plants' },
  {
    path: 'login',
    loadComponent: () => import('./auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'plants',
    canActivate: [authGuard],
    loadComponent: () => import('./plants/plant-list.page').then((m) => m.PlantListPage),
  },
  {
    path: 'plants/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./plants/plant-detail.page').then((m) => m.PlantDetailPage),
  },
  {
    path: 'favorites',
    canActivate: [authGuard],
    loadComponent: () => import('./favorites/favorites-list.page').then((m) => m.FavoritesListPage),
  },
];
