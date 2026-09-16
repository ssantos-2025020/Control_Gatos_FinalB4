import { query, withTransaction } from '../../../shared/database/database.service';

export const TIPOS_PAPELERA = ['categorias', 'gastos', 'ingresos', 'presupuestos'] as const;
export type TipoPapelera = (typeof TIPOS_PAPELERA)[number];

export class PapeleraTipoInvalidoError extends Error {
  constructor() {
    super('Tipo de elemento de papelera inválido.');
    this.name = 'PapeleraTipoInvalidoError';
  }
}

export class PapeleraItemNotFoundError extends Error {
  constructor() {
    super('El elemento no está en la papelera o no pertenece a este usuario.');
    this.name = 'PapeleraItemNotFoundError';
  }
}

export class PapeleraConflictoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PapeleraConflictoError';
  }
}

function aIso(valor: Date | string | undefined | null): string {
  if (valor instanceof Date) {
    return valor.toISOString();
  }
  return String(valor ?? '');
}

/**
 * Helper de transacción: restaura un conjunto de categorías por ID (junto con
 * sus gastos y presupuestos). Si una categoría tiene conflicto de unicidad de
 * nombre (23505) se omite silenciosamente (no revierte la operación).
 */
async function restaurarCategoriasDe(
  q: (text: string, params?: unknown[]) => Promise<any[]>,
  catIds: string[],
  userId: string,
): Promise<{ restauradas: number; omitidas: number }> {
  let restauradas = 0;
  let omitidas = 0;
  for (const catId of catIds) {
    try {
      const cats = (await q(
        `UPDATE categorias SET "deletedAt" = NULL, "updatedAt" = now()
         WHERE id = $1 AND "usuarioId" = $2 AND "deletedAt" IS NOT NULL
         RETURNING id`,
        [catId, userId],
      )) as Array<{ id: string }>;
      if (cats[0]) {
        restauradas++;
        await q(
          `UPDATE gastos SET "deletedAt" = NULL WHERE "categoriaId" = $1 AND "usuarioId" = $2 AND "deletedAt" IS NOT NULL`,
          [catId, userId],
        );
        await q(
          `UPDATE presupuestos SET "deletedAt" = NULL WHERE "categoriaId" = $1 AND "usuarioId" = $2 AND "deletedAt" IS NOT NULL`,
          [catId, userId],
        );
      }
    } catch (error: any) {
      if (error?.code === '23505') {
        // Ya existe una categoría con ese nombre; se omite esta para evitar 500.
        omitidas++;
      } else {
        throw error;
      }
    }
  }
  return { restauradas, omitidas };
}

export interface PapeleraContenido {
  categorias: Array<{
    id: string;
    nombre: string;
    tipo: string;
    fechaEliminacion: string;
  }>;
  gastos: Array<{
    id: string;
    descripcion: string;
    monto: number;
    fecha: string;
    categoria: string;
    fechaEliminacion: string;
  }>;
  ingresos: Array<{
    id: string;
    descripcion: string;
    monto: number;
    fecha: string;
    categoria: string | null;
    fechaEliminacion: string;
  }>;
  presupuestos: Array<{
    id: string;
    categoria: string;
    mes: number;
    anio: number;
    monto: number;
    fechaEliminacion: string;
  }>;
}

/**
 * Papelera (borrado lógico). Los endpoints de eliminación normales marcan
 * "deletedAt"; aquí se listan, restauran o eliminan definitivamente esos
 * registros. Restaurar una categoría también restaura sus gastos y presupuestos;
 * eliminarla definitivamente borra también los de la papelera que le pertenecen.
 */
