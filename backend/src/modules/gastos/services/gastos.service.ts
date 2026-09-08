import { query } from '../../../shared/database/database.service';

export class GastoNotFoundError extends Error {
  constructor() {
    super('Gasto no encontrado.');
    this.name = 'GastoNotFoundError';
  }
}

export class GastoForbiddenError extends Error {
  constructor() {
    super('No tiene permisos para acceder o modificar este gasto.');
    this.name = 'GastoForbiddenError';
  }
}

export class GastoCategoryNotFoundError extends Error {
  constructor() {
    super('La categoría especificada no existe.');
    this.name = 'GastoCategoryNotFoundError';
  }
}

export interface GastoInput {
  descripcion?: string;
  monto?: number | string;
  fecha?: string;
  categoriaId?: string;
  metodo?: 'Efectivo' | 'Tarjeta' | 'Transferencia';
}

interface GetGastosFilters {
  categoryId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

interface GastoRow {
  id: string;
  descripcion: string;
  monto: string | number;
  fecha: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
  usuarioId: string;
  categoriaId: string;
  metodo: string | null;
  categoria_nombre: string;
  usuario_nombre: string;
  usuario_email: string;
}

export interface Gasto {
  id: string;
  descripcion: string;
  monto: number;
  fecha: string;
  createdAt: string;
  updatedAt: string;
  usuarioId: string;
  categoriaId: string;
  metodo?: 'Efectivo' | 'Tarjeta' | 'Transferencia' | null;
  categoria: { id: string; nombre: string };
  usuario: { id: string; nombre: string; email: string };
}

const SELECT_BASE = `
  SELECT g.id, g.descripcion, g.monto, g.fecha, g.metodo, g."createdAt", g."updatedAt",
         g."usuarioId", g."categoriaId",
         c.nombre AS categoria_nombre,
         u.nombre AS usuario_nombre, u.email AS usuario_email
  FROM gastos g
  JOIN categorias c ON c.id = g."categoriaId"
  JOIN usuarios u ON u.id = g."usuarioId"
`;

function aIso(valor: Date | string | undefined | null): string {
  if (valor instanceof Date) {
    return valor.toISOString();
  }
  return String(valor ?? '');
}

function aGasto(fila: GastoRow): Gasto {
  return {
    id: fila.id,
    descripcion: fila.descripcion,
    monto: Number(fila.monto),
    fecha: aIso(fila.fecha),
    createdAt: aIso(fila.createdAt),
    updatedAt: aIso(fila.updatedAt),
    usuarioId: fila.usuarioId,
    categoriaId: fila.categoriaId,
    metodo: (fila.metodo ?? null) as Gasto['metodo'],
    categoria: { id: fila.categoriaId, nombre: fila.categoria_nombre },
    usuario: { id: fila.usuarioId, nombre: fila.usuario_nombre, email: fila.usuario_email },
  };
}

class GastosService {
  public async getGastos(
    userId: string,
    userRole: 'ADMIN' | 'USER',
    filters: GetGastosFilters,
  ): Promise<Gasto[]> {
    const condiciones: string[] = [];
    const params: unknown[] = [];

    // Filtrado por usuario si es un rol USER regular
    if (userRole !== 'ADMIN') {
      params.push(userId);
      condiciones.push(`g."usuarioId" = $${params.length}`);
    }

    // Filtro por categoría
    if (filters.categoryId) {
      params.push(filters.categoryId);
      condiciones.push(`g."categoriaId" = $${params.length}`);
    }

    // Filtro por búsqueda de descripción (insensible a mayúsculas)
    if (filters.search) {
      params.push(`%${filters.search.trim()}%`);
      condiciones.push(`g.descripcion ILIKE $${params.length}`);
    }

    // Filtro por rango de fechas
    if (filters.startDate) {
      params.push(new Date(filters.startDate));
      condiciones.push(`g.fecha >= $${params.length}`);
    }
    if (filters.endDate) {
      const fin = new Date(filters.endDate);
      fin.setHours(23, 59, 59, 999);
      params.push(fin);
      condiciones.push(`g.fecha <= $${params.length}`);
    }

    const where = condiciones.length > 0 ? ` WHERE ${condiciones.join(' AND ')}` : '';
    const filas = await query<GastoRow>(`${SELECT_BASE}${where} ORDER BY g.fecha DESC`, params);
    return filas.map(aGasto);
  }

