import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Categoria {
  id: string;
  nombre: string;
  createdAt?: string;
  updatedAt?: string;
  color?: string;
  icono?: string;
  descripcion?: string;
}

/* ─── Paleta base única por categoría de gasto ───
   Es el fallback central cuando una categoría aún no tiene color personalizado.
   TODAS las pantallas (Dashboard, Gastos, Presupuestos, Categorías, Reportes)
   resuelven el color a través de CategoriasService.colorDeCategoria() desde esta
   MISMA fuente; nunca se define un color por categoría dentro de un componente. */
export const CATEGORIA_COLORES_BASE: { [key: string]: string } = {
  Alimentacion: '#1268ff',
  Transporte: '#00b9e8',
  Vivienda: '#7228e8',
  'Servicios Publicos': '#ff6b9d',
  Comunicaciones: '#00e7a8',
  Salud: '#ffa500',
  Educacion: '#6ea8ff',
  Entretenimiento: '#c084fc',
  'Ropa y Calzado': '#fbbf24',
  Compras: '#00d0a8',
  Viajes: '#ff6b9d',
  Mascotas: '#a855f7',
  Seguros: '#1268ff',
  Impuestos: '#00b9e8',
  'Ahorro e Inversion': '#00e7a8',
  Otros: '#fbbf24',
  'Sin categoría': '#94a3b8',
};

// Misma clave (y formato) que la página de Categorías usa para persistir la
// preferencia visual de cada categoría (color, ícono, descripción, estado).
export const CATEGORIA_COLORES_PREFS_KEY = 'cg_categorias_visual';

interface CatPref {
  color?: string;
  icono?: string;
  descripcion?: string;
  estado?: 'Activa' | 'Inactiva';
}

@Injectable({ providedIn: 'root' })
export class CategoriasService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/categorias`;

  private categoriasCache = signal<Categoria[]>([]);

  /**
   * Devuelve las categorías reales de la base de datos.
   */
  getCategoriasCompletas(): Observable<Categoria[]> {
    return this.getCategorias();
  }

  getCategorias(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(this.apiUrl).pipe(
      tap((list) => this.categoriasCache.set(list))
    );
  }

  createCategoria(nombre: string): Observable<Categoria> {
    return this.http.post<Categoria>(this.apiUrl, { nombre });
  }

  updateCategoria(id: string, nombre: string): Observable<Categoria> {
    return this.http.put<Categoria>(`${this.apiUrl}/${id}`, { nombre });
  }

  deleteCategoria(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  /* ─── Fuente única de color por categoría ─── */
  private static leerPrefs(): { [id: string]: CatPref } {
    try {
      return JSON.parse(localStorage.getItem(CATEGORIA_COLORES_PREFS_KEY) ?? '{}') as { [id: string]: CatPref };
    } catch {
      return {};
    }
  }

  /**
   * Color de una categoría. Orden de resolución:
   *  1. Preferencia guardada desde la página de Categorías (localStorage).
   *  2. Color real en BD (si la categoría lo trae).
   *  3. Paleta base única del sistema.
   */
  colorDeCategoria(nombre: string): string {
    const n = (nombre || '').trim().toLowerCase();
    const cat = this.categoriasCache().find((c) => (c.nombre || '').trim().toLowerCase() === n);
    const prefCol = cat ? CategoriasService.leerPrefs()[cat.id]?.color : undefined;
    if (prefCol) return prefCol;
    if (cat?.color) return cat.color;
    const exact = Object.keys(CATEGORIA_COLORES_BASE).find((k) => k.toLowerCase() === n);
    return exact ? CATEGORIA_COLORES_BASE[exact] : '#fbbf24';
  }

  /** Guarda la preferencia de color (la misma fuente que lee la página de Categorías). */
  setColorCategoria(id: string, color: string): void {
    const prefs = CategoriasService.leerPrefs();
    prefs[id] = { ...(prefs[id] ?? {}), color };
    localStorage.setItem(CATEGORIA_COLORES_PREFS_KEY, JSON.stringify(prefs));
  }
}