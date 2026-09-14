import { Request, Response } from 'express';
import { categoriasService, CategoriaNotFoundError, CategoriaProtegidaError } from '../services/categorias.service';
import { CreateCategoriaDTO, UpdateCategoriaDTO } from '../models/categorias.model';

class CategoriasController {
  public async getCategorias(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Usuario no autenticado.' });
      return;
    }

    try {
      const categorias = await categoriasService.getCategorias(userId);
      res.status(200).json(categorias);
    } catch (error) {
      console.error('[CategoriasController] Error al obtener categorías:', error);
      res.status(500).json({ message: 'Error interno del servidor.' });
    }
  }

  public async getCategoriaById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Usuario no autenticado.' });
      return;
    }

    try {
      const categoria = await categoriasService.getCategoriaById(id, userId);
      if (!categoria) {
        res.status(404).json({ message: 'Categoría no encontrada.' });
        return;
      }
      res.status(200).json(categoria);
    } catch (error) {
      console.error('[CategoriasController] Error al obtener categoría:', error);
      res.status(500).json({ message: 'Error interno del servidor.' });
    }
  }

  public async createCategoria(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    const data = req.body as CreateCategoriaDTO;

    if (!userId) {
      res.status(401).json({ message: 'Usuario no autenticado.' });
      return;
    }

    if (!data.nombre || data.nombre.trim() === '') {
      res.status(400).json({ message: 'El nombre de la categoría es obligatorio.' });
      return;
    }

    try {
      const categoria = await categoriasService.createCategoria(userId, data);
      res.status(201).json(categoria);
    } catch (error: any) {
      if (error.message === 'No se pudo crear la categoría.') {
        res.status(400).json({ message: error.message });
        return;
      }
      if (error.message?.includes('tipo de categoría')) {
        res.status(400).json({ message: error.message });
        return;
      }
      console.error('[CategoriasController] Error al crear categoría:', error);
      res.status(500).json({ message: 'Error interno del servidor.' });
    }
  }

  public async updateCategoria(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = req.user?.id;
    const data = req.body as UpdateCategoriaDTO;

    if (!userId) {
      res.status(401).json({ message: 'Usuario no autenticado.' });
      return;
    }

    try {
      const categoria = await categoriasService.updateCategoria(id, userId, data);
      res.status(200).json(categoria);
    } catch (error: any) {
      if (error instanceof CategoriaNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error.message?.includes('tipo de categoría')) {
        res.status(400).json({ message: error.message });
        return;
      }
      console.error('[CategoriasController] Error al actualizar categoría:', error);
      res.status(500).json({ message: 'Error interno del servidor.' });
    }
  }

  public async deleteCategoria(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Usuario no autenticado.' });
      return;
    }

    try {
      await categoriasService.deleteCategoria(id, userId);
      res.status(204).send();
    } catch (error) {
      if (error instanceof CategoriaNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error instanceof CategoriaProtegidaError) {
        res.status(400).json({ message: error.message });
        return;
      }
      console.error('[CategoriasController] Error al eliminar categoría:', error);
      res.status(500).json({ message: 'Error interno del servidor.' });
    }
  }
}

export const categoriasController = new CategoriasController();