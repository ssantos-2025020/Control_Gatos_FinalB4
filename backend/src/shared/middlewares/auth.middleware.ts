import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/jwt';
import { query } from '../database/database.service';

export interface AuthPayload {
  id?: string;
  email: string;
  nombre: string;
  role: string;
}

// Extiende Request para adjuntar el usuario autenticado.
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/**
 * Middleware para las rutas de datos. Valida el header
 * "Authorization: Bearer <token>" firmado por el backend (payload
 * { email, nombre, role }) y resuelve el id del usuario desde la base de
 * datos, adjuntando { id, email, role } en req.user para que los
 * controladores trabajen igual que con otras implementaciones.
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Token no proporcionado.' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      email?: string;
      nombre?: string;
      role?: string;
    };

    if (!payload.email) {
      res.status(401).json({ message: 'Token inválido o expirado.' });
      return;
    }

    const filas = await query<{ id: string; role: string }>(
      'SELECT id, role FROM usuarios WHERE LOWER(email) = $1',
      [payload.email.trim().toLowerCase()],
    );

    const usuario = filas[0];

    if (!usuario) {
      res.status(401).json({ message: 'Usuario no encontrado.' });
      return;
    }

    req.user = {
      id: usuario.id,
      email: payload.email,
      nombre: payload.nombre ?? '',
      role: usuario.role,
    };

    next();
  } catch (error) {
    res.status(401).json({ message: 'Token inválido o expirado.' });
  }
}

/**
 * Middleware opcional para restringir acceso solo a administradores.
 * Debe usarse después de authMiddleware.
 */
export function adminOnlyMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ message: 'Acceso restringido a administradores.' });
    return;
  }
  next();
}