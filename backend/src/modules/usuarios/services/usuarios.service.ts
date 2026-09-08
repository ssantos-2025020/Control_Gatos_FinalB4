import bcrypt from 'bcrypt';
import { query, withTransaction } from '../../../shared/database/database.service';
import { CreateUsuarioDTO, UpdateUsuarioDTO, UsuarioRole } from '../models/usuarios.model';

const SALT_ROUNDS = 10;

export class UsuarioNotFoundError extends Error {
  constructor() {
    super('Usuario no encontrado.');
    this.name = 'UsuarioNotFoundError';
  }
}

export class UsuarioEmailInUseError extends Error {
  constructor() {
    super('Ya existe un usuario registrado con ese correo electrónico.');
    this.name = 'UsuarioEmailInUseError';
  }
}

export class UsuarioLastAdminError extends Error {
  constructor() {
    super('No se puede eliminar o desactivar al último administrador.');
    this.name = 'UsuarioLastAdminError';
  }
}

export class UsuarioSelfDeleteError extends Error {
  constructor() {
    super('No puedes eliminar tu propia cuenta.');
    this.name = 'UsuarioSelfDeleteError';
  }
}

interface UsuarioRow {
  id: string;
  email: string;
  nombre: string;
  role: UsuarioRole;
  createdAt: Date;
  updatedAt: Date;
}

interface UsuarioRowConPassword extends UsuarioRow {
  password: string;
}

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  role: UsuarioRole;
  createdAt: string;
  updatedAt: string;
}

function aIso(valor: Date | string | undefined | null): string {
  if (valor instanceof Date) {
    return valor.toISOString();
  }
  return String(valor ?? '');
}

function aUsuario(fila: UsuarioRow): Usuario {
  return {
    id: fila.id,
    email: fila.email,
    nombre: fila.nombre,
    role: fila.role,
    createdAt: aIso(fila.createdAt),
    updatedAt: aIso(fila.updatedAt),
  };
}

class UsuariosService {
  public async getUsuarios(): Promise<Usuario[]> {
    const filas = await query<UsuarioRow>(
      'SELECT id, email, nombre, role, "createdAt", "updatedAt" FROM usuarios ORDER BY nombre ASC',
    );
    return filas.map(aUsuario);
  }

  public async getUsuarioById(id: string): Promise<Usuario | null> {
    const filas = await query<UsuarioRow>(
      'SELECT id, email, nombre, role, "createdAt", "updatedAt" FROM usuarios WHERE id = $1',
      [id],
    );
    return filas[0] ? aUsuario(filas[0]) : null;
  }

  public async createUsuario(data: CreateUsuarioDTO): Promise<Usuario> {
    const email = data.email.trim().toLowerCase();
    const nombre = data.nombre.trim();
    const role: UsuarioRole = data.role ?? 'USER';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('El correo electrónico no es válido.');
    }

    if (nombre.length < 2) {
      throw new Error('El nombre debe tener al menos 2 caracteres.');
    }

    if (!data.password || data.password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres.');
    }

    const existente = await query<{ id: string }>('SELECT id FROM usuarios WHERE LOWER(email) = $1', [email]);
    if (existente[0]) {
      throw new UsuarioEmailInUseError();
    }

    const hash = await bcrypt.hash(data.password, SALT_ROUNDS);

    const filas = await query<UsuarioRow>(
      `INSERT INTO usuarios (id, email, nombre, password, role, "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4::"Role", now(), now())
       RETURNING id, email, nombre, role, "createdAt", "updatedAt"`,
      [email, nombre, hash, role],
    );

    return aUsuario(filas[0]);
  }

  public async updateUsuario(
    id: string,
    data: UpdateUsuarioDTO,
    requestingUserId: string,
  ): Promise<Usuario> {
    const actual = await query<UsuarioRowConPassword>(
      'SELECT id, email, nombre, password, role, "createdAt", "updatedAt" FROM usuarios WHERE id = $1',
      [id],
    );

    if (!actual[0]) {
      throw new UsuarioNotFoundError();
    }

    const usuario = actual[0];

    // Validar email si se actualiza
    let email = usuario.email;
    if (data.email !== undefined) {
      email = data.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('El correo electrónico no es válido.');
      }
      const duplicado = await query<{ id: string }>(
        'SELECT id FROM usuarios WHERE LOWER(email) = $1 AND id <> $2',
        [email, id],
      );
      if (duplicado[0]) {
        throw new UsuarioEmailInUseError();
      }
    }

    // Validar que no se descarte al último administrador
    let role = usuario.role;
    if (data.role !== undefined && data.role !== usuario.role) {
      if (usuario.role === 'ADMIN') {
        const cuantosAdmin = await query<{ total: string }>(
          "SELECT COUNT(*)::text AS total FROM usuarios WHERE role = 'ADMIN'",
        );
        if (Number(cuantosAdmin[0].total) <= 1) {
          throw new UsuarioLastAdminError();
        }
      }
      role = data.role;
    }

    // Validar nombre
    const nombre = data.nombre !== undefined ? data.nombre.trim() : usuario.nombre;
    if (nombre.length < 2) {
      throw new Error('El nombre debe tener al menos 2 caracteres.');
    }

    // Encriptar contraseña si se actualiza
    let passwordHash = usuario.password;
    if (data.password !== undefined) {
      if (data.password.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres.');
      }
      passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    }

    await query(
      `UPDATE usuarios
       SET email = $2, nombre = $3, password = $4, role = $5::"Role", "updatedAt" = now()
       WHERE id = $1`,
      [id, email, nombre, passwordHash, role],
    );

    const filas = await query<UsuarioRow>(
      'SELECT id, email, nombre, role, "createdAt", "updatedAt" FROM usuarios WHERE id = $1',
      [id],
    );

    return aUsuario(filas[0]);
  }

  public async deleteUsuario(id: string, requestingUserId: string): Promise<void> {
    if (id === requestingUserId) {
      throw new UsuarioSelfDeleteError();
    }

    const actual = await query<{ id: string; role: UsuarioRole }>(
      'SELECT id, role FROM usuarios WHERE id = $1',
      [id],
    );

    if (!actual[0]) {
      throw new UsuarioNotFoundError();
    }

    if (actual[0].role === 'ADMIN') {
      const cuantosAdmin = await query<{ total: string }>(
        "SELECT COUNT(*)::text AS total FROM usuarios WHERE role = 'ADMIN'",
      );
      if (Number(cuantosAdmin[0].total) <= 1) {
        throw new UsuarioLastAdminError();
      }
    }

    await withTransaction(async ({ query: q }) => {
      await q('DELETE FROM gastos WHERE "usuarioId" = $1', [id]);
      await q('DELETE FROM ingresos WHERE "usuarioId" = $1', [id]);
      await q('DELETE FROM usuarios WHERE id = $1', [id]);
    });
  }

  public async getByEmail(email: string): Promise<UsuarioRow | null> {
    const filas = await query<UsuarioRow>(`SELECT id, email, nombre, role
      FROM usuarios WHERE LOWER(email) = $1`, [email.trim().toLowerCase()]);
    return filas[0] ?? null;
  }
}

export const usuariosService = new UsuariosService();