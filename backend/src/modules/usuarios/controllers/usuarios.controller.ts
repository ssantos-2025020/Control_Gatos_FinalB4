import { Request, Response } from 'express';
import {
  usuariosService,
  UsuarioNotFoundError,
  UsuarioEmailInUseError,
  UsuarioLastAdminError,
  UsuarioSelfDeleteError,
} from '../services/usuarios.service';
import { CreateUsuarioDTO, UpdateUsuarioDTO } from '../models/usuarios.model';

class UsuariosController {
  public async getUsuarios(req: Request, res: Response): Promise<void> {
    try {
      const usuarios = await usuariosService.getUsuarios();
      res.status(200).json(usuarios);
    } catch (error) {
      console.error('[UsuariosController] Error al obtener usuarios:', error);
      res.status(500).json({ message: 'Error al obtener usuarios.' });
    }
  }

  public async getUsuarioById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      const usuario = await usuariosService.getUsuarioById(id);
      if (!usuario) {
        res.status(404).json({ message: 'Usuario no encontrado.' });
        return;
      }
      res.status(200).json(usuario);
    } catch (error) {
      console.error('[UsuariosController] Error al obtener usuario:', error);
      res.status(500).json({ message: 'Error al obtener usuario.' });
    }
  }

  public async createUsuario(req: Request, res: Response): Promise<void> {
    const data = req.body as CreateUsuarioDTO;

    if (!data.email || !data.nombre || !data.password) {
      res.status(400).json({ message: 'Email, nombre y contraseña son obligatorios.' });
      return;
    }

    if (data.email.trim() === '' || data.nombre.trim() === '' || data.password.trim() === '') {
      res.status(400).json({ message: 'Email, nombre y contraseña son obligatorios.' });
      return;
    }

    try {
      const usuario = await usuariosService.createUsuario(data);
      res.status(201).json(usuario);
    } catch (error: any) {
      if (error instanceof UsuarioEmailInUseError) {
        res.status(409).json({ message: error.message });
        return;
      }
      res.status(400).json({ message: error.message || 'Error al crear el usuario.' });
    }
  }

  public async updateUsuario(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const requestingUserId = req.user?.id;

    if (!requestingUserId) {
      res.status(401).json({ message: 'Usuario no autenticado.' });
      return;
    }

    const data = req.body as UpdateUsuarioDTO;

    try {
      const usuario = await usuariosService.updateUsuario(id, data, requestingUserId);
      res.status(200).json(usuario);
    } catch (error: any) {
      if (error instanceof UsuarioNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error instanceof UsuarioEmailInUseError) {
        res.status(409).json({ message: error.message });
        return;
      }
      if (error instanceof UsuarioLastAdminError) {
        res.status(400).json({ message: error.message });
        return;
      }
      res.status(400).json({ message: error.message || 'Error al actualizar el usuario.' });
    }
  }

  public async deleteUsuario(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const requestingUserId = req.user?.id;

    if (!requestingUserId) {
      res.status(401).json({ message: 'Usuario no autenticado.' });
      return;
    }

    try {
      await usuariosService.deleteUsuario(id, requestingUserId);
      res.status(200).json({ message: 'Usuario eliminado exitosamente.' });
    } catch (error: any) {
      if (error instanceof UsuarioNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error instanceof UsuarioSelfDeleteError) {
        res.status(400).json({ message: error.message });
        return;
      }
      if (error instanceof UsuarioLastAdminError) {
        res.status(400).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: error.message || 'Error al eliminar el usuario.' });
    }
  }
}

export const usuariosController = new UsuariosController();