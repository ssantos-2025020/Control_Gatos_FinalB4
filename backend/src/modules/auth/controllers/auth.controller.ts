import { Request, Response } from 'express';
import { authService, InvalidCredentialsError } from '../services/auth.service';
import { LoginDTO, GoogleLoginDTO } from '../models/auth.model';
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

  /** Actualiza la foto de perfil de la cuenta autenticada (solo la propia). */
  public async cambiarFoto(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { email } = req.user ?? {};
    const foto = (req.body as { foto?: unknown })?.foto;

    if (!email) {
      res.status(401).json({ success: false, message: 'Sesión no válida.' });
      return;
    }

    if (!foto || typeof foto !== 'string' || foto.trim() === '') {
      res.status(400).json({ success: false, message: 'La foto es obligatoria.' });
      return;
    }

    try {
      await authService.actualizarFoto(email, foto);
      res.status(200).json({ success: true, message: 'Foto de perfil actualizada.' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error?.message ?? 'No se pudo actualizar la foto.' });
    }
  }

  public async googleLogin(req: Request, res: Response): Promise<void> {
    const { idToken } = req.body as GoogleLoginDTO;

    if (!idToken || idToken.trim() === '') {
      res.status(400).json({ success: false, message: 'El token de Google es obligatorio.' });
      return;
    }

    try {
      const resultado = await authService.googleLogin({ idToken });
      res.status(200).json(resultado);
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        res.status(401).json({ success: false, message: error.message });
        return;
      }

      console.error('[AuthController] Error en googleLogin:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
  }
}

export const authController = new AuthController();