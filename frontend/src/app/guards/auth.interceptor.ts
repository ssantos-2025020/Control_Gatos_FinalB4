import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.token;

  if (token) {
    req = req.clone({
      setHeaders: { 
        Authorization: `Bearer ${token}`,
        'X-User-Role': authService.getUsuario()?.role || 'USER',
      },
    });
  }

  return next(req).pipe(
    catchError((error) => {
      if (error?.status === 401 && !req.url.includes('/auth/login')) {
        authService.cerrarSesion();
        authService.sesionExpirada.set('Tu sesión ha expirado. Vuelve a iniciar sesión.');
      }
      return throwError(() => error);
    }),
  );
};
