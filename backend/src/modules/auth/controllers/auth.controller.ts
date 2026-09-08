import { Request, Response } from 'express';
import { authService, InvalidCredentialsError } from '../services/auth.service';
import { LoginDTO } from '../models/auth.model';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

class AuthController {
  public async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body as LoginDTO;

    if (!email || !password || email.trim() === '' || password.trim() === '') {
      res.status(400).json({ success: false, message: 'Correo y contraseña son obligatorios.' });
      return;
    }

    try {
      const resultado = await authService.login({ email, password });
      res.status(200).json(resultado);
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        res.status(401).json({ success: false, message: error.message });
        return;
      }

      console.error('[AuthController] Error en login:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
  }

  public async me(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { email, nombre, role } = req.user ?? {};

    try {
      res.status(200).json(await authService.me(email ?? '', nombre ?? '', role ?? ''));
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        res.status(401).json({ success: false, message: error.message });
        return;
      }

      console.error('[AuthController] Error en me:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
  }

  /** Renueva el token con vigencia nueva. Solo funciona con un token aún válido. */
  public async refresh(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { email, nombre, role } = req.user ?? {};

    if (!email) {
      res.status(401).json({ success: false, message: 'Sesión no válida.' });
      return;
    }

    try {
      res.status(200).json(await authService.refresh(email, nombre ?? '', role ?? ''));
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        res.status(401).json({ success: false, message: error.message });
        return;
      }

      console.error('[AuthController] Error en refresh:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
  }
}

export const authController = new AuthController();