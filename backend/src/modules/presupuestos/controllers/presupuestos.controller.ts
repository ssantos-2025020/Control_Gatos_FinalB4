import { Request, Response } from 'express';
import {
  presupuestosService,
  PresupuestoNotFoundError,
} from '../services/presupuestos.service';

class PresupuestosController {
  public async getPresupuestos(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Usuario no autenticado.' });
      return;
    }

    try {
      const presupuestos = await presupuestosService.getPresupuestos(userId);
      res.status(200).json(presupuestos);
    } catch (error) {
      console.error('[PresupuestosController] Error al obtener presupuestos:', error);
      res.status(500).json({ message: 'Error al obtener presupuestos.' });
    }
  }

  public async getPresupuestoById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Usuario no autenticado.' });
      return;
    }

    try {
      const presupuesto = await presupuestosService.getPresupuestoById(id, userId);
      if (!presupuesto) {
        res.status(404).json({ message: 'Presupuesto no encontrado.' });
        return;
      }
      res.status(200).json(presupuesto);
    } catch (error) {
      console.error('[PresupuestosController] Error al obtener presupuesto:', error);
      res.status(500).json({ message: 'Error al obtener presupuesto.' });
    }
  }

  public async createPresupuesto(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Usuario no autenticado.' });
      return;
    }

    const { categoriaId, monto } = req.body;

    if (!categoriaId) {
      res.status(400).json({ message: 'La categoría es obligatoria.' });
      return;
    }

    if (monto === undefined || monto === null) {
      res.status(400).json({ message: 'El monto es obligatorio.' });
      return;
    }

    if (isNaN(Number(monto)) || Number(monto) < 0) {
      res.status(400).json({ message: 'El monto debe ser un número mayor o igual a cero.' });
      return;
    }

    try {
      const presupuesto = await presupuestosService.createPresupuesto(
        userId,
        categoriaId,
        Number(monto),
      );
      res.status(201).json(presupuesto);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Error al crear el presupuesto.' });
    }
  }

  public async updateMonto(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { monto } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Usuario no autenticado.' });
      return;
    }

    if (monto === undefined || monto === null) {
      res.status(400).json({ message: 'El monto es obligatorio.' });
      return;
    }

    if (isNaN(Number(monto)) || Number(monto) < 0) {
      res.status(400).json({ message: 'El monto debe ser un número mayor o igual a cero.' });
      return;
    }

    try {
      const presupuesto = await presupuestosService.updateMonto(id, Number(monto), userId);
      res.status(200).json(presupuesto);
    } catch (error: any) {
      if (error instanceof PresupuestoNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      res.status(400).json({ message: error.message || 'Error al actualizar el presupuesto.' });
    }
  }

  public async deletePresupuesto(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Usuario no autenticado.' });
      return;
    }

    try {
      await presupuestosService.deletePresupuesto(id, userId);
      res.status(204).send();
    } catch (error: any) {
      if (error instanceof PresupuestoNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      console.error('[PresupuestosController] Error al eliminar presupuesto:', error);
      res.status(500).json({ message: 'Error al eliminar el presupuesto.' });
    }
  }
}

export const presupuestosController = new PresupuestosController();