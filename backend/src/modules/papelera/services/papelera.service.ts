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
      });
    }

    try {
      const filas = await query<{ id: string }>(
        `UPDATE ${tipo} SET "deletedAt" = NULL
         WHERE id = $1 AND "usuarioId" = $2 AND "deletedAt" IS NOT NULL
         RETURNING id`,
        [id, userId],
      );
      if (!filas[0]) throw new PapeleraItemNotFoundError();
      const base = tipo === 'gastos' ? 'Gasto' : tipo === 'ingresos' ? 'Ingreso' : 'Presupuesto';
      return { message: `${base} restaurado.` };
    } catch (error: any) {
      // Un presupuesto no puede restaurarse si ya existe uno vigente para la
      // misma categoría y mes (índice único parcial).
      if (tipo === 'presupuestos' && error?.code === '23505') {
        throw new PapeleraConflictoError(
          'Ya existe un presupuesto vigente para esa categoría en ese mes. Elimina el vigente y vuelve a restaurar, o elimina este definitivamente.',
        );
      }
      throw error;
    }
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