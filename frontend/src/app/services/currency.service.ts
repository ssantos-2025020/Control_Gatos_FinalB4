import { Injectable, signal } from '@angular/core';

const MONEDA_KEY = 'cg_moneda';
const NUMERO_KEY = 'cg_formato_numero';
const POSICION_KEY = 'cg_pos_simbolo';

interface MonedaInfo {
  id: string;
  nombre: string;
  simbolo: string;
  tasa: number; // tasa respecto a USD
}

type FormatoNumero = 'latam' | 'en';
type PosicionSimbolo = 'antes' | 'despues';

@Injectable({ providedIn: 'root' })
export class CurrencyService {
  // Tasas de cambio (USD = 1.0, las demás son cuántos de esa moneda valen 1 USD)
  private readonly rates: { [key: string]: MonedaInfo } = {
    USD: { id: 'USD', nombre: 'Dólar estadounidense',     simbolo: '$',   tasa: 1 },
    EUR: { id: 'EUR', nombre: 'Euro',                     simbolo: '€',   tasa: 0.92 },
    GBP: { id: 'GBP', nombre: 'Libra esterlina',          simbolo: '£',   tasa: 0.79 },
    MXN: { id: 'MXN', nombre: 'Peso mexicano',            simbolo: '$',   tasa: 17.15 },
    GTQ: { id: 'GTQ', nombre: 'Quetzal guatemalteco',     simbolo: 'Q',   tasa: 7.75 },
    PEN: { id: 'PEN', nombre: 'Sol peruano',               simbolo: 'S/',  tasa: 3.73 },
    COP: { id: 'COP', nombre: 'Peso colombiano',           simbolo: '$',   tasa: 3950 },
    ARS: { id: 'ARS', nombre: 'Peso argentino',            simbolo: '$',   tasa: 950 },
    CLP: { id: 'CLP', nombre: 'Peso chileno',              simbolo: '$',   tasa: 920 },
    BRL: { id: 'BRL', nombre: 'Real brasileño',            simbolo: 'R$',  tasa: 4.97 },
    JPY: { id: 'JPY', nombre: 'Yen japonés',               simbolo: '¥',   tasa: 149.5 },
    CNY: { id: 'CNY', nombre: 'Yuan chino',                simbolo: '¥',   tasa: 7.24 },
    KRW: { id: 'KRW', nombre: 'Won surcoreano',            simbolo: '₩',   tasa: 1320 },
    CAD: { id: 'CAD', nombre: 'Dólar canadiense',          simbolo: 'CA$', tasa: 1.36 },
    AUD: { id: 'AUD', nombre: 'Dólar australiano',         simbolo: 'A$',  tasa: 1.53 },
    CHF: { id: 'CHF', nombre: 'Franco suizo',              simbolo: 'Fr',  tasa: 0.88 },
  };

  monedaActual = signal<string>(this.getMoneda());
  formatoNumero = signal<FormatoNumero>(this.getFormatoNumero());
  posicionSimbolo = signal<PosicionSimbolo>(this.getPosicionSimbolo());

  getMoneda(): string {
    return localStorage.getItem(MONEDA_KEY) ?? 'USD';
  }

  setMoneda(codigo: string): void {
    localStorage.setItem(MONEDA_KEY, codigo);
    this.monedaActual.set(codigo);
  }

  getFormatoNumero(): FormatoNumero {
    return localStorage.getItem(NUMERO_KEY) === 'en' ? 'en' : 'latam';
  }

  setFormatoNumero(formato: FormatoNumero): void {
    localStorage.setItem(NUMERO_KEY, formato);
    this.formatoNumero.set(formato);
  }

  getPosicionSimbolo(): PosicionSimbolo {
    return localStorage.getItem(POSICION_KEY) === 'despues' ? 'despues' : 'antes';
  }

  setPosicionSimbolo(posicion: PosicionSimbolo): void {
    localStorage.setItem(POSICION_KEY, posicion);
    this.posicionSimbolo.set(posicion);
  }

  getSimbolo(codigo?: string): string {
    return this.rates[codigo ?? this.getMoneda()]?.simbolo ?? '$';
  }

  getNombre(codigo: string): string {
    return this.rates[codigo]?.nombre ?? codigo;
  }

  getTodasLasMonedas(): MonedaInfo[] {
    return Object.values(this.rates);
  }

  convertir(montoEnUSD: number, monedaDestino?: string): number {
    const dest = monedaDestino ?? this.getMoneda();
    const tasa = this.rates[dest]?.tasa ?? 1;
    return montoEnUSD * tasa;
  }

  /** Número de decimales según la magnitud del tipo de cambio (monedas con tasas muy altas no usan decimales). */
  private decimalesDe(monedaDestino?: string): number {
    const dest = monedaDestino ?? this.getMoneda();
    const info = this.rates[dest];
    if (!info) return 2;
    return [100, 1000, 10000].some((e) => info.tasa > e) ? 0 : 2;
  }

  /** Formatea una cantidad ya convertida a la moneda objetivo (sin volver a convertir). */
  formatearValor(valor: number, decimales = 2): string {
    if (!Number.isFinite(valor)) return '—';
    const num = valor.toLocaleString(this.formatoNumero() === 'en' ? 'en-US' : 'es-VE', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    });
    const simbolo = this.getSimbolo();
    return this.posicionSimbolo() === 'despues' ? `${num} ${simbolo}` : `${simbolo}${num}`;
  }

  formatear(montoEnUSD: number, monedaDestino?: string): string {
    const dest = monedaDestino ?? this.getMoneda();
    const info = this.rates[dest];
    const convertido = this.convertir(montoEnUSD, dest);

    if (!info) return `${this.getSimbolo(dest)}${convertido.toFixed(2)}`;

    return this.formatearValor(convertido, this.decimalesDe(dest));
  }
}