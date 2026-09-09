import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'ingresos',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/ingresos/ingresos.component').then((m) => m.IngresosComponent),
  },
  // Secciones aún no migradas: se mostrarán Próximamente.
  {
    path: 'gastos',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/gastos/gastos.component').then((m) => m.GastosComponent),
  },
  {
    path: 'movimientos',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/movimientos/movimientos.component').then((m) => m.MovimientosComponent),
  },
  {
    path: 'presupuestos',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/presupuestos/presupuestos.component').then((m) => m.PresupuestosComponent),
  },
  {
    path: 'categorias',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/categorias/categorias.component').then((m) => m.CategoriasComponent),
  },
  {
    path: 'reportes',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/reportes/reportes.component').then((m) => m.ReportesComponent),
  },
  {
    path: 'usuarios',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/proximamente/proximamente.component').then((m) => m.ProximamenteComponent),
    data: { titulo: 'Usuarios', descripcion: 'Administra usuarios, roles y accesos al sistema.', icono: 'users' },
  },
  {
    path: 'configuracion',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/configuracion/configuracion.component').then((m) => m.ConfiguracionComponent),
  },
  { path: '**', redirectTo: 'dashboard' },
];