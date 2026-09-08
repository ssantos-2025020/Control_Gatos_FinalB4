import bcrypt from 'bcrypt';
import { query } from './database.service';

const SALT_ROUNDS = 10;

const CATEGORIAS_DEFAULT = [
  'Alimentacion',
  'Transporte',
  'Vivienda',
  'Servicios Publicos',
  'Comunicaciones',
  'Salud',
  'Educacion',
  'Entretenimiento',
  'Ropa y Calzado',
  'Compras',
  'Viajes',
  'Mascotas',
  'Seguros',
  'Impuestos',
  'Ahorro e Inversion',
  'Otros',
];

/** Límites mensuales de presupuesto por categoría (datos reales de la BD). */
const PRESUPUESTOS_DEFAULT: Record<string, number> = {
  Alimentacion: 800,
  Transporte: 300,
  Vivienda: 1200,
  'Servicios Publicos': 250,
  Comunicaciones: 150,
  Salud: 350,
  Educacion: 400,
  Entretenimiento: 250,
  'Ropa y Calzado': 200,
  Compras: 300,
  Viajes: 500,
  Mascotas: 120,
  Seguros: 250,
  Impuestos: 500,
  'Ahorro e Inversion': 600,
  Otros: 200,
};

/**
 * Inicializa la base de datos (idempotente): crea la tabla de
 * presupuestos y las columnas extra de ingresos, y siembra el catálogo
 * de categorías, el presupuesto mensual por categoría y el usuario
 * administrador cuando no existen.
 */
export async function initDatabase(): Promise<void> {
  await crearTablas();
  await seedCategorias();
  await seedPresupuestos();
  await seedAdminUser();
}

async function crearTablas(): Promise<void> {
  // La tabla es nueva (se creó en esta versión con ids uuid por error) y
  // está vacía: se recrea con ids text, igual que el resto de tablas del
  // esquema (Prisma mapea @default(uuid()) a text).
  // Solo recrear la tabla si está vacía para evitar pérdida de datos en producción
  const count = await query<{ count: string }>('SELECT COUNT(*)::text as count FROM presupuestos');
  if (count[0]?.count === '0') {
    await query(`DROP TABLE IF EXISTS presupuestos`);
    await query(`
      CREATE TABLE IF NOT EXISTS presupuestos (
        id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "categoriaId" text NOT NULL UNIQUE,
        monto       numeric(10,2) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  } else {
    // Si la tabla tiene datos, solo asegurarse de que exista
    await query(`
      CREATE TABLE IF NOT EXISTS presupuestos (
        id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "categoriaId" text NOT NULL UNIQUE,
        monto       numeric(10,2) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  // El módulo de ingresos guarda categoría y método como texto libre
  // (igual que la UI de la aplicación).
  await query(`ALTER TABLE ingresos ADD COLUMN IF NOT EXISTS categoria text`);
  await query(`ALTER TABLE ingresos ADD COLUMN IF NOT EXISTS metodo text`);

  // El módulo de gastos también necesita el campo método de pago
  await query(`ALTER TABLE gastos ADD COLUMN IF NOT EXISTS metodo text`);
}

async function seedCategorias(): Promise<void> {
  for (const nombre of CATEGORIAS_DEFAULT) {
    await query(
      `INSERT INTO categorias (id, nombre, "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, now(), now())
       ON CONFLICT (nombre) DO NOTHING`,
      [nombre],
    );
  }
}

async function seedPresupuestos(): Promise<void> {
  for (const [nombre, monto] of Object.entries(PRESUPUESTOS_DEFAULT)) {
    await query(
      `INSERT INTO presupuestos (id, "categoriaId", monto, "createdAt", "updatedAt")
       SELECT gen_random_uuid()::text, c.id, $1::numeric, now(), now()
       FROM categorias c
       WHERE c.nombre = $2::text
       ON CONFLICT ("categoriaId") DO NOTHING`,
      [monto, nombre],
    );
  }
}

async function seedAdminUser(): Promise<void> {
  const filas = await query<{ email: string }>('SELECT email FROM usuarios WHERE role = $1 LIMIT 1', ['ADMIN']);

  if (filas.length > 0) {
    return;
  }

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@controlgastos.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
  const adminNombre = process.env.ADMIN_NOMBRE || 'Administrador';
  const hash = await bcrypt.hash(adminPassword, SALT_ROUNDS);

  await query(
    `INSERT INTO usuarios (id, email, nombre, password, role, "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4::"Role", now(), now())`,
    [adminEmail, adminNombre, hash, 'ADMIN'],
  );
}