import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard funcional: protege las rutas internas redirigiendo al login
 * si no existe una sesión válida (token presente).
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};

/**
 * Guard funcional: permite acceso solo a ADMIN para páginas restringidas
 * Redirige a dashboard si es USER regular
 */
export const adminOnlyGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.getUsuario()?.role === 'ADMIN') {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};
