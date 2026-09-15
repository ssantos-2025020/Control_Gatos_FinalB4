import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Ingreso {
  id: string;
  descripcion: string;
  monto: number;
  fecha: string;
  createdAt?: string;
  updatedAt?: string;
  usuario?: {
    id: string;
    nombre: string;
    email: string;
    usuario?: string;
    color?: string;
    activo?: boolean;
  };
  categoria?: string;
  categoriaColor?: string;
  metodo?: 'Efectivo' | 'Tarjeta' | 'Transferencia';
}

export interface IngresoInput {
  descripcion: string;
  monto: number;
  fecha: string;
  categoria?: string;
  metodo?: string;
  usuarioId?: string;
}

export interface FiltroIngresos {
  search?: string;
  startDate?: string;
  endDate?: string;
}

@Injectable({ providedIn: 'root' })
export class IngresosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/ingresos`;

  /**
   * Devuelve los ingresos reales de la base de datos (el filtrado se aplica
   * en el servidor).
   */
  getIngresosCompletos(filters?: FiltroIngresos): Observable<Ingreso[]> {
    return this.getIngresos(filters);
  }

  getIngresos(filters?: FiltroIngresos): Observable<Ingreso[]> {
    let params = new HttpParams();
    if (filters) {
      if (filters.search) params = params.set('search', filters.search);
      if (filters.startDate) params = params.set('startDate', filters.startDate);
      if (filters.endDate) params = params.set('endDate', filters.endDate);
    }
    return this.http.get<Ingreso[]>(this.apiUrl, { params });
  }

  createIngreso(ingreso: IngresoInput): Observable<Ingreso> {
    return this.http.post<Ingreso>(this.apiUrl, ingreso);
  }

  updateIngreso(id: string, ingreso: Partial<IngresoInput>): Observable<Ingreso> {
    return this.http.put<Ingreso>(`${this.apiUrl}/${id}`, ingreso);
  }

  deleteIngreso(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}