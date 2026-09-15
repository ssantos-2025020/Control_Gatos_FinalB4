/**
 * Normaliza separadores de miles y decimales ('.' y ',') hacia el formato
 * en-US que usan los inputs (solo dígitos y un punto decimal final).
 * Soporta tanto en-US ("1,234.56" o "1.234.567") como latam ("1.234,56" o
 * "12,50") y permite cantidades grandes con separadores de miles.
 *
 * Regla de desambiguación: el ÚLTIMO separador seguido de 0 a 2 dígitos es el
 * decimal (incluye el decimal "a medias" mientras se teclea: "12.", "12,").
 * Cualquier otro separador se interpreta como separador de miles y se ignora.
 */
export function normalizarSeparadores(valor: string): string {
  let limpio = String(valor ?? '').replace(/[^\d.,]/g, '');
  if (!limpio) return '';

  const ultimoSep = Math.max(limpio.lastIndexOf('.'), limpio.lastIndexOf(','));
  if (ultimoSep !== -1) {
    const trasSep = limpio.slice(ultimoSep + 1);
    const esDecimal = trasSep.length <= 2; // 0, 1 o 2 dígitos tras el separador
    if (esDecimal) {
      const entera = limpio.slice(0, ultimoSep).replace(/[.,]/g, '');
      return trasSep ? `${entera}.${trasSep}` : `${entera}.`;
    }
    // Sin decimal: todos los separadores son de miles.
    return limpio.replace(/[.,]/g, '');
  }
  return limpio;
}

/** Convierte un texto de monto (cualquier formato de separadores) a número. */
export function montoDesdeTexto(valor: string | number | null | undefined): number {
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return valor;
  }
  const limpio = normalizarSeparadores(String(valor ?? '').trim());
  if (!limpio) return 0;
  const n = parseFloat(limpio);
  return Number.isFinite(n) ? n : 0;
}