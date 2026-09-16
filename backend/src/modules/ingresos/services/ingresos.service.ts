import { query } from '../../../shared/database/database.service';

export class IngresoNotFoundError extends Error {
  constructor() {
    super('Ingreso no encontrado.');
    this.name = 'IngresoNotFoundError';
  }
}

export class IngresoForbiddenError extends Error {
  constructor() {
    super('No tiene permisos para acceder o modificar este ingreso.');
    this.name = 'IngresoForbiddenError';
  }
}

export interface IngresoInput {
  descripcion?: string;
  monto?: number | string;
  fecha?: string;
  categoria?: string;
  metodo?: string;
  usuarioId?: string;
}

interface GetIngresosFilters {
  search?: string;
  startDate?: string;
  endDate?: string;
}

interface IngresoRow {
  id: string;
  descripcion: string;
  monto: string | number;
  fecha: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
  usuarioId: string;
  categoria: string | null;
  metodo: string | null;
  usuario_nombre: string;
  usuario_email: string;
}

export interface Ingreso {
  id: string;
  descripcion: string;
  monto: number;
  fecha: string;
  createdAt: string;
  updatedAt: string;
  usuarioId: string;
  categoria?: string;
  metodo?: string;
  usuario: { id: string; nombre: string; email: string };
}

const SELECT_BASE = `
  SELECT i.id, i.descripcion, i.monto, i.fecha, i."createdAt", i."updatedAt",
         i."usuarioId", i.categoria, i.metodo,
         u.nombre AS usuario_nombre, u.email AS usuario_email
  FROM ingresos i
  JOIN usuarios u ON u.id = i."usuarioId"
`;

function aIso(valor: Date | string | undefined | null): string {
  if (valor instanceof Date) {
    return valor.toISOString();
  }
  return String(valor ?? '');
}

function aIngreso(fila: IngresoRow): Ingreso {
  return {
    id: fila.id,
    descripcion: fila.descripcion,
    monto: Number(fila.monto),
    fecha: aIso(fila.fecha),
    createdAt: aIso(fila.createdAt),
    updatedAt: aIso(fila.updatedAt),
    usuarioId: fila.usuarioId,
    categoria: fila.categoria ?? undefined,
    metodo: fila.metodo ?? undefined,
    usuario: { id: fila.usuarioId, nombre: fila.usuario_nombre, email: fila.usuario_email },
  };
}

class IngresosService {
  public async getIngresos(
    userId: string,
    userRole: 'ADMIN' | 'USER',
    filters: GetIngresosFilters,
  ): Promise<Ingreso[]> {
    const condiciones: string[] = [];
    const params: unknown[] = [];

    // Los registros en la papelera no se listan.
    condiciones.push(`i."deletedAt" IS NULL`);

    // Filtrado por usuario si es un rol USER regular
    if (userRole !== 'ADMIN') {
      params.push(userId);
      condiciones.push(`i."usuarioId" = $${params.length}`);
    }

    // Filtro por búsqueda de descripción (insensible a mayúsculas)
    if (filters.search) {
      params.push(`%${filters.search.trim()}%`);
      condiciones.push(`i.descripcion ILIKE $${params.length}`);
    }

    // Filtro por rango de fechas
    if (filters.startDate) {
      params.push(new Date(filters.startDate));
      condiciones.push(`i.fecha >= $${params.length}`);
    }
    if (filters.endDate) {
      const fin = new Date(filters.endDate);
      fin.setHours(23, 59, 59, 999);
      params.push(fin);
      condiciones.push(`i.fecha <= $${params.length}`);
    }

    const where = condiciones.length > 0 ? ` WHERE ${condiciones.join(' AND ')}` : '';
    const filas = await query<IngresoRow>(`${SELECT_BASE}${where} ORDER BY i.fecha DESC`, params);
    return filas.map(aIngreso);
  }

  public async getIngresoById(
    id: string,
    userId: string,
    userRole: 'ADMIN' | 'USER',
  ): Promise<Ingreso> {
    const filas = await query<IngresoRow>(`${SELECT_BASE} WHERE i.id = $1 AND i."deletedAt" IS NULL`, [id]);
    const ingreso = filas[0];

    if (!ingreso) {
      throw new IngresoNotFoundError();
    }

    // Verificar permisos
    if (userRole !== 'ADMIN' && ingreso.usuarioId !== userId) {
      throw new IngresoForbiddenError();
    }

    return aIngreso(ingreso);
  }

