import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Presupuesto {
  id: string;
  categoriaId: string;
  nombre: string;
  monto: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Servicio nuevo para el módulo real de presupuestos del backend.
 * Los mismos datos se usan en el widget "Presupuestos" del dashboard.
 */
@Injectable({ providedIn: 'root' })
export class PresupuestosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/presupuestos`;

  getPresupuestos(): Observable<Presupuesto[]> {
    return this.http.get<Presupuesto[]>(this.apiUrl);
  }

  createPresupuesto(categoriaId: string, monto: number): Observable<Presupuesto> {
    return this.http.post<Presupuesto>(this.apiUrl, { categoriaId, monto });
  }

  updateMonto(id: string, monto: number): Observable<Presupuesto> {
    return this.http.put<Presupuesto>(`${this.apiUrl}/${id}`, { monto });
  }

  deletePresupuesto(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}