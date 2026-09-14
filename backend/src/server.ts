import 'dotenv/config';
import app from './app';
import { initDatabase } from './shared/database/init-database';
import { seedTestData } from './shared/database/seed-data';
import { checkAdmin } from './shared/database/check-admin';
import { query } from './shared/database/database.service';

// Log para verificar variables de entorno
console.log('[Server] Variables de entorno cargadas:');
console.log('[Server] GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ Configurado' : '❌ No configurado');
console.log('[Server] JWT_SECRET:', process.env.JWT_SECRET ? '✅ Configurado' : '❌ No configurado');

const PORT = Number(process.env.PORT ?? 2500);

async function main(): Promise<void> {
  await initDatabase();
  // await restaurarRolAdmin(); // Desactivado - ejecutado una vez
  // await limpiarCategorias(); // Desactivado - limpieza única ejecutada
  // await limpiarDatosPrueba(); // Desactivado - limpieza única ejecutada
  // await seedTestData(); // Desactivado para no generar datos de prueba automáticamente
  await checkAdmin();
  app.listen(PORT, () => {
    console.log(`[Server] Login Control de Gastos API escuchando en http://localhost:${PORT}`);
  });
}

async function restaurarRolAdmin(): Promise<void> {
  console.log('[Server] Restaurando rol del admin a ADMIN...');
  
  try {
    await query(`UPDATE usuarios SET role = 'ADMIN' WHERE email = 'admin@controlgastos.com'`);
    console.log('[Server] ✅ Rol del admin restaurado a ADMIN');
  } catch (error) {
    console.error('[Server] Error al restaurar rol del admin:', error);
  }
}

async function cambiarRolUsuario(): Promise<void> {
  console.log('[Server] Cambiando rol de usuario de ADMIN a USER...');
  
  try {
    // Cambiar el rol del usuario principal a USER
    const result = await query(`UPDATE usuarios SET role = 'USER' WHERE email = 'admin@controlgastos.com' AND role = 'ADMIN'`);
    console.log('[Server] ✅ Rol del usuario cambiado a USER');
  } catch (error) {
    console.error('[Server] Error al cambiar rol del usuario:', error);
  }
}

main().catch((error) => {
  console.error('[Server] Error al inicializar la base de datos:', error);
  process.exit(1);
});