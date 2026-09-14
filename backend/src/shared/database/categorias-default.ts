export type TipoCategoria = 'INGRESO' | 'GASTO' | 'AMBAS';

/**
 * Catálogo inicial mínimo que recibe CADA cuenta nueva (y el administrador tras
 * la limpieza): pocas categorías esenciales. El resto las crea el propio usuario
 * desde la página de Categorías (nombre, descripción, color e ícono).
 *
 * - 4 de gasto (Comida, Transporte, Vivienda, Servicios)
 * - 1 de ingreso (Sueldo) para que la vista de Ingresos siempre tenga opciones
 * - 1 comodín "Otros" (AMBAS), categoría de respaldo de la reasignación
 */
export const CATEGORIAS_DEFAULT: { nombre: string; tipo: TipoCategoria }[] = [
  { nombre: 'Comida', tipo: 'GASTO' },
  { nombre: 'Transporte', tipo: 'GASTO' },
  { nombre: 'Vivienda', tipo: 'GASTO' },
  { nombre: 'Servicios', tipo: 'GASTO' },
  { nombre: 'Sueldo', tipo: 'INGRESO' },
  { nombre: 'Otros', tipo: 'AMBAS' },
];