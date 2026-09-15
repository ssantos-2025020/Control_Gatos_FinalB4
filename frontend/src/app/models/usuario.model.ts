export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  role: 'ADMIN' | 'USER';
  usuario?: string;
  color?: string;
  activo?: boolean;
  fechaRegistro?: string;
  createdAt?: string;
  esMock?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  usuario: Usuario;
}
