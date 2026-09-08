import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Categoria } from './categorias.service';

export interface Gasto {
  id: string;
  descripcion: string;
  monto: number;
  fecha: string;
  createdAt?: string;
  updatedAt?: string;
  categoriaId: string;
  categoria: Categoria;
  usuario?: {
    id: string;
    nombre: string;
    email: string;
    usuario?: string;
    color?: string;
    activo?: boolean;
  };
  metodo?: 'Efectivo' | 'Tarjeta' | 'Transferencia';
}

export interface GastoInput {
  descripcion: string;
  monto: number;
  fecha: string;
  categoriaId: string;
  metodo?: 'Efectivo' | 'Tarjeta' | 'Transferencia';
}

export interface FiltroGastos {
  categoryId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

@Injectable({ providedIn: 'root' })
export class GastosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/gastos`;

  /**
   * Devuelve los gastos reales de la base de datos (el filtrado se aplica
   * en el servidor).
   */
  getGastosCompletos(filters?: FiltroGastos): Observable<Gasto[]> {
    return this.getGastos(filters);
  }

  getGastos(filters?: FiltroGastos): Observable<Gasto[]> {
    let params = new HttpParams();
    if (filters) {
      if (filters.categoryId) params = params.set('categoryId', filters.categoryId);
      if (filters.search) params = params.set('search', filters.search);
      if (filters.startDate) params = params.set('startDate', filters.startDate);
      if (filters.endDate) params = params.set('endDate', filters.endDate);
    }
    return this.http.get<Gasto[]>(this.apiUrl, { params });
  }

  getGastoById(id: string): Observable<Gasto> {
    return this.http.get<Gasto>(`${this.apiUrl}/${id}`);
  }

  createGasto(gasto: GastoInput): Observable<Gasto> {
    return this.http.post<Gasto>(this.apiUrl, gasto);
  }

  updateGasto(id: string, gasto: Partial<GastoInput>): Observable<Gasto> {
    return this.http.put<Gasto>(`${this.apiUrl}/${id}`, gasto);
  }

  deleteGasto(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}