class PapeleraService {
  public async getPapelera(userId: string): Promise<PapeleraContenido> {
    const categorias = await query<{ id: string; nombre: string; tipo: string; deletedAt: Date }>(
      `SELECT id, nombre, tipo, "deletedAt"
       FROM categorias
       WHERE "usuarioId" = $1 AND "deletedAt" IS NOT NULL
       ORDER BY "deletedAt" DESC`,
      [userId],
    );

    const gastos = await query<{
      id: string;
      descripcion: string;
      monto: string | number;
      fecha: Date | string;
      categoria_nombre: string;
      deletedAt: Date;
    }>(
      `SELECT g.id, g.descripcion, g.monto, g.fecha, c.nombre AS categoria_nombre, g."deletedAt"
       FROM gastos g
       JOIN categorias c ON c.id = g."categoriaId"
       WHERE g."usuarioId" = $1 AND g."deletedAt" IS NOT NULL
       ORDER BY g."deletedAt" DESC`,
      [userId],
    );

    const ingresos = await query<{
      id: string;
      descripcion: string;
      monto: string | number;
      fecha: Date | string;
      categoria: string | null;
      deletedAt: Date;
    }>(
      `SELECT id, descripcion, monto, fecha, categoria, "deletedAt"
       FROM ingresos
       WHERE "usuarioId" = $1 AND "deletedAt" IS NOT NULL
       ORDER BY "deletedAt" DESC`,
      [userId],
    );

    const presupuestos = await query<{
      id: string;
      categoria_nombre: string;
      mes: number;
      anio: number;
      monto: string | number;
      deletedAt: Date;
    }>(
      `SELECT p.id, c.nombre AS categoria_nombre, p.mes, p.anio, p.monto, p."deletedAt"
       FROM presupuestos p
       JOIN categorias c ON c.id = p."categoriaId"
       WHERE p."usuarioId" = $1 AND p."deletedAt" IS NOT NULL
       ORDER BY p."deletedAt" DESC`,
      [userId],
    );

    return {
      categorias: categorias.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        tipo: c.tipo,
        fechaEliminacion: aIso(c.deletedAt),
      })),
      gastos: gastos.map((g) => ({
        id: g.id,
        descripcion: g.descripcion,
        monto: Number(g.monto),
        fecha: aIso(g.fecha),
        categoria: g.categoria_nombre,
        fechaEliminacion: aIso(g.deletedAt),
      })),
      ingresos: ingresos.map((i) => ({
        id: i.id,
        descripcion: i.descripcion,
        monto: Number(i.monto),
        fecha: aIso(i.fecha),
        categoria: i.categoria,
        fechaEliminacion: aIso(i.deletedAt),
      })),
      presupuestos: presupuestos.map((p) => ({
        id: p.id,
        categoria: p.categoria_nombre,
        mes: Number(p.mes),
        anio: Number(p.anio),
        monto: Number(p.monto),
        fechaEliminacion: aIso(p.deletedAt),
      })),
    };
  }

  public async restaurar(tipo: TipoPapelera, id: string, userId: string): Promise<{ message: string }> {
    if (tipo === 'categorias') {
      return withTransaction(async ({ query: q }) => {
        const cat = await q<{ id: string }>(
          `SELECT id FROM categorias WHERE id = $1 AND "usuarioId" = $2 AND "deletedAt" IS NOT NULL`,
          [id, userId],
        );
        if (!cat[0]) throw new PapeleraItemNotFoundError();

        // Restaura la categoría y, junto con ella, sus gastos y presupuestos.
        await q(
          `UPDATE categorias SET "deletedAt" = NULL, "updatedAt" = now() WHERE id = $1`,
          [id],
        );
        await q(
          `UPDATE gastos SET "deletedAt" = NULL WHERE "categoriaId" = $1 AND "usuarioId" = $2 AND "deletedAt" IS NOT NULL`,
          [id, userId],
        );
        await q(
          `UPDATE presupuestos SET "deletedAt" = NULL WHERE "categoriaId" = $1 AND "usuarioId" = $2 AND "deletedAt" IS NOT NULL`,
          [id, userId],
        );
        return { message: 'Categoría restaurada con sus gastos y presupuestos.' };
      }).catch((error: any) => {
        // Ya existe una categoría vigente con ese nombre en la cuenta.
        if (error?.code === '23505') {
          throw new PapeleraConflictoError(
            'Ya existe una categoría vigente con ese nombre en tu cuenta. Elimina la vigente y vuelve a restaurar, o elimina esta definitivamente.',
          );
        }
        throw error;
      });
    }

    return withTransaction(async ({ query: q }) => {
      const filas = await q<{ id: string; categoriaId?: string }>(
        `UPDATE ${tipo} SET "deletedAt" = NULL
         WHERE id = $1 AND "usuarioId" = $2 AND "deletedAt" IS NOT NULL
         RETURNING id${tipo === 'ingresos' ? '' : ', "categoriaId"'}`,
        [id, userId],
      );
      if (!filas[0]) throw new PapeleraItemNotFoundError();

      // Si el gasto/presupuesto pertenecía a una categoría que también está en
      // la papelera, se restaura la categoría junto con todo lo que le sigue.
      let categoriaRestaurada = false;
      if (tipo === 'gastos' || tipo === 'presupuestos') {
        const catId = filas[0].categoriaId;
        if (catId) {
          const cats = await q<{ nombre: string }>(
            `UPDATE categorias SET "deletedAt" = NULL, "updatedAt" = now()
             WHERE id = $1 AND "usuarioId" = $2 AND "deletedAt" IS NOT NULL
             RETURNING nombre`,
            [catId, userId],
          );
          if (cats[0]) {
            categoriaRestaurada = true;
            await q(
              `UPDATE gastos SET "deletedAt" = NULL WHERE "categoriaId" = $1 AND "usuarioId" = $2 AND "deletedAt" IS NOT NULL`,
              [catId, userId],
            );
            await q(
              `UPDATE presupuestos SET "deletedAt" = NULL WHERE "categoriaId" = $1 AND "usuarioId" = $2 AND "deletedAt" IS NOT NULL`,
              [catId, userId],
            );
          }
        }
      }

      const base = tipo === 'gastos' ? 'Gasto' : tipo === 'ingresos' ? 'Ingreso' : 'Presupuesto';
      const mensaje = categoriaRestaurada
        ? `${base} restaurado. Su categoría estaba en la papelera y también fue restaurada, junto con sus gastos y presupuestos.`
        : `${base} restaurado.`;
      return { message: mensaje };
    }).catch((error: any) => {
      // Un presupuesto no puede restaurarse si ya existe uno vigente para la
      // misma categoría y mes (índice único parcial).
      if (tipo === 'presupuestos' && error?.code === '23505') {
        throw new PapeleraConflictoError(
          'Ya existe un presupuesto vigente para esa categoría en ese mes. Elimina el vigente y vuelve a restaurar, o elimina este definitivamente.',
        );
      }
      throw error;
    });
  }

  public async restaurarTodo(tipo: TipoPapelera, userId: string): Promise<{
    message: string;
    restaurados: number;
    omitidos?: number;
  }> {
    if (tipo === 'categorias') {
      return withTransaction(async ({ query: q }) => {
        const cats = await q<{ id: string }>(
          `SELECT id FROM categorias WHERE "usuarioId" = $1 AND "deletedAt" IS NOT NULL`,
          [userId],
        );
        const { restauradas, omitidas } = await restaurarCategoriasDe(q, cats.map((c) => c.id), userId);
        return {
          message:
            restauradas > 0
              ? 'Categorías restauradas con sus gastos y presupuestos.'
              : 'No hay categorías en la papelera.',
          restaurados: restauradas,
          omitidos: omitidas > 0 ? omitidas : undefined,
        };
      });
    }

    if (tipo === 'presupuestos') {
      return withTransaction(async ({ query: q }) => {
        const filas = await q<{ id: string; categoriaId: string }>(
          `SELECT id, "categoriaId" FROM presupuestos WHERE "usuarioId" = $1 AND "deletedAt" IS NOT NULL`,
          [userId],
        );
        let restaurados = 0;
        let omitidos = 0;
        const catIds = new Set<string>();
        for (const f of filas) {
          try {
            const upd = await q<{ id: string }>(
              `UPDATE presupuestos SET "deletedAt" = NULL WHERE id = $1 AND "deletedAt" IS NOT NULL RETURNING id`,
              [f.id],
            );
            if (upd[0]) {
              restaurados++;
              if (f.categoriaId) catIds.add(f.categoriaId);
            }
          } catch (error: any) {
            // Un presupuesto no puede restaurarse si ya existe uno vigente para
            // la misma categoría y mes (índice único parcial).
            if (error?.code === '23505') omitidos++;
            else throw error;
          }
        }
        // Restaura también las categorías que estaban en la papelera (igual que
        // la restauración individual).
        await restaurarCategoriasDe(q, [...catIds], userId);
        const mensaje =
          omitidos > 0
            ? `${restaurados} presupuesto(s) restaurado(s). ${omitidos} se omitieron porque ya hay un presupuesto vigente con su misma categoría y mes.`
            : `${restaurados} presupuesto(s) restaurado(s).`;
        return { message: mensaje, restaurados, omitidos };
      });
    }

    if (tipo === 'gastos') {
      return withTransaction(async ({ query: q }) => {
        const filas = await q<{ id: string; categoriaId: string }>(
          `UPDATE gastos SET "deletedAt" = NULL
           WHERE "usuarioId" = $1 AND "deletedAt" IS NOT NULL
           RETURNING id, "categoriaId"`,
          [userId],
        );
        const restaurados = filas.length;
        // Restaura también las categorías que estaban en la papelera (igual que
        // la restauración individual).
        await restaurarCategoriasDe(q, [...new Set(filas.map((f) => f.categoriaId).filter(Boolean))], userId);
        const base = 'Gasto';
        return {
          message: `${base}${restaurados === 1 ? '' : 's'} restaurado${restaurados === 1 ? '' : 's'}.`,
          restaurados,
        };
      });
    }

    const filas = await query<{ id: string }>(
      `UPDATE ${tipo} SET "deletedAt" = NULL
       WHERE "usuarioId" = $1 AND "deletedAt" IS NOT NULL
       RETURNING id`,
      [userId],
    );
    const restaurados = filas.length;
    const base = 'Ingreso';
    return {
      message: `${base}${restaurados === 1 ? '' : 's'} restaurado${restaurados === 1 ? '' : 's'}.`,
      restaurados,
    };
  }

  public async eliminarPermanente(tipo: TipoPapelera, id: string, userId: string): Promise<{ message: string }> {
    if (tipo === 'categorias') {
      return withTransaction(async ({ query: q }) => {
        const cat = await q<{ id: string }>(
          `SELECT id FROM categorias WHERE id = $1 AND "usuarioId" = $2 AND "deletedAt" IS NOT NULL`,
          [id, userId],
        );
        if (!cat[0]) throw new PapeleraItemNotFoundError();

        // Borra los gastos/presupuestos de la papelera que dependen de la
        // categoría y luego la categoría (el trigger reasigna cualquier sobrante).
        await q(
          `DELETE FROM gastos WHERE "categoriaId" = $1 AND "usuarioId" = $2 AND "deletedAt" IS NOT NULL`,
          [id, userId],
        );
        await q(
          `DELETE FROM presupuestos WHERE "categoriaId" = $1 AND "usuarioId" = $2 AND "deletedAt" IS NOT NULL`,
          [id, userId],
        );
        await q('DELETE FROM categorias WHERE id = $1', [id]);
        return { message: 'Categoría eliminada definitivamente.' };
      });
    }

    const filas = await query<{ id: string }>(
      `DELETE FROM ${tipo} WHERE id = $1 AND "usuarioId" = $2 AND "deletedAt" IS NOT NULL RETURNING id`,
      [id, userId],
    );
    if (!filas[0]) throw new PapeleraItemNotFoundError();
    const base = tipo === 'gastos' ? 'Gasto' : tipo === 'ingresos' ? 'Ingreso' : 'Presupuesto';
    return { message: `${base} eliminado definitivamente.` };
  }

  public async vaciar(userId: string): Promise<{
    message: string;
    categorias: number;
    gastos: number;
    ingresos: number;
    presupuestos: number;
  }> {
    return withTransaction(async ({ query: q }) => {
      const gastos = await q<{ id: string }>(
        'DELETE FROM gastos WHERE "usuarioId" = $1 AND "deletedAt" IS NOT NULL RETURNING id',
        [userId],
      );
      const presupuestos = await q<{ id: string }>(
        'DELETE FROM presupuestos WHERE "usuarioId" = $1 AND "deletedAt" IS NOT NULL RETURNING id',
        [userId],
      );
      const categorias = await q<{ id: string }>(
        'DELETE FROM categorias WHERE "usuarioId" = $1 AND "deletedAt" IS NOT NULL RETURNING id',
        [userId],
      );
      const ingresos = await q<{ id: string }>(
        'DELETE FROM ingresos WHERE "usuarioId" = $1 AND "deletedAt" IS NOT NULL RETURNING id',
        [userId],
      );
      return {
        message: 'Papelera vaciada.',
        categorias: categorias.length,
        gastos: gastos.length,
        ingresos: ingresos.length,
        presupuestos: presupuestos.length,
      };
    });
  }
}

export const papeleraService = new PapeleraService();