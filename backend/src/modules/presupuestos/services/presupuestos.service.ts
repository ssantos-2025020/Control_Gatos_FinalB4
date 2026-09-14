import { query } from '../../../shared/database/database.service';

export class PresupuestoNotFoundError extends Error {
  constructor() {
    super('Presupuesto no encontrado.');
    this.name = 'PresupuestoNotFoundError';
  }
}

interface PresupuestoRow {
  id: string;
  usuarioId: string;
  categoriaId: string;
  nombre: string;
  monto: string | number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Presupuesto {
  id: string;
  usuarioId: string;
  categoriaId: string;
  nombre: string;
  monto: number;
  createdAt: string;
  updatedAt: string;
}

function aIso(valor: Date | string | undefined | null): string {
  if (valor instanceof Date) {
    return valor.toISOString();
  }
  return String(valor ?? '');
}

function aPresupuesto(fila: PresupuestoRow): Presupuesto {
  return {
    id: fila.id,
    usuarioId: fila.usuarioId,
    categoriaId: fila.categoriaId,
    nombre: fila.nombre,
    monto: Number(fila.monto),
    createdAt: aIso(fila.createdAt),
    updatedAt: aIso(fila.updatedAt),
  };
}

const SELECT_BASE = `
  SELECT p.id, p."usuarioId", p."categoriaId", c.nombre, p.monto, p."createdAt", p."updatedAt"
  FROM presupuestos p
  JOIN categorias c ON c.id = p."categoriaId"
`;

class PresupuestosService {
  public async getPresupuestos(userId: string): Promise<Presupuesto[]> {
    const filas = await query<PresupuestoRow>(
      `${SELECT_BASE} WHERE p."usuarioId" = $1 ORDER BY c.nombre ASC`,
      [userId],
    );
    return filas.map(aPresupuesto);
  }

  public async getPresupuestoById(id: string, userId: string): Promise<Presupuesto | null> {
    const filas = await query<PresupuestoRow>(
      `${SELECT_BASE} WHERE p.id = $1 AND p."usuarioId" = $2`,
      [id, userId],
    );
    return filas[0] ? aPresupuesto(filas[0]) : null;
  }

  public async getPresupuestoByCategory(categoriaId: string, userId: string): Promise<Presupuesto | null> {
    const filas = await query<PresupuestoRow>(
      `${SELECT_BASE} WHERE p."categoriaId" = $1 AND p."usuarioId" = $2`,
      [categoriaId, userId],
    );
    return filas[0] ? aPresupuesto(filas[0]) : null;
  }

  public async createPresupuesto(
    userId: string,
    categoriaId: string,
    monto: number,
  ): Promise<Presupuesto> {
    if (isNaN(monto) || monto < 0) {
      throw new Error('El monto debe ser un número mayor o igual a cero.');
    }

    const categoria = await query<{ id: string }>(
      'SELECT id FROM categorias WHERE id = $1 AND "usuarioId" = $2',
      [categoriaId, userId],
    );
    if (!categoria[0]) {
      throw new Error('La categoría indicada no existe o no pertenece a este usuario.');
    }

    const filas = await query<PresupuestoRow>(
      `INSERT INTO presupuestos (id, "usuarioId", "categoriaId", monto, "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, now(), now())
       ON CONFLICT ("usuarioId", "categoriaId") DO UPDATE SET monto = EXCLUDED.monto, "updatedAt" = now()
       RETURNING id, "usuarioId", "categoriaId", monto, "createdAt", "updatedAt"`,
      [userId, categoriaId, monto],
    );

    const completa = await query<PresupuestoRow>(`${SELECT_BASE} WHERE p.id = $1`, [filas[0].id]);
    return aPresupuesto(completa[0]);
  }

  public async updateMonto(id: string, monto: number, userId: string): Promise<Presupuesto> {
    if (isNaN(monto) || monto < 0) {
      throw new Error('El monto debe ser un número mayor o igual a cero.');
    }

    const filas = await query<PresupuestoRow>(
      `UPDATE presupuestos SET monto = $2, "updatedAt" = now()
       WHERE id = $1 AND "usuarioId" = $3
       RETURNING id, "usuarioId", "categoriaId", monto, "createdAt", "updatedAt"`,
      [id, monto, userId],
    );

    if (!filas[0]) {
      throw new PresupuestoNotFoundError();
    }

    const completa = await query<PresupuestoRow>(`${SELECT_BASE} WHERE p.id = $1`, [id]);
    return aPresupuesto(completa[0]);
  }

  public async deletePresupuesto(id: string, userId: string): Promise<void> {
    const existe = await query<{ id: string }>(
      'SELECT id FROM presupuestos WHERE id = $1 AND "usuarioId" = $2',
      [id, userId],
    );
    if (!existe[0]) {
      throw new PresupuestoNotFoundError();
    }
    await query('DELETE FROM presupuestos WHERE id = $1 AND "usuarioId" = $2', [id, userId]);
  }
}

export const presupuestosService = new PresupuestosService();