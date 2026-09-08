import { Request, Response } from 'express';
import {
  gastosService,
  GastoNotFoundError,
  GastoForbiddenError,
  GastoCategoryNotFoundError,
} from '../services/gastos.service';

class GastosController {
  public async getGastos(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    const userRole = req.user?.role as 'ADMIN' | 'USER' | undefined;

    if (!userId || !userRole) {
      res.status(401).json({ message: 'Usuario no autenticado.' });
      return;
    }

    const { categoryId, search, startDate, endDate } = req.query;

    try {
      const gastos = await gastosService.getGastos(userId, userRole, {
        categoryId: categoryId as string,
        search: search as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.status(200).json(gastos);
    } catch (error) {
      console.error('[GastosController] Error al obtener gastos:', error);
      res.status(500).json({ message: 'Error al obtener gastos.' });
    }
  }

  public async getGastoById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role as 'ADMIN' | 'USER' | undefined;

    if (!userId || !userRole) {
      res.status(401).json({ message: 'Usuario no autenticado.' });
      return;
    }

    try {
      const gasto = await gastosService.getGastoById(id, userId, userRole);
      res.status(200).json(gasto);
    } catch (error) {
      if (error instanceof GastoNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error instanceof GastoForbiddenError) {
        res.status(403).json({ message: error.message });
        return;
      }
      console.error('[GastosController] Error al obtener gasto:', error);
      res.status(500).json({ message: 'Error al obtener gasto.' });
    }
  }

  public async createGasto(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Usuario no autenticado.' });
      return;
    }

    const { descripcion, monto, fecha, categoriaId, metodo } = req.body;

    if (!descripcion || monto === undefined || !categoriaId) {
      res.status(400).json({ message: 'Descripción, monto y categoría son campos obligatorios.' });
      return;
    }

    if (descripcion.trim() === '' || categoriaId.trim() === '') {
      res.status(400).json({ message: 'Descripción y categoría son campos obligatorios.' });
      return;
    }

    if (isNaN(Number(monto)) || Number(monto) <= 0) {
      res.status(400).json({ message: 'El monto debe ser un número positivo.' });
      return;
    }

    try {
      const nuevo = await gastosService.createGasto(userId, {
        descripcion,
        monto,
        fecha,
        categoriaId,
        metodo,
      });
      res.status(201).json(nuevo);
    } catch (error: any) {
      if (error instanceof GastoCategoryNotFoundError) {
        res.status(400).json({ message: error.message });
        return;
      }
      res.status(400).json({ message: error.message || 'Error al registrar el gasto.' });
    }
  }

  public async updateGasto(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role as 'ADMIN' | 'USER' | undefined;

    if (!userId || !userRole) {
      res.status(401).json({ message: 'Usuario no autenticado.' });
      return;
    }

    const { descripcion, monto, fecha, categoriaId, metodo } = req.body;

    if (monto !== undefined && (isNaN(Number(monto)) || Number(monto) <= 0)) {
      res.status(400).json({ message: 'El monto debe ser un número positivo.' });
      return;
    }

    try {
      const actualizado = await gastosService.updateGasto(id, userId, userRole, {
        descripcion,
        monto,
        fecha,
        categoriaId,
        metodo,
      });
      res.status(200).json(actualizado);
    } catch (error: any) {
      if (error instanceof GastoNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error instanceof GastoForbiddenError) {
        res.status(403).json({ message: error.message });
        return;
      }
      if (error instanceof GastoCategoryNotFoundError) {
        res.status(400).json({ message: error.message });
        return;
      }
      res.status(400).json({ message: error.message || 'Error al actualizar el gasto.' });
    }
  }

  public async deleteGasto(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role as 'ADMIN' | 'USER' | undefined;

    if (!userId || !userRole) {
      res.status(401).json({ message: 'Usuario no autenticado.' });
      return;
    }

    try {
      await gastosService.deleteGasto(id, userId, userRole);
      res.status(200).json({ message: 'Gasto eliminado exitosamente.' });
    } catch (error: any) {
      if (error instanceof GastoNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error instanceof GastoForbiddenError) {
        res.status(403).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: error.message || 'Error al eliminar el gasto.' });
    }
  }
}

export const gastosController = new GastosController();