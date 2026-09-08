import 'dotenv/config';
import app from './app';
import { initDatabase } from './shared/database/init-database';
import { seedTestData } from './shared/database/seed-data';
import { checkAdmin } from './shared/database/check-admin';

const PORT = Number(process.env.PORT ?? 3100);

async function main(): Promise<void> {
  await initDatabase();
  await seedTestData();
  await checkAdmin();
  app.listen(PORT, () => {
    console.log(`[Server] Login Control de Gastos API escuchando en http://localhost:${PORT}`);
  });
}

main().catch((error) => {
  console.error('[Server] Error al inicializar la base de datos:', error);
  process.exit(1);
});