import { Request, Response } from 'express';
import {
  papeleraService,
  TIPOS_PAPELERA,
  TipoPapelera,
  PapeleraTipoInvalidoError,
  PapeleraItemNotFoundError,
  PapeleraConflictoError,
} from '../services/papelera.service';

class PapeleraController {
  public async getPapelera(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Usuario no autenticado.' });
      return;
    }

    try {
      const contenido = await papeleraService.getPapelera(userId);
      res.status(200).json(contenido);
    } catch (error) {
      console.error('[PapeleraController] Error al obtener la papelera:', error);
      res.status(500).json({ message: 'Error al obtener la papelera.' });
    }
  }

  public async restaurar(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    const { tipo, id } = req.params;

    if (!userId) {
      res.status(401).json({ message: 'Usuario no autenticado.' });
      return;
    }

    if (!TIPOS_PAPELERA.includes(tipo as TipoPapelera)) {
      res.status(400).json({ message: 'Tipo de elemento de papelera inválido.' });
      return;
    }

    try {
      const resultado = await papeleraService.restaurar(tipo as TipoPapelera, id, userId);
      res.status(200).json(resultado);
    } catch (error) {
      if (error instanceof PapeleraItemNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error instanceof PapeleraConflictoError) {
        res.status(409).json({ message: error.message });
        return;
      }
      console.error('[PapeleraController] Error al restaurar elemento:', error);
      res.status(500).json({ message: 'Error al restaurar el elemento.' });
    }
  }

  public async restaurarTodo(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    const { tipo } = req.params;

    if (!userId) {
      res.status(401).json({ message: 'Usuario no autenticado.' });
      return;
    }

    if (!TIPOS_PAPELERA.includes(tipo as TipoPapelera)) {
      res.status(400).json({ message: 'Tipo de elemento de papelera inválido.' });
      return;
    }

    try {
      const resultado = await papeleraService.restaurarTodo(tipo as TipoPapelera, userId);
      res.status(200).json(resultado);
    } catch (error) {
      console.error('[PapeleraController] Error al restaurar todo:', error);
      res.status(500).json({ message: 'Error al restaurar todos los elementos.' });
    }
  }

  public async eliminarPermanente(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    const { tipo, id } = req.params;

    if (!userId) {
      res.status(401).json({ message: 'Usuario no autenticado.' });
      return;
    }

    if (!TIPOS_PAPELERA.includes(tipo as TipoPapelera)) {
      res.status(400).json({ message: 'Tipo de elemento de papelera inválido.' });
      return;
    }

    try {
      const resultado = await papeleraService.eliminarPermanente(tipo as TipoPapelera, id, userId);
      res.status(200).json(resultado);
    } catch (error) {
      if (error instanceof PapeleraItemNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      console.error('[PapeleraController] Error al eliminar definitivamente:', error);
      res.status(500).json({ message: 'Error al eliminar definitivamente el elemento.' });
    }
  }

  public async vaciar(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Usuario no autenticado.' });
      return;
    }

    try {
      const resultado = await papeleraService.vaciar(userId);
      res.status(200).json(resultado);
    } catch (error) {
      console.error('[PapeleraController] Error al vaciar la papelera:', error);
      res.status(500).json({ message: 'Error al vaciar la papelera.' });
    }
  }
}

export const papeleraController = new PapeleraController();