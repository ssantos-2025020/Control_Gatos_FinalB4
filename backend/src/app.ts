import express from 'express';
import cors from 'cors';
import authRoutes from './modules/auth/routes/auth.routes';
import categoriasRoutes from './modules/categorias/routes/categorias.routes';
import gastosRoutes from './modules/gastos/routes/gastos.routes';
import ingresosRoutes from './modules/ingresos/routes/ingresos.routes';
import usuariosRoutes from './modules/usuarios/routes/usuarios.routes';
import presupuestosRoutes from './modules/presupuestos/routes/presupuestos.routes';

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/gastos', gastosRoutes);
app.use('/api/ingresos', ingresosRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/presupuestos', presupuestosRoutes);

export default app;