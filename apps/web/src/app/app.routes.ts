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
  {
    path: 'gardens',
    canActivate: [authGuard],
    loadComponent: () => import('./gardens/garden-list.page').then((m) => m.GardenListPage),
  },
  {
    path: 'gardens/:id/reminders',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./gardens/garden-reminders.page').then((m) => m.GardenRemindersPage),
  },
  {
    path: 'gardens/:id/calendar',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./gardens/garden-calendar.page').then((m) => m.GardenCalendarPage),
  },
  {
    path: 'gardens/:id/plantings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./gardens/garden-plantings.page').then((m) => m.GardenPlantingsPage),
  },
  {
    path: 'gardens/:id/layout',
    canActivate: [authGuard],
    loadComponent: () => import('./gardens/garden-layout.page').then((m) => m.GardenLayoutPage),
  },
  {
    path: 'gardens/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./gardens/garden-detail.page').then((m) => m.GardenDetailPage),
  },
];
