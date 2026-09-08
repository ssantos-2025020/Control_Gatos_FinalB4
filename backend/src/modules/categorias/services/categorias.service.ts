import { query, withTransaction } from '../../../shared/database/database.service';
import { CreateCategoriaDTO, UpdateCategoriaDTO } from '../models/categorias.model';

interface CategoriaRow {
  id: string;
  nombre: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Error de dominio para una categoría inexistente.
 */
export class CategoriaNotFoundError extends Error {
  constructor() {
    super('Categoría no encontrada.');
    this.name = 'CategoriaNotFoundError';
  }
}

class CategoriasService {
  public async getCategorias(): Promise<CategoriaRow[]> {
    return query<CategoriaRow>(
      'SELECT id, nombre, "createdAt", "updatedAt" FROM categorias ORDER BY nombre ASC',
    );
  }

  public async getCategoriaById(id: string): Promise<CategoriaRow | null> {
    const filas = await query<CategoriaRow>(
      'SELECT id, nombre, "createdAt", "updatedAt" FROM categorias WHERE id = $1',
      [id],
    );
    return filas[0] ?? null;
  }

  public async createCategoria(data: CreateCategoriaDTO): Promise<CategoriaRow> {
    const filas = await query<CategoriaRow>(
      `INSERT INTO categorias (id, nombre, "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, now(), now())
       ON CONFLICT (nombre) DO NOTHING
       RETURNING id, nombre, "createdAt", "updatedAt"`,
      [data.nombre],
    );

    if (!filas[0]) {
      const existente = await query<CategoriaRow>(
        'SELECT id, nombre, "createdAt", "updatedAt" FROM categorias WHERE nombre = $1',
        [data.nombre],
      );
      if (existente[0]) {
        return existente[0];
      }
      throw new Error('No se pudo crear la categoría.');
    }

    return filas[0];
  }

  public async updateCategoria(id: string, data: UpdateCategoriaDTO): Promise<CategoriaRow> {
    const filas = await query<CategoriaRow>(
      `UPDATE categorias SET nombre = COALESCE($2, nombre), "updatedAt" = now()
       WHERE id = $1
       RETURNING id, nombre, "createdAt", "updatedAt"`,
      [id, data.nombre],
    );

    if (!filas[0]) {
      throw new CategoriaNotFoundError();
    }

    return filas[0];
  }

  public async deleteCategoria(id: string): Promise<{
    mensaje: string;
    categoriaReasignada: string;
    gastosReasignados: number;
  }> {
    return withTransaction(async ({ query: q }) => {
      const existe = await q<{ id: string }>('SELECT id FROM categorias WHERE id = $1', [id]);

      if (!existe[0]) {
        throw new CategoriaNotFoundError();
      }

      let otros = await q<{ id: string }>(`SELECT id FROM categorias WHERE nombre = 'Otros'`);
      let otrosId = otros[0]?.id;

      if (!otrosId) {
        otrosId = (
          await q<{ id: string }>(
            `INSERT INTO categorias (id, nombre, "createdAt", "updatedAt")
             VALUES (gen_random_uuid()::text, 'Otros', now(), now())
             RETURNING id`,
          )
        )[0].id;
      }

      const reasignados = await q<{ id: string }>(
        'UPDATE gastos SET "categoriaId" = $1 WHERE "categoriaId" = $2 RETURNING id',
        [otrosId, id],
      );

      await q('DELETE FROM categorias WHERE id = $1', [id]);

      return {
        mensaje: 'Categoría eliminada',
        categoriaReasignada: otrosId,
        gastosReasignados: reasignados.length,
      };
    });
  }
}

export const categoriasService = new CategoriasService();