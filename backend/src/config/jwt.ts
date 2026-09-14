import type { SignOptions } from 'jsonwebtoken';

if (!process.env.JWT_SECRET) {
  throw new Error('La variable de entorno JWT_SECRET es obligatoria.');
}
export const JWT_SECRET = process.env.JWT_SECRET;

// TEMPORAL: Google Client ID directo hasta resolver problema con .env
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '879432250502-la0hitfpf8obq59vu6p5f22dsom9hlka.apps.googleusercontent.com';

export const JWT_SIGN_OPTIONS: SignOptions = {
  expiresIn: (process.env.JWT_EXPIRES_IN ?? '3h') as SignOptions['expiresIn'],
};