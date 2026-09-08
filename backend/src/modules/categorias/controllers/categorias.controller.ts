import { Request, Response } from 'express';
import { categoriasService, CategoriaNotFoundError } from '../services/categorias.service';
import { CreateCategoriaDTO, UpdateCategoriaDTO } from '../models/categorias.model';

class CategoriasController {
  public async getCategorias(req: Request, res: Response): Promise<void> {
    try {
      const categorias = await categoriasService.getCategorias();
      res.status(200).json(categorias);
    } catch (error) {
      console.error('[CategoriasController] Error al obtener categorías:', error);
      res.status(500).json({ message: 'Error interno del servidor.' });
    }
  }

  public async getCategoriaById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      const categoria = await categoriasService.getCategoriaById(id);
      res.status(200).json(categoria);
    } catch (error) {
      console.error('[CategoriasController] Error al obtener categoría:', error);
      res.status(500).json({ message: 'Error interno del servidor.' });
    }
  }

  public async createCategoria(req: Request, res: Response): Promise<void> {
    const data = req.body as CreateCategoriaDTO;

    if (!data.nombre || data.nombre.trim() === '') {
      res.status(400).json({ message: 'El nombre de la categoría es obligatorio.' });
      return;
    }

    try {
      const categoria = await categoriasService.createCategoria(data);
      res.status(201).json(categoria);
    } catch (error: any) {
      if (error.message === 'No se pudo crear la categoría.') {
        res.status(400).json({ message: error.message });
        return;
      }
      console.error('[CategoriasController] Error al crear categoría:', error);
      res.status(500).json({ message: 'Error interno del servidor.' });
    }
  }

  public async updateCategoria(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const data = req.body as UpdateCategoriaDTO;

    try {
      const categoria = await categoriasService.updateCategoria(id, data);
      res.status(200).json(categoria);
    } catch (error) {
      if (error instanceof CategoriaNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      console.error('[CategoriasController] Error al actualizar categoría:', error);
      res.status(500).json({ message: 'Error interno del servidor.' });
    }
  }

  public async deleteCategoria(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      await categoriasService.deleteCategoria(id);
      res.status(204).send();
    } catch (error) {
      if (error instanceof CategoriaNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      console.error('[CategoriasController] Error al eliminar categoría:', error);
      res.status(500).json({ message: 'Error interno del servidor.' });
    }
  }
}

export const categoriasController = new CategoriasController();