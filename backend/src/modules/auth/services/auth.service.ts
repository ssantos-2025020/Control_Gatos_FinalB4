import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { query } from '../../../shared/database/database.service';
import {
  LoginDTO,
  LoginResponseDTO,
  RefreshResponseDTO,
  JwtPayloadDTO,
  MeResponseDTO,
  UsuarioDTO,
  GoogleLoginDTO,
  GoogleUserInfo,
} from '../models/auth.model';
import { JWT_SECRET, JWT_SIGN_OPTIONS, GOOGLE_CLIENT_ID } from '../../../config/jwt';

const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

interface UsuarioRow {
  email: string;
  nombre: string;
  password: string;
  role: string;
  google_id?: string;
  foto?: string;
}

/**
 * Error de dominio para credenciales inválidas.
 * El controlador lo traduce a una respuesta HTTP 401.
 */
export class InvalidCredentialsError extends Error {
  constructor() {
    super('Correo o contraseña incorrectos.');
    this.name = 'InvalidCredentialsError';
  }
}

function aUsuarioDTO(usuario: UsuarioRow): UsuarioDTO {
  return { 
    email: usuario.email, 
    nombre: usuario.nombre, 
    role: usuario.role,
    foto: usuario.foto 
  };
}

async function buscarUsuarioPorEmail(email: string): Promise<UsuarioRow | null> {
  const filas = await query<UsuarioRow>(
    'SELECT email, nombre, password, role, google_id, foto FROM "usuarios" WHERE LOWER(email) = $1',
    [email.trim().toLowerCase()],
  );
  return filas[0] ?? null;
}

async function crearUsuarioGoogle(email: string, nombre: string, googleId: string, foto?: string): Promise<UsuarioRow> {
  // El catálogo inicial de categorías por defecto se crea vía el trigger
  // trg_categorias_por_defecto (AFTER INSERT ON usuarios): igual para todas
  // las cuentas, sin importar el punto de entrada.
  await query(
    `INSERT INTO usuarios (email, nombre, password, role, google_id, foto)
     VALUES ($1, $2, '', 'USER', $3, $4)`,
    [email.trim().toLowerCase(), nombre, googleId, foto || null],
  );

  const usuario = await query<UsuarioRow>(
    'SELECT email, nombre, password, role, google_id, foto FROM "usuarios" WHERE LOWER(email) = $1',
    [email.trim().toLowerCase()],
  );
  return usuario[0];
}

class AuthService {
  public async login({ email, password }: LoginDTO): Promise<LoginResponseDTO> {
    const usuario = await buscarUsuarioPorEmail(email);

    if (!usuario) {
      throw new InvalidCredentialsError();
    }

    const passwordMatches = await bcrypt.compare(password, usuario.password);

    if (!passwordMatches) {
      throw new InvalidCredentialsError();
    }

    const dto = aUsuarioDTO(usuario);
    const token = this.firmarToken(dto);

    return {
      success: true,
      message: 'Has iniciado sesión correctamente como administrador',
      token,
      usuario: dto,
    };
  }

  /** Emite un token nuevo con vigencia renovada a partir de un token válido. */
  public async refresh(email: string, nombre: string, role: string): Promise<RefreshResponseDTO> {
    const usuario = await buscarUsuarioPorEmail(email);

    if (!usuario) {
      throw new InvalidCredentialsError();
    }

    const dto = aUsuarioDTO(usuario);
    const token = this.firmarToken(dto);

    return {
      success: true,
      token,
      usuario: dto,
    };
  }

  public async me(email: string, nombre: string, role: string): Promise<MeResponseDTO> {
    const usuario = await buscarUsuarioPorEmail(email);

    if (!usuario) {
      throw new InvalidCredentialsError();
    }

    return {
      success: true,
      usuario: aUsuarioDTO(usuario),
    };
  }

  /**
   * Actualiza la foto de perfil de la cuenta autenticada. Solo recibe una
   * imagen data URL (base64) y la valida antes de persistirla.
   */
  public async actualizarFoto(email: string, foto: string): Promise<void> {
    if (typeof foto !== 'string' || !/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(foto)) {
      throw new Error('La foto debe ser una imagen en formato data URL (JPG, PNG, WebP o GIF).');
    }

    if (foto.length > 600000) {
      throw new Error('La imagen es demasiado grande (máx. 600 KB).');
    }

    await query('UPDATE usuarios SET foto = $1 WHERE LOWER(email) = $2', [foto, email.trim().toLowerCase()]);
  }

  public async googleLogin({ idToken }: GoogleLoginDTO): Promise<LoginResponseDTO> {
    if (!googleClient) {
      throw new Error('Google OAuth no está configurado. Contacta al administrador.');
    }

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload() as GoogleUserInfo;
      
      if (!payload || !payload.email) {
        throw new InvalidCredentialsError();
      }

      let usuario = await buscarUsuarioPorEmail(payload.email);

      if (!usuario) {
        usuario = await crearUsuarioGoogle(payload.email, payload.name, payload.sub, payload.picture);
      } else {
        const nombreNuevo = (payload.name || '').trim() || usuario.nombre;

        // La foto de Google solo se aplica si el usuario aún no tiene una:
        // si alguien subió su propia foto de perfil, esta tiene prioridad y
        // no se pisa con la imagen de Google en logins posteriores.
        const aplicaFotoGoogle = !usuario.foto && !!payload.picture;

        const requiereUpdate =
          !usuario.google_id ||
          nombreNuevo !== usuario.nombre ||
          (aplicaFotoGoogle && payload.picture !== usuario.foto);

        if (requiereUpdate) {
          await query(
            'UPDATE usuarios SET google_id = $1, nombre = $2, foto = COALESCE($3, foto) WHERE LOWER(email) = $4',
            [payload.sub, nombreNuevo, aplicaFotoGoogle ? payload.picture : null, payload.email.trim().toLowerCase()],
          );
          usuario.google_id = payload.sub;
          usuario.nombre = nombreNuevo;
          if (aplicaFotoGoogle) {
            usuario.foto = payload.picture;
          }
        }
      }

      const dto = aUsuarioDTO(usuario);
      const token = this.firmarToken(dto);

      return {
        success: true,
        message: 'Has iniciado sesión correctamente con Google',
        token,
        usuario: dto,
      };
    } catch (error) {
      console.error('[AuthService] Error en googleLogin:', error);
      throw new InvalidCredentialsError();
    }
  }

  private firmarToken(usuario: UsuarioDTO): string {
    const payload: JwtPayloadDTO = { email: usuario.email, nombre: usuario.nombre, role: usuario.role };
    return jwt.sign(payload, JWT_SECRET, JWT_SIGN_OPTIONS);
  }
}

export const authService = new AuthService();