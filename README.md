# Legatus – Control de Gastos

Aplicación web para la administración personal de finanzas. Permite registrar **ingresos** y **gastos** (con método de pago), asignar **presupuestos** por categoría, crear **categorías** personalizables y ver **reportes** con gráficos y exportación a PDF/CSV.

Se compone de un **backend** de API REST (Express + TypeScript + PostgreSQL) y un **frontend** (Angular 18). Incluye autenticación con JWT, inicio de sesión con Google y aviso de expiración de sesión con opción de extenderla.

## 1. Tecnologías usadas

- **Backend:** Node.js, Express 4, TypeScript, PostgreSQL (`pg`)
- **Frontend:** Angular 18 (standalone, signals), Chart.js (`ng2-charts`), iconos de Lucide
- **Autenticación:** JWT (`jsonwebtoken`) + Google OAuth (`google-auth-library`)
- **Gestión de paquetes:** [pnpm](https://pnpm.io) (trabajamos con `pnpm`, no `npm`)

## 2. Requisitos previos

Instala antes de empezar:

| Herramienta | Versión | Verifica con |
| --- | --- | --- |
| Node.js | 20 LTS o superior | `node -v` |
| pnpm | 9 o superior | `pnpm -v` |
| PostgreSQL | 14 o superior | `psql --version` |
| Git | cualquiera reciente | `git --version` |

También necesitas un servidor PostgreSQL **en funcionamiento** (o un contenedor local) con un usuario con permisos de creación de bases de datos.

## 3. Paso a paso de instalación

Ejecuta los comandos **en este orden**, uno por uno.

### 3.1 Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd <carpeta-del-proyecto>
```

> Reemplaza `<URL_DEL_REPOSITORIO>` con la URL real del repo y `<carpeta-del-proyecto>` con la carpeta donde quedó el proyecto.

### 3.2 Crear la base de datos

El backend **crea las tablas y el trigger de categorías automáticamente** al arrancar, pero la base de datos como tal debes crearla tú antes:

```bash
# Opción A: con createdb
createdb -U postgres control_gastos

# Opción B: con psql (escribe tu contraseña de postgres cuando la pida)
psql -U postgres -c "CREATE DATABASE control_gastos;"
```

> Si tu usuario de base de datos no es `postgres`, usa el que configures en `DATABASE_URL`.

### 3.3 Instalar dependencias y configurar el backend

```bash
cd backend
pnpm install

# Crea el archivo .env a partir del ejemplo
cp .env.example .env
```

Abre `backend/.env` y llena los valores (ver sección 4):

- **`DATABASE_URL`** — obligatoria, ya existente
- **`JWT_SECRET`** — obligatoria, genera una nueva
- **`ADMIN_PASSWORD`** — cámbiala si haces producción
- **`GOOGLE_CLIENT_ID`** — opcional (si dejas la de ejemplo, el botón de Google solo funciona en localhost)

### 3.4 Levantar el backend (primera terminal)

```bash
pnpm dev
```

En el primer arranque verás en la consola:

1. **"Verificando usuario admin..."** — crea las tablas y al usuario administrador si no existen
2. **"API escuchando en http://localhost:2500"** — backend listo

El backend queda disponible en `http://localhost:2500/api`. Déjalo corriendo mientras sigues con el frontend.

> ⚠️ El arranque fallará si `DATABASE_URL` o `JWT_SECRET` no están configuradas.

### 3.5 Instalar dependencias y configurar el frontend (segunda terminal)

```bash
cd frontend
pnpm install
```

Edita `frontend/src/environments/environment.ts` (la URL del API y el Client ID de Google):

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:2500/api',  // URL del backend (backend + '/api')
  googleClientId: 'TU_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
};
```

### 3.6 Levantar el frontend

```bash
pnpm start
```

Abre `http://localhost:4200` en el navegador e inicia sesión con el usuario administrador por defecto:

- **Correo:** `admin@controlgastos.com`
- **Contraseña:** `Admin123!`

> ⚠️ Para producción cambia `ADMIN_PASSWORD` en `backend/.env` o escribe la variable en el entorno del servidor; el valor `Admin123!` es un fallback de desarrollo.

## 4. Variables de entorno

### Backend (`backend/.env`)

| Variable | Obligatoria | Descripción | Ejemplo |
| --- | --- | --- | --- |
| `PORT` | No | Puerto del API | `2500` |
| `DATABASE_URL` | Sí | Cadena de conexión a PostgreSQL | `postgresql://postgres:TUPASSWORD@localhost:5432/control_gastos` |
| `JWT_SECRET` | Sí | Clave para firmar los tokens; el backend no arranca sin ella | `clave_secreta_larga_aleatoria` |
| `JWT_EXPIRES_IN` | No | Duración de la sesión | `3h` |
| `ADMIN_EMAIL` | No | Correo del admin que se crea al iniciar | `admin@controlgastos.com` |
| `ADMIN_PASSWORD` | No | Contraseña del admin (fallback `Admin123!`) | `TuClaveSegura123` |
| `ADMIN_NOMBRE` | No | Nombre mostrado del admin | `Administrador` |
| `GOOGLE_CLIENT_ID` | No | Client ID OAuth de Google (si falta, se usa el ID de desarrollo embebido) | `12345-xxxxxxxx.apps.googleusercontent.com` |

