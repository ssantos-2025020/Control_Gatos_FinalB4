import { Request, Response } from 'express';
import {
  ingresosService,
  IngresoNotFoundError,
  IngresoForbiddenError,
} from '../services/ingresos.service';

class IngresosController {
  public async getIngresos(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    const userRole = req.user?.role as 'ADMIN' | 'USER' | undefined;

    if (!userId || !userRole) {
      res.status(401).json({ message: 'Usuario no autenticado.' });
      return;
    }

    const { search, startDate, endDate } = req.query;

    try {
      const ingresos = await ingresosService.getIngresos(userId, userRole, {
        search: search as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.status(200).json(ingresos);
    } catch (error) {
      console.error('[IngresosController] Error al obtener ingresos:', error);
      res.status(500).json({ message: 'Error al obtener ingresos.' });
    }
  }

  public async getIngresoById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role as 'ADMIN' | 'USER' | undefined;

    if (!userId || !userRole) {
      res.status(401).json({ message: 'Usuario no autenticado.' });
      return;
    }

    try {
      const ingreso = await ingresosService.getIngresoById(id, userId, userRole);
      res.status(200).json(ingreso);
    } catch (error) {
      if (error instanceof IngresoNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error instanceof IngresoForbiddenError) {
        res.status(403).json({ message: error.message });
        return;
      }
      console.error('[IngresosController] Error al obtener ingreso:', error);
      res.status(500).json({ message: 'Error al obtener ingreso.' });
    }
  }

  public async createIngreso(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Usuario no autenticado.' });
      return;
    }

    const { descripcion, monto, fecha, categoria, metodo } = req.body;

    if (!descripcion || monto === undefined) {
      res.status(400).json({ message: 'Descripción y monto son campos obligatorios.' });
      return;
    }

    if (descripcion.trim() === '') {
      res.status(400).json({ message: 'Descripción es un campo obligatorio.' });
      return;
    }

    if (isNaN(Number(monto)) || Number(monto) <= 0) {
      res.status(400).json({ message: 'El monto debe ser un número positivo.' });
      return;
    }

    try {
      const nuevo = await ingresosService.createIngreso(userId, {
        descripcion,
        monto,
        fecha,
        categoria,
        metodo,
      });
      res.status(201).json(nuevo);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Error al registrar el ingreso.' });
    }
  }

  public async updateIngreso(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role as 'ADMIN' | 'USER' | undefined;

    if (!userId || !userRole) {
      res.status(401).json({ message: 'Usuario no autenticado.' });
      return;
    }

    const { descripcion, monto, fecha, categoria, metodo } = req.body;

    if (monto !== undefined && (isNaN(Number(monto)) || Number(monto) <= 0)) {
      res.status(400).json({ message: 'El monto debe ser un número positivo.' });
      return;
    }

    try {
      const actualizado = await ingresosService.updateIngreso(id, userId, userRole, {
        descripcion,
        monto,
        fecha,
        categoria,
        metodo,
      });
      res.status(200).json(actualizado);
    } catch (error: any) {
      if (error instanceof IngresoNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error instanceof IngresoForbiddenError) {
        res.status(403).json({ message: error.message });
        return;
      }
      res.status(400).json({ message: error.message || 'Error al actualizar el ingreso.' });
    }
  }

  public async deleteIngreso(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role as 'ADMIN' | 'USER' | undefined;

    if (!userId || !userRole) {
      res.status(401).json({ message: 'Usuario no autenticado.' });
      return;
    }

    try {
      await ingresosService.deleteIngreso(id, userId, userRole);
      res.status(200).json({ message: 'Ingreso eliminado exitosamente.' });
    } catch (error: any) {
      if (error instanceof IngresoNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error instanceof IngresoForbiddenError) {
        res.status(403).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: error.message || 'Error al eliminar el ingreso.' });
    }
  }
}

export const ingresosController = new IngresosController();