  public async getGastoById(
    id: string,
    userId: string,
    userRole: 'ADMIN' | 'USER',
  ): Promise<Gasto> {
    const filas = await query<GastoRow>(`${SELECT_BASE} WHERE g.id = $1`, [id]);
    const gasto = filas[0];

    if (!gasto) {
      throw new GastoNotFoundError();
    }

    // Verificar permisos
    if (userRole !== 'ADMIN' && gasto.usuarioId !== userId) {
      throw new GastoForbiddenError();
    }

    return aGasto(gasto);
  }

  public async createGasto(
    userId: string,
    data: { descripcion: string; monto: number | string; fecha?: string; categoriaId: string; metodo?: string },
  ): Promise<Gasto> {
    // Validar categoría
    const categoria = await query<{ id: string }>('SELECT id FROM categorias WHERE id = $1', [
      data.categoriaId,
    ]);

    if (!categoria[0]) {
      throw new GastoCategoryNotFoundError();
    }

    const fechaGasto = data.fecha ? new Date(data.fecha) : new Date();
    const metodo = ['Efectivo', 'Tarjeta', 'Transferencia'].includes(data.metodo ?? '')
      ? data.metodo
      : 'Efectivo';

    const creado = await query<{ id: string }>(
      `INSERT INTO gastos (id, descripcion, monto, fecha, metodo, "createdAt", "updatedAt", "usuarioId", "categoriaId")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, now(), now(), $5, $6)
       RETURNING id`,
      [data.descripcion.trim(), Number(data.monto), fechaGasto, metodo, userId, data.categoriaId],
    );

    const filas = await query<GastoRow>(`${SELECT_BASE} WHERE g.id = $1`, [creado[0].id]);
    return aGasto(filas[0]);
  }

  public async updateGasto(
    id: string,
    userId: string,
    userRole: 'ADMIN' | 'USER',
    data: GastoInput,
  ): Promise<Gasto> {
    // Verificar que exista el gasto y que el usuario tenga permisos
    await this.getGastoById(id, userId, userRole);

    const sets: string[] = [];
    const params: unknown[] = [id];

    if (data.descripcion !== undefined) {
      params.push(data.descripcion.trim());
      sets.push(`descripcion = $${params.length}`);
    }

    if (data.monto !== undefined) {
      params.push(Number(data.monto));
      sets.push(`monto = $${params.length}`);
    }

    if (data.fecha !== undefined) {
      params.push(new Date(data.fecha));
      sets.push(`fecha = $${params.length}`);
    }

    if (data.categoriaId !== undefined) {
      if (data.categoriaId !== null) {
        const categoria = await query<{ id: string }>('SELECT id FROM categorias WHERE id = $1', [
          data.categoriaId,
        ]);
        if (!categoria[0]) {
          throw new GastoCategoryNotFoundError();
        }
      }
      params.push(data.categoriaId);
      sets.push(`"categoriaId" = $${params.length}`);
    }

    if (data.metodo !== undefined) {
      const metodo = ['Efectivo', 'Tarjeta', 'Transferencia'].includes(data.metodo) ? data.metodo : 'Efectivo';
      params.push(metodo);
      sets.push(`metodo = $${params.length}`);
    }

    sets.push('"updatedAt" = now()');

    await query(`UPDATE gastos SET ${sets.join(', ')} WHERE id = $1`, params);

    const filas = await query<GastoRow>(`${SELECT_BASE} WHERE g.id = $1`, [id]);
    return aGasto(filas[0]);
  }

  public async deleteGasto(id: string, userId: string, userRole: 'ADMIN' | 'USER'): Promise<void> {
    // Verificar que exista el gasto y que el usuario tenga permisos
    await this.getGastoById(id, userId, userRole);

    await query('DELETE FROM gastos WHERE id = $1', [id]);
  }
}

export const gastosService = new GastosService();