**Copia este bloque en `backend/.env` y reemplaza los valores entre `<...>`:**

```bash
# backend/.env
PORT=2500
DATABASE_URL="postgresql://postgres:TU_CONTRASENA_DE_POSTGRES@localhost:5432/control_gastos"
JWT_SECRET=<genera_una_clave_larga_y_aleatoria>
JWT_EXPIRES_IN=3h
ADMIN_EMAIL=admin@controlgastos.com
ADMIN_PASSWORD=<tu_contrasena_de_admin>
ADMIN_NOMBRE=Administrador
GOOGLE_CLIENT_ID=879432250502-la0hitfpf8obq59vu6p5f22dsom9hlka.apps.googleusercontent.com
```

> `JWT_SECRET` y `DATABASE_URL` son obligatorias; sin ellas el backend no arranca. El `GOOGLE_CLIENT_ID` que viene en el bloque es el de desarrollo (sirve solo en `localhost`).

### Frontend (no usa variables del sistema)

El frontend se configura editando `frontend/src/environments/environment.ts`:

| Campo | Descripción | Ejemplo |
| --- | --- | --- |
| `apiUrl` | URL del backend + `/api` | `http://localhost:2500/api` |
| `googleClientId` | Client ID OAuth de Google (debe coincidir con el del backend) | `12345-xxxxxxxx.apps.googleusercontent.com` |

## 5. Creación de la base de datos y datos iniciales

- **Crear la base:** `createdb -U postgres control_gastos` (o el `CREATE DATABASE` de la sección 3.2).
- **Migraciones:** no se ejecutan a mano. Al arrancar, `init-database.ts` crea las tablas (`usuarios`, `categorias`, `gastos`, `ingresos`, `presupuestos`), la columna `google_id` de usuarios y los índices necesarios.
- **Datos iniciales:** también al arrancar se crea el **usuario administrador** (`admin@controlgastos.com` / `Admin123!`) y un trigger que inserta las **6 categorías por defecto** a cada usuario nuevo.
- No hay seed de datos de prueba; el sistema arranca limpio y el admin empieza sin movimientos.

## 6. Cómo correr el proyecto en desarrollo

```bash
# Backend (terminal 1)  → http://localhost:2500
cd backend
pnpm dev

# Frontend (terminal 2) → http://localhost:4200
cd frontend
pnpm start
```

Comandos útiles de producción:

```bash
# Backend: compilar y ejecutar desde dist/
cd backend
pnpm build
pnpm start

# Frontend: generar el build estático (carpeta frontend/dist/frontend)
cd frontend
pnpm build
```

## 7. Estructura de ramas y flujo de trabajo

El proyecto se desarrolla con **Git Flow simplificado**:

- `main` — rama principal; solo recibe el estado inicial del proyecto.
- `develop` — rama de integración; aquí se fusionan las entregas mediante pull requests.
- `ssantos-2025020` — rama de trabajo donde se hacen los commits de cada entrega.

Ciclo por entrega: **commit → push → pull request** (de `ssantos-2025020` hacia `develop`) **→ merge**.

## 8. Estado actual del proyecto

Funcionales:

- **Login / Autenticación** — JWT + Google OAuth (botón oficial de Google)
- **Dashboard** — evolución de gastos, gastos por categoría, presupuestos y movimientos recientes
- **Ingresos** — registro, edición, eliminación y paginación
- **Gastos** — registro, edición, eliminación y método de pago (Efectivo/Tarjeta/Transferencia)
- **Presupuestos** — asignación y control por categoría con estado (Bien/Precaución/Alerta)
- **Categorías** — gestión con color personalizado, validaciones y categorías por defecto al crear usuario
- **Reportes** — análisis con gráficos, comparativas por período y exportación a PDF/CSV
- **Usuarios** — administración de usuarios y roles (solo ADMIN; un usuario normal recibe 403)
- **Configuración** — perfil, moneda y preferencias regionales (la foto de perfil es por sesión y no se persiste)

Pendiente / a tener en cuenta:

- **Lint, formateo y pruebas automatizadas** no están configurados (deuda técnica).
- **Producción** — el campo `googleClientId` actual funciona solo para localhost; al desplegar hay que crear su propio OAuth Client ID y registrar los orígenes `http://localhost:4200` y el dominio real en Google Cloud Console (ver `GOOGLE_OAUTH_SETUP.md`).
- Forzar el cambio de la contraseña por defecto `Admin123!` en entornos reales.