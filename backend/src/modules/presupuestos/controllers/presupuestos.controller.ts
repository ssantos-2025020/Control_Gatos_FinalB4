import { Request, Response } from 'express';
import {
  presupuestosService,
  PresupuestoNotFoundError,
} from '../services/presupuestos.service';

class PresupuestosController {
  public async getPresupuestos(req: Request, res: Response): Promise<void> {
    try {
      const presupuestos = await presupuestosService.getPresupuestos();
      res.status(200).json(presupuestos);
    } catch (error) {
      console.error('[PresupuestosController] Error al obtener presupuestos:', error);
      res.status(500).json({ message: 'Error al obtener presupuestos.' });
    }
  }

  public async getPresupuestoById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      const presupuesto = await presupuestosService.getPresupuestoById(id);
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

  public async updateMonto(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { monto } = req.body;

    if (monto === undefined || monto === null) {
      res.status(400).json({ message: 'El monto es obligatorio.' });
      return;
    }

    if (isNaN(Number(monto)) || Number(monto) < 0) {
      res.status(400).json({ message: 'El monto debe ser un número mayor o igual a cero.' });
      return;
    }

    try {
      const presupuesto = await presupuestosService.updateMonto(id, Number(monto));
      res.status(200).json(presupuesto);
    } catch (error: any) {
      if (error instanceof PresupuestoNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      res.status(400).json({ message: error.message || 'Error al actualizar el presupuesto.' });
    }
  }
}

export const presupuestosController = new PresupuestosController();