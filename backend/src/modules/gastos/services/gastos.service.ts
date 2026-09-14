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

export class GastoSaldoInsuficienteError extends Error {
  constructor(disponible: number, monto: number) {
    super(
      `Saldo insuficiente del mes para registrar este gasto. Disponible: $${Math.round(disponible * 100) / 100}, monto: $${Math.round(monto * 100) / 100}.`,
    );
    this.name = 'GastoSaldoInsuficienteError';
  }
}

export class GastoPresupuestoExcedidoError extends Error {
  constructor(categoria: string, limite: number, restante: number) {
    super(
      `El gasto excede el presupuesto asignado a la categoría "${categoria}" para este mes. Presupuesto: $${Math.round(limite * 100) / 100}, disponible restante: $${Math.max(0, Math.round(restante * 100) / 100)}.`,
    );
    this.name = 'GastoPresupuestoExcedidoError';
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

    // Los registros en la papelera no se listan.
    condiciones.push(`g."deletedAt" IS NULL`);

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
    const filas = await query<GastoRow>(`${SELECT_BASE} WHERE g.id = $1 AND g."deletedAt" IS NULL`, [id]);
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

  /**
   * Valida que el gasto no deje el saldo del mes en negativo ni exceda el
   * presupuesto de su categoría. Lanza GastoSaldoInsuficienteError o
   * GastoPresupuestoExcedidoError si corresponde (bloqueo total).
   */
  private async validarCapacidad(args: {
    usuarioId: string;
    monto: number;
    fecha: Date;
    categoriaId: string;
    gastoActualId?: string;
  }): Promise<void> {
    const { usuarioId, monto, fecha, categoriaId, gastoActualId } = args;
    const anio = fecha.getFullYear();
    const mes = fecha.getMonth() + 1;
    const excluirActual = (gastoActualId ?? '');

    const saldoFilas = await query<{ ingreso: string; gasto: string }>(
      `SELECT
         (SELECT COALESCE(SUM(monto), 0) FROM ingresos
          WHERE "usuarioId" = $1 AND EXTRACT(YEAR FROM fecha) = $2 AND EXTRACT(MONTH FROM fecha) = $3
            AND "deletedAt" IS NULL) AS ingreso,
         (SELECT COALESCE(SUM(monto), 0) FROM gastos
          WHERE "usuarioId" = $1 AND EXTRACT(YEAR FROM fecha) = $2 AND EXTRACT(MONTH FROM fecha) = $3 AND id <> $4
            AND "deletedAt" IS NULL) AS gasto`,
      [usuarioId, anio, mes, excluirActual],
    );
    const ingresoMes = Number(saldoFilas[0]?.ingreso ?? 0);
    const gastoMes = Number(saldoFilas[0]?.gasto ?? 0);
    const disponible = ingresoMes - gastoMes;

    if (monto > disponible) {
      throw new GastoSaldoInsuficienteError(disponible, monto);
    }

    const presupuesto = await query<{ nombre: string; monto: string }>(
      `SELECT c.nombre, p.monto
       FROM presupuestos p
       JOIN categorias c ON c.id = p."categoriaId"
       WHERE p."categoriaId" = $1 AND p."usuarioId" = $2 AND p."deletedAt" IS NULL`,
      [categoriaId, usuarioId],
    );

    if (presupuesto[0] && Number(presupuesto[0].monto) > 0) {
      const usado = await query<{ total: string }>(
        `SELECT COALESCE(SUM(monto), 0) AS total FROM gastos
         WHERE "usuarioId" = $1 AND "categoriaId" = $2
           AND EXTRACT(YEAR FROM fecha) = $3 AND EXTRACT(MONTH FROM fecha) = $4
           AND id <> $5 AND "deletedAt" IS NULL`,
        [usuarioId, categoriaId, anio, mes, excluirActual],
      );
      const usadoCat = Number(usado[0]?.total ?? 0);
      const limite = Number(presupuesto[0].monto);
      const restante = limite - usadoCat;

      if (monto > restante) {
        throw new GastoPresupuestoExcedidoError(presupuesto[0].nombre, limite, restante);
      }
    }
  }

  public async createGasto(
    userId: string,
    data: { descripcion: string; monto: number | string; fecha?: string; categoriaId: string; metodo?: string },
  ): Promise<Gasto> {
    // Validar categoría (debe pertenecer al usuario)
    const categoria = await query<{ id: string }>(
      'SELECT id FROM categorias WHERE id = $1 AND "usuarioId" = $2 AND "deletedAt" IS NULL',
      [data.categoriaId, userId],
    );

    if (!categoria[0]) {
      throw new GastoCategoryNotFoundError();
    }

    const fechaGasto = data.fecha ? new Date(data.fecha) : new Date();
    const metodo = ['Efectivo', 'Tarjeta', 'Transferencia'].includes(data.metodo ?? '')
      ? data.metodo
      : 'Efectivo';

    const monto = Number(data.monto);

    await this.validarCapacidad({
      usuarioId: userId,
      monto,
      fecha: fechaGasto,
      categoriaId: data.categoriaId,
    });

    const creado = await query<{ id: string }>(
      `INSERT INTO gastos (id, descripcion, monto, fecha, metodo, "createdAt", "updatedAt", "usuarioId", "categoriaId")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, now(), now(), $5, $6)
       RETURNING id`,
      [data.descripcion.trim(), monto, fechaGasto, metodo, userId, data.categoriaId],
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
    const actual = await this.getGastoById(id, userId, userRole);

    // Recalcular la validación de saldo/presupuesto con los valores efectivos.
    const fechaFinal = data.fecha !== undefined ? new Date(data.fecha) : new Date(actual.fecha);
    const categoriaFinal = data.categoriaId !== undefined ? data.categoriaId : actual.categoriaId;
    const montoFinal = data.monto !== undefined ? Number(data.monto) : actual.monto;

    await this.validarCapacidad({
      usuarioId: userId,
      monto: montoFinal,
      fecha: fechaFinal,
      categoriaId: categoriaFinal,
      gastoActualId: id,
    });

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
        const categoria = await query<{ id: string }>(
          'SELECT id FROM categorias WHERE id = $1 AND "usuarioId" = $2 AND "deletedAt" IS NULL',
          [data.categoriaId, userId],
        );
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

    const filas = await query<GastoRow>(`${SELECT_BASE} WHERE g.id = $1 AND g."deletedAt" IS NULL`, [id]);
    return aGasto(filas[0]);
  }

  public async deleteGasto(id: string, userId: string, userRole: 'ADMIN' | 'USER'): Promise<void> {
    // Verificar que exista el gasto y que el usuario tenga permisos
    await this.getGastoById(id, userId, userRole);

    // Borrado lógico: el gasto pasa a la papelera (restaurable).
    await query('UPDATE gastos SET "deletedAt" = now() WHERE id = $1', [id]);
  }
}

export const gastosService = new GastosService();