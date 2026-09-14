import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// POST /api/auth/login
router.post('/login', (req, res) => authController.login(req, res));

// POST /api/auth/google -> login con Google
router.post('/google', (req, res) => authController.googleLogin(req, res));

// GET /api/auth/me (protegido con JWT)
router.get('/me', requireAuth, (req, res) => authController.me(req, res));

// POST /api/auth/refresh -> renueva el token con un token aún válido
router.post('/refresh', requireAuth, (req, res) => authController.refresh(req, res));

// PUT /api/auth/foto -> actualiza la foto de perfil de la cuenta autenticada
router.put('/foto', requireAuth, (req, res) => authController.cambiarFoto(req, res));

export default router;
