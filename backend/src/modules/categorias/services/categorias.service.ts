import { query, withTransaction } from '../../../shared/database/database.service';
import { CreateCategoriaDTO, UpdateCategoriaDTO, TipoCategoria } from '../models/categorias.model';

interface CategoriaRow {
  id: string;
  usuarioId: string;
  nombre: string;
  tipo: TipoCategoria;
  createdAt: Date;
  updatedAt: Date;
}

export interface Categoria {
  id: string;
  usuarioId: string;
  nombre: string;
  tipo: TipoCategoria;
  createdAt: string;
  updatedAt: string;
}

function aIso(valor: Date | string | undefined | null): string {
  if (valor instanceof Date) {
    return valor.toISOString();
  }
  return String(valor ?? '');
}

function aCategoria(fila: CategoriaRow): Categoria {
  return {
    id: fila.id,
    usuarioId: fila.usuarioId,
    nombre: fila.nombre,
    tipo: fila.tipo,
    createdAt: aIso(fila.createdAt),
    updatedAt: aIso(fila.updatedAt),
  };
}

const SELECT_BASE = `
  SELECT id, "usuarioId", nombre, tipo, "createdAt", "updatedAt" FROM categorias
`;

function validarTipo(tipo: string | undefined): TipoCategoria {
  if (tipo === undefined || tipo === null || tipo === '') return 'AMBAS';
  if (tipo === 'INGRESO' || tipo === 'GASTO' || tipo === 'AMBAS') return tipo;
  throw new Error('El tipo de categoría debe ser INGRESO, GASTO o AMBAS.');
}

/**
 * Error de dominio para una categoría inexistente o de otro usuario.
 */
export class CategoriaNotFoundError extends Error {
  constructor() {
    super('Categoría no encontrada.');
    this.name = 'CategoriaNotFoundError';
  }
}

class CategoriasService {
  public async getCategorias(userId: string): Promise<Categoria[]> {
    const filas = await query<CategoriaRow>(
      `${SELECT_BASE} WHERE "usuarioId" = $1 AND "deletedAt" IS NULL ORDER BY nombre ASC`,
      [userId],
    );
    return filas.map(aCategoria);
  }

  public async getCategoriaById(id: string, userId: string): Promise<Categoria | null> {
    const filas = await query<CategoriaRow>(
      `${SELECT_BASE} WHERE id = $1 AND "usuarioId" = $2 AND "deletedAt" IS NULL`,
      [id, userId],
    );
    return filas[0] ? aCategoria(filas[0]) : null;
  }

  public async createCategoria(userId: string, data: CreateCategoriaDTO): Promise<Categoria> {
    const tipo = validarTipo(data.tipo);
    const filas = await query<CategoriaRow>(
      `INSERT INTO categorias (id, "usuarioId", nombre, tipo, "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, now(), now())
       ON CONFLICT ("usuarioId", nombre) WHERE "deletedAt" IS NULL DO NOTHING
       RETURNING id, "usuarioId", nombre, tipo, "createdAt", "updatedAt"`,
      [userId, data.nombre, tipo],
    );

    if (!filas[0]) {
      const existente = await query<CategoriaRow>(
        `${SELECT_BASE} WHERE "usuarioId" = $1 AND nombre = $2 AND "deletedAt" IS NULL`,
        [userId, data.nombre],
      );
      if (existente[0]) {
        return aCategoria(existente[0]);
      }
      throw new Error('No se pudo crear la categoría.');
    }

    return aCategoria(filas[0]);
  }

  public async updateCategoria(id: string, userId: string, data: UpdateCategoriaDTO): Promise<Categoria> {
    const sets: string[] = [`"updatedAt" = now()`];
    const params: unknown[] = [id, userId];

    if (data.nombre !== undefined) {
      params.push(data.nombre);
      sets.push(`nombre = $${params.length}`);
    }
    if (data.tipo !== undefined) {
      params.push(validarTipo(data.tipo));
      sets.push(`tipo = $${params.length}`);
    }

    const filas = await query<CategoriaRow>(
      `UPDATE categorias SET ${sets.join(', ')}
       WHERE id = $1 AND "usuarioId" = $2 AND "deletedAt" IS NULL
       RETURNING id, "usuarioId", nombre, tipo, "createdAt", "updatedAt"`,
      params,
    );

    if (!filas[0]) {
      throw new CategoriaNotFoundError();
    }

    return aCategoria(filas[0]);
  }

  /**
   * Borra una categoría MOVIENDO a la papelera (borrado lógico) también sus
   * gastos y presupuestos. Todo queda restaurable desde la papelera.
   */
  public async deleteCategoria(id: string, userId: string): Promise<{
    mensaje: string;
    gastosEnPapelera: number;
    presupuestosEnPapelera: number;
  }> {
    return withTransaction(async ({ query: q }) => {
      const existe = await q<{ id: string }>(
        'SELECT id FROM categorias WHERE id = $1 AND "usuarioId" = $2 AND "deletedAt" IS NULL',
        [id, userId],
      );

      if (!existe[0]) {
        throw new CategoriaNotFoundError();
      }

      const gastos = await q<{ id: string }>(
        `UPDATE gastos SET "deletedAt" = now()
         WHERE "categoriaId" = $1 AND "usuarioId" = $2 AND "deletedAt" IS NULL
         RETURNING id`,
        [id, userId],
      );

      const presupuestos = await q<{ id: string }>(
        `UPDATE presupuestos SET "deletedAt" = now()
         WHERE "categoriaId" = $1 AND "usuarioId" = $2 AND "deletedAt" IS NULL
         RETURNING id`,
        [id, userId],
      );

      await q('UPDATE categorias SET "deletedAt" = now(), "updatedAt" = now() WHERE id = $1', [id]);

      return {
        mensaje: 'Categoría movida a la papelera con sus gastos y presupuestos.',
        gastosEnPapelera: gastos.length,
        presupuestosEnPapelera: presupuestos.length,
      };
    });
  }
}

export const categoriasService = new CategoriasService();