  /**
   * Resuelve el usuario sobre el que se aplica una operación: solo un ADMIN
   * puede elegir a otro usuario; un USER siempre opera sobre su propia cuenta.
   */
  private async resolverUsuarioObjetivo(
    userId: string,
    userRole: 'ADMIN' | 'USER',
    usuarioIdSolicitado?: string,
  ): Promise<string> {
    const objetivo = userRole === 'ADMIN' && usuarioIdSolicitado ? usuarioIdSolicitado : userId;
    if (objetivo !== userId || (userRole === 'ADMIN' && usuarioIdSolicitado)) {
      const filas = await query<{ id: string }>(
        'SELECT id FROM usuarios WHERE id = $1',
        [objetivo],
      );
      if (!filas[0]) {
        throw new Error('El usuario seleccionado no existe.');
      }
    }
    return objetivo;
  }

  public async createIngreso(
    userId: string,
    userRole: 'ADMIN' | 'USER',
    data: {
      descripcion: string;
      monto: number | string;
      fecha?: string;
      categoria?: string;
      metodo?: string;
      usuarioId?: string;
    },
  ): Promise<Ingreso> {
    const usuarioObjetivo = await this.resolverUsuarioObjetivo(userId, userRole, data.usuarioId);
    const fechaIngreso = data.fecha ? new Date(data.fecha) : new Date();

    const creado = await query<{ id: string }>(
      `INSERT INTO ingresos (id, descripcion, monto, fecha, "createdAt", "updatedAt", "usuarioId", categoria, metodo)
       VALUES (gen_random_uuid()::text, $1, $2, $3, now(), now(), $4, $5, $6)
       RETURNING id`,
      [
        data.descripcion.trim(),
        Number(data.monto),
        fechaIngreso,
        usuarioObjetivo,
        data.categoria?.trim() || null,
        data.metodo?.trim() || null,
      ],
    );

    const filas = await query<IngresoRow>(`${SELECT_BASE} WHERE i.id = $1`, [creado[0].id]);
    return aIngreso(filas[0]);
  }

  public async updateIngreso(
    id: string,
    userId: string,
    userRole: 'ADMIN' | 'USER',
    data: IngresoInput,
  ): Promise<Ingreso> {
    // Verificar que exista el ingreso y que el usuario tenga permisos
    await this.getIngresoById(id, userId, userRole);

    // Solo un ADMIN puede reasignar el ingreso a otro usuario.
    const usuarioSolicitado = userRole === 'ADMIN' && data.usuarioId ? data.usuarioId : null;
    if (usuarioSolicitado) {
      await this.resolverUsuarioObjetivo(userId, userRole, data.usuarioId);
    }

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

    if (data.categoria !== undefined) {
      params.push(data.categoria?.trim() || null);
      sets.push(`categoria = $${params.length}`);
    }

    if (data.metodo !== undefined) {
      params.push(data.metodo?.trim() || null);
      sets.push(`metodo = $${params.length}`);
    }

    if (usuarioSolicitado) {
      params.push(usuarioSolicitado);
      sets.push(`"usuarioId" = $${params.length}`);
    }

    sets.push('"updatedAt" = now()');

    await query(`UPDATE ingresos SET ${sets.join(', ')} WHERE id = $1`, params);

    const filas = await query<IngresoRow>(`${SELECT_BASE} WHERE i.id = $1 AND i."deletedAt" IS NULL`, [id]);
    return aIngreso(filas[0]);
  }

  public async deleteIngreso(
    id: string,
    userId: string,
    userRole: 'ADMIN' | 'USER',
  ): Promise<void> {
    // Verificar que exista el ingreso y que el usuario tenga permisos
    await this.getIngresoById(id, userId, userRole);

    // Borrado lógico: el ingreso pasa a la papelera (restaurable).
    await query('UPDATE ingresos SET "deletedAt" = now() WHERE id = $1', [id]);
  }
}

export const ingresosService = new IngresosService();