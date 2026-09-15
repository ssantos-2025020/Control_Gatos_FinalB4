/**
 * Normaliza separadores de miles y decimales ('.' y ',') hacia el formato
 * en-US que usan los inputs (solo dígitos y un punto decimal final).
 * Soporta tanto en-US ("1,234.56") como latam ("1.234,56" o "12,50").
 */
export function normalizarSeparadores(valor: string): string {
  let limpio = String(valor ?? '').replace(/[^\d.,]/g, '');
  const ultimoPunto = limpio.lastIndexOf('.');
  const ultimaComa = limpio.lastIndexOf(',');
  if (ultimoPunto !== -1 && ultimaComa !== -1) {
    // El último separador es el decimal; el otro es de miles.
    if (ultimoPunto > ultimaComa) {
      limpio = limpio.replace(/,/g, '');
    } else {
      limpio = limpio.replace(/\./g, '').replace(',', '.');
    }
  } else if (ultimaComa !== -1) {
    // Solo comas: se trata como separador decimal (estilo latam).
    limpio = limpio.replace(/,/g, '.');
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