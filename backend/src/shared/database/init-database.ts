import bcrypt from 'bcrypt';
import { query } from './database.service';
import { CATEGORIAS_DEFAULT } from './categorias-default';

export const SALT_ROUNDS = 10;

export { CATEGORIAS_DEFAULT };
export type { TipoCategoria } from './categorias-default';

/**
 * Inicializa la base de datos (idempotente): crea todo el esquema
 * (tablas, enum, columnas nuevas, trigger anti-huérfanos), siembra el usuario
 * administrador y el catálogo mínimo de categorías por defecto cuando no existen.
 *
 * Las categorías pertenecen a un usuario ("usuarioId"): cada cuenta ve y
 * administra SOLO sus propios datos. No se siembran presupuestos: una cuenta
 * (incluida la de Administrador) inicia con Presupuestos/Gastos/Ingresos vacíos.
 */
export async function initDatabase(): Promise<void> {
  await crearTablas();
  await seedAdminUser();
  await seedCategorias();
}

async function crearTablas(): Promise<void> {
  // Enum de roles (idempotente).
  await query(
    `DO $$ BEGIN
       CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');
     EXCEPTION WHEN duplicate_object THEN NULL;
     END $$;`,
  );

  await query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id        text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      email     text NOT NULL UNIQUE,
      nombre    text NOT NULL,
      password  text NOT NULL,
      role      "Role" NOT NULL DEFAULT 'USER',
      usuario   text,
      color     text,
      activo    boolean DEFAULT true,
      "fechaRegistro" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      google_id VARCHAR(255),
      foto      text
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS categorias (
      id        text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "usuarioId" text NOT NULL,
      nombre    text NOT NULL,
      tipo      text NOT NULL DEFAULT 'AMBAS' CHECK (tipo IN ('INGRESO', 'GASTO', 'AMBAS')),
      color     text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "deletedAt" timestamptz,
      CONSTRAINT fk_categorias_usuario FOREIGN KEY ("usuarioId") REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS gastos (
      id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      descripcion text NOT NULL,
      monto       numeric NOT NULL,
      fecha       timestamptz NOT NULL,
      "usuarioId" text NOT NULL,
      "categoriaId" text NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "deletedAt" timestamptz,
      metodo      text,
      CONSTRAINT fk_gastos_usuario FOREIGN KEY ("usuarioId") REFERENCES usuarios(id) ON DELETE CASCADE,
      CONSTRAINT fk_gastos_categoria FOREIGN KEY ("categoriaId") REFERENCES categorias(id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ingresos (
      id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      descripcion text NOT NULL,
      monto       numeric NOT NULL,
      fecha       timestamptz NOT NULL,
      "usuarioId" text NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "deletedAt" timestamptz,
      categoria   text,
      metodo      text,
      CONSTRAINT fk_ingresos_usuario FOREIGN KEY ("usuarioId") REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS presupuestos (
      id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "usuarioId" text NOT NULL,
      "categoriaId" text NOT NULL,
      mes         smallint NOT NULL,
      anio        smallint NOT NULL,
      monto       numeric(10,2) NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "deletedAt" timestamptz,
      CONSTRAINT fk_presupuestos_usuario FOREIGN KEY ("usuarioId") REFERENCES usuarios(id) ON DELETE CASCADE,
      CONSTRAINT fk_presupuestos_categoria FOREIGN KEY ("categoriaId") REFERENCES categorias(id)
    )
  `);

  // Compatibility con esquemas previos (sin reinicio): asignan las tablas
  // existentes a un único propietario (el administrador) y agregan el campo tipo.
  await asegurarColumnaCategorias();
  await asegurarColumnaPresupuestos();

  // Papelera: borrado lógico con "deletedAt" (null = vigente).
  await query(`ALTER TABLE categorias ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz`);
  await query(`ALTER TABLE gastos ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz`);
  await query(`ALTER TABLE ingresos ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz`);
  await query(`ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz`);

  // La unicidad de categorías/presupuestos aplica solo a los registros vigentes
  // (los movidos a la papelera no bloquean volver a crear el mismo nombre).
  await query(`DROP INDEX IF EXISTS uq_categorias_activas`);
  await query(`CREATE UNIQUE INDEX uq_categorias_activas ON categorias ("usuarioId", nombre) WHERE "deletedAt" IS NULL`);
  await query(`DROP INDEX IF EXISTS uq_presupuestos_activo`);
  await query(`CREATE UNIQUE INDEX uq_presupuestos_activo ON presupuestos ("usuarioId", "categoriaId", mes, anio) WHERE "deletedAt" IS NULL`);

  // El módulo de ingresos guarda categoría y método como texto libre
  // (las opciones provienen del catálogo unificado de categorías).
  await query(`ALTER TABLE ingresos ADD COLUMN IF NOT EXISTS categoria text`);
  await query(`ALTER TABLE ingresos ADD COLUMN IF NOT EXISTS metodo text`);

  // El módulo de gastos también necesita el campo método de pago.
  await query(`ALTER TABLE gastos ADD COLUMN IF NOT EXISTS metodo text`);

  // El módulo de autenticación con Google necesita google_id y foto.
  await query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS google_id VARCHAR(255)`);
  await query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto VARCHAR(500)`);
  // La foto puede ser una imagen (data URL base64) subida por el propio
  // usuario, por lo que la columna se amplía de VARCHAR(500) a TEXT.
  await query(`ALTER TABLE usuarios ALTER COLUMN foto TYPE text`);
  await query(`CREATE INDEX IF NOT EXISTS idx_usuarios_google_id ON usuarios(google_id)`);

  await crearTriggerAntiHuerfanos();
  await crearTriggerCategoriasPorDefecto();
}

/**
 * Red de seguridad a nivel de base de datos contra referencias rotas:
 * al ELIMINAR DEFINITIVAMENTE una categoría (desde la papelera), los gastos
 * que aún le apunten se reasignan a la categoría de respaldo "Otros" del mismo
 * usuario (creándola si no existe) y sus presupuestos se eliminan. Ninguna fila
 * puede quedar apuntando a un "categoriaId" inexistente.
 */
async function crearTriggerAntiHuerfanos(): Promise<void> {
  await query(`
    CREATE OR REPLACE FUNCTION fn_categoria_reasignar_otros()
    RETURNS trigger AS $$
    DECLARE
      otros_id text;
    BEGIN
      IF EXISTS (SELECT 1 FROM gastos WHERE "categoriaId" = OLD.id) THEN
        SELECT id INTO otros_id
        FROM categorias
        WHERE "usuarioId" = OLD."usuarioId" AND nombre = 'Otros' AND id <> OLD.id
        LIMIT 1;

        IF otros_id IS NULL THEN
          INSERT INTO categorias (id, "usuarioId", nombre, tipo, "createdAt", "updatedAt")
          VALUES (gen_random_uuid()::text, OLD."usuarioId", 'Otros', 'AMBAS', now(), now())
          RETURNING id INTO otros_id;
        END IF;

        UPDATE gastos SET "categoriaId" = otros_id WHERE "categoriaId" = OLD.id;
      END IF;

      DELETE FROM presupuestos WHERE "categoriaId" = OLD.id;

      RETURN OLD;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await query(`DROP TRIGGER IF EXISTS trg_categoria_anti_huerfanos ON categorias`);
  await query(`
    CREATE TRIGGER trg_categoria_anti_huerfanos
    BEFORE DELETE ON categorias
    FOR EACH ROW EXECUTE FUNCTION fn_categoria_reasignar_otros();
  `);
}

/**
 * Garantiza que TODA cuenta nueva reciba el catálogo mínimo de categorías
 * por defecto, sin importar cómo se cree (formulario de Usuarios, login con
 * Google, script, etc.). Centraliza la lógica en la base de datos para que no
 * dependa del código que esté en ejecución.
 */
async function crearTriggerCategoriasPorDefecto(): Promise<void> {
  await query(`
    CREATE OR REPLACE FUNCTION fn_seed_categorias_usuario()
    RETURNS trigger AS $$
    BEGIN
      INSERT INTO categorias (id, "usuarioId", nombre, tipo, "createdAt", "updatedAt")
      SELECT gen_random_uuid()::text, NEW.id, v.nombre, v.tipo, now(), now()
      FROM (VALUES
        ('Comida',     'GASTO'),
        ('Transporte', 'GASTO'),
        ('Vivienda',   'GASTO'),
        ('Servicios',  'GASTO'),
        ('Sueldo',     'INGRESO'),
        ('Otros',      'AMBAS')
      ) AS v(nombre, tipo)
      ON CONFLICT ("usuarioId", nombre) WHERE "deletedAt" IS NULL DO NOTHING;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await query(`DROP TRIGGER IF EXISTS trg_categorias_por_defecto ON usuarios`);
  await query(`
    CREATE TRIGGER trg_categorias_por_defecto
    AFTER INSERT ON usuarios
    FOR EACH ROW EXECUTE FUNCTION fn_seed_categorias_usuario();
  `);
}

async function asegurarColumnaCategorias(): Promise<void> {
  await query(`ALTER TABLE categorias ADD COLUMN IF NOT EXISTS "usuarioId" text`);
  await query(`ALTER TABLE categorias ADD COLUMN IF NOT EXISTS tipo text`);

  // Backfill del propietario (administrador) en esquemas legados.
  const admin = await query<{ id: string }>(`SELECT id FROM usuarios WHERE role = 'ADMIN' ORDER BY "createdAt" LIMIT 1`);
  if (admin[0]) {
    await query(`UPDATE categorias SET "usuarioId" = $1 WHERE "usuarioId" IS NULL`, [admin[0].id]);
    await query(`UPDATE categorias SET tipo = 'AMBAS' WHERE tipo IS NULL OR tipo NOT IN ('INGRESO','GASTO','AMBAS')`);
  }

  await query(`ALTER TABLE categorias ALTER COLUMN "usuarioId" SET NOT NULL`);
  await query(`ALTER TABLE categorias ALTER COLUMN tipo SET NOT NULL`);
  await query(`ALTER TABLE categorias ALTER COLUMN tipo SET DEFAULT 'AMBAS'`);
  await query(`ALTER TABLE categorias DROP CONSTRAINT IF EXISTS categorias_tipo_check`);
  await query(`ALTER TABLE categorias ADD CONSTRAINT categorias_tipo_check CHECK (tipo IN ('INGRESO', 'GASTO', 'AMBAS'))`);

  // El catálogo pasa a ser por usuario: se elimina la unicidad global por nombre
  // y la unicidad vigente queda en el índice parcial uq_categorias_activas
  // (los registros en la papelera no bloquean volver a crear el mismo nombre).
  await query(`ALTER TABLE categorias DROP CONSTRAINT IF EXISTS categorias_nombre_key`);
  await query(`ALTER TABLE categorias DROP CONSTRAINT IF EXISTS "categorias_usuarioId_nombre_key"`);
  await query(`ALTER TABLE categorias DROP CONSTRAINT IF EXISTS categorias_usuarioid_nombre_key`);
}

async function asegurarColumnaPresupuestos(): Promise<void> {
  await query(`ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS "usuarioId" text`);
  await query(`ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS mes smallint`);
  await query(`ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS anio smallint`);

  const admin = await query<{ id: string }>(`SELECT id FROM usuarios WHERE role = 'ADMIN' ORDER BY "createdAt" LIMIT 1`);
  if (admin[0]) {
    await query(`UPDATE presupuestos SET "usuarioId" = $1 WHERE "usuarioId" IS NULL`, [admin[0].id]);
  }

  // Presupuestos de esquemas previos (sin mes/anio): se asignan al mes en curso
  // para no perder el límite configurado.
  await query(`
    UPDATE presupuestos
    SET mes = EXTRACT(MONTH FROM now())::smallint,
        anio = EXTRACT(YEAR FROM now())::smallint
    WHERE mes IS NULL OR anio IS NULL
  `);

  await query(`ALTER TABLE presupuestos ALTER COLUMN "usuarioId" SET NOT NULL`);
  await query(`ALTER TABLE presupuestos ALTER COLUMN mes SET NOT NULL`);
  await query(`ALTER TABLE presupuestos ALTER COLUMN anio SET NOT NULL`);
  await query(`ALTER TABLE presupuestos DROP CONSTRAINT IF EXISTS "presupuestos_categoriaId_key"`);
  await query(`ALTER TABLE presupuestos DROP CONSTRAINT IF EXISTS "presupuestos_usuarioId_categoriaId_key"`);
  // El ADD previo creó la restricción con nombre en minúsculas (identificador sin comillas).
  await query(`ALTER TABLE presupuestos DROP CONSTRAINT IF EXISTS presupuestos_usuarioid_categoriamesanio_key`);
}

async function seedCategorias(): Promise<void> {
  const admin = await query<{ id: string }>(`SELECT id FROM usuarios WHERE role = 'ADMIN' ORDER BY "createdAt" LIMIT 1`);
  if (!admin[0]) return;

  for (const c of CATEGORIAS_DEFAULT) {
    await query(
      `INSERT INTO categorias (id, "usuarioId", nombre, tipo, "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, now(), now())
       ON CONFLICT ("usuarioId", nombre) WHERE "deletedAt" IS NULL DO NOTHING`,
      [admin[0].id, c.nombre, c.tipo],
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
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4::"Role", now(), now())
     ON CONFLICT (email) DO NOTHING`,
    [adminEmail, adminNombre, hash, 'ADMIN'],
  );
}