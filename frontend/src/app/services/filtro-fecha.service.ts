import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FiltroFechaService {
  // La app abre SIEMPRE en el mes real actual (calculado en tiempo de
  // ejecución); el selector permite navegar a cualquier otro mes.
  private now = new Date();

  mes = signal<number>(this.now.getMonth() + 1);
  anio = signal<number>(this.now.getFullYear());

  mesAnio = signal<string>(`${this.now.getFullYear()}-${String(this.now.getMonth() + 1).padStart(2, '0')}`);

  hoyIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Devuelve la fecha 'YYYY-MM-DD' en hora LOCAL (útil para fechas construidas localmente). */
  toYMDLocal(value: string | Date): string {
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /**
   * Devuelve la fecha 'YYYY-MM-DD' en UTC. Las fechas que vienen del backend
   * se guardan a medianoche UTC ('YYYY-MM-DDT00:00:00.000Z'), por lo que se
   * deben leer con getters UTC para que el día sea el mismo en todo huso.
   */
  toYMDUTC(value: string | Date): string {
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return '';
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }

  getLabelMes(): string {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${meses[this.mes() - 1]} ${this.anio()}`;
  }

  mesActualLabel(): string {
    return this.getLabelMes();
  }

  setMesAnio(mes: number, anio: number): void {
    this.mes.set(mes);
    this.anio.set(anio);
    this.mesAnio.set(`${anio}-${String(mes).padStart(2, '0')}`);
  }
}
