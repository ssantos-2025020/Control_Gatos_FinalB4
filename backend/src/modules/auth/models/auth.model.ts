/**
 * DTOs (Data Transfer Objects) del módulo auth.
 * Las credenciales se validan contra PostgreSQL (tabla usuarios) vía pg.
 */

export interface LoginDTO {
  email: string;
  password: string;
}

export interface UsuarioDTO {
  email: string;
  nombre: string;
  role: string;
  foto?: string;
}

export interface LoginResponseDTO {
  success: boolean;
  message: string;
  token: string;
  usuario: UsuarioDTO;
}

export interface RefreshResponseDTO {
  success: boolean;
  token: string;
  usuario: UsuarioDTO;
}

export interface JwtPayloadDTO {
  email: string;
  nombre: string;
  role: string;
}

export interface MeResponseDTO {
  success: boolean;
  usuario: UsuarioDTO;
}

export interface GoogleLoginDTO {
  idToken: string;
}

export interface GoogleUserInfo {
  email: string;
  name: string;
  picture?: string;
  sub: string;
}
