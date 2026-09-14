import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type TipoPapelera = 'categorias' | 'gastos' | 'ingresos' | 'presupuestos';

export interface CategoriaPapelera {
  id: string;
  nombre: string;
  tipo: string;
  fechaEliminacion: string;
}

export interface GastoPapelera {
  id: string;
  descripcion: string;
  monto: number;
  fecha: string;
  categoria: string;
  fechaEliminacion: string;
}

export interface IngresoPapelera {
  id: string;
  descripcion: string;
  monto: number;
  fecha: string;
  categoria: string | null;
  fechaEliminacion: string;
}

export interface PresupuestoPapelera {
  id: string;
  categoria: string;
  mes: number;
  anio: number;
  monto: number;
  fechaEliminacion: string;
}

export interface PapeleraContenido {
  categorias: CategoriaPapelera[];
  gastos: GastoPapelera[];
  ingresos: IngresoPapelera[];
  presupuestos: PresupuestoPapelera[];
}

export interface ResultadoVaciar {
  message: string;
  categorias: number;
  gastos: number;
  ingresos: number;
  presupuestos: number;
}

@Injectable({ providedIn: 'root' })
export class PapeleraService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/papelera`;

  getPapelera(): Observable<PapeleraContenido> {
    return this.http.get<PapeleraContenido>(this.apiUrl);
  }

  restaurar(tipo: TipoPapelera, id: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/${tipo}/${id}/restaurar`, {});
  }

  restaurarTodo(tipo: TipoPapelera): Observable<{ message: string; restaurados: number; omitidos?: number }> {
    return this.http.post<{ message: string; restaurados: number; omitidos?: number }>(
      `${this.apiUrl}/restaurar-todo/${tipo}`,
      {}
    );
  }

  eliminarPermanente(tipo: TipoPapelera, id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${tipo}/${id}/permanente`);
  }

  vaciar(): Observable<ResultadoVaciar> {
    return this.http.delete<ResultadoVaciar>(`${this.apiUrl}/vaciar`);
  }
}