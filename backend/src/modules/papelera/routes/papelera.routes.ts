import { Router } from 'express';
import { papeleraController } from '../controllers/papelera.controller';
import { authMiddleware } from '../../../shared/middlewares/auth.middleware';

const router = Router();

router.get('/', authMiddleware, (req, res) => papeleraController.getPapelera(req, res));
router.post('/:tipo/:id/restaurar', authMiddleware, (req, res) => papeleraController.restaurar(req, res));
router.delete('/:tipo/:id/permanente', authMiddleware, (req, res) => papeleraController.eliminarPermanente(req, res));
router.delete('/vaciar', authMiddleware, (req, res) => papeleraController.vaciar(req, res));

export default router;