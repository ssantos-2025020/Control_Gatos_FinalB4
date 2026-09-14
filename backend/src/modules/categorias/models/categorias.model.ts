export type TipoCategoria = 'INGRESO' | 'GASTO' | 'AMBAS';

export interface CreateCategoriaDTO {
  nombre: string;
  tipo?: TipoCategoria;
}

export interface UpdateCategoriaDTO {
  nombre?: string;
  tipo?: TipoCategoria;
}