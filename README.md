# Legatus – Control de Gastos

Aplicación web para la administración personal de finanzas: registro y seguimiento de **ingresos**, control de **gastos** (incluye método de pago), **presupuestos** por categoría y **categorías** personalizables.

Cuenta con un **backend** de API REST (Express + TypeScript + PostgreSQL) y un **frontend** (Angular 18, standalone con signals) con diseño responsivo, autenticación con JWT, datos de prueba de los últimos 4 meses y carrusel de sesión.

## Credenciales

- **Correo:** `admin@controlgastos.com`
- **Contraseña:** `Admin123!`

## Tecnologías

| Capa | Tecnologías |
| --- | --- |
| Backend | Node.js, Express, TypeScript, PostgreSQL (`pg`), bcrypt, jsonwebtoken |
| Frontend | Angular 18 (standalone, signals), Chart.js (`ng2-charts`), iconos de Lucide |
| Monorepo | `frontend/` y `backend/` en la raíz |

## Estructura

```
backend/   Express + TypeScript + PostgreSQL (puerto 2500)
frontend/  Angular 18 (puerto 8080)
```

## Instalación

Requisitos: Node.js 20+ y PostgreSQL.

```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

## Ejecución

```bash
# Backend (puerto 2500)
cd backend
npm run dev

# Frontend (puerto 8080)
cd frontend
npm start
```

## Configuración (backend/.env)

El backend requiere las siguientes variables en `backend/.env`:

```
PORT=2500
DATABASE_URL="postgresql://postgres:admin@localhost:5432/control_gastos_finalb4"
JWT_SECRET="..."
JWT_EXPIRES_IN="3h"
ADMIN_EMAIL="admin@controlgastos.com"
ADMIN_PASSWORD="Admin123!"
ADMIN_NOMBRE="Administrador"
```

Al iniciar, el backend crea las tablas, inserta las categorías por defecto, siembra datos de prueba de los últimos 4 meses y verifica las credenciales del administrador. La sesión expira según `JWT_EXPIRES_IN`; el frontend avisa antes de que caduque y permite extenderla.

## Estado actual de los módulos

Funcionales:

- **Login / Autenticación** (JWT)
- **Dashboard** — evolución de gastos, gastos por categoría, presupuestos y movimientos recientes
- **Ingresos** — registro, edición, eliminación y paginación
- **Gastos** — registro, edición, eliminación y método de pago (Efectivo/Tarjeta/Transferencia)
- **Presupuestos** — asignación y control por categoría con estado (Bien/Precaución/Alerta)
- **Categorías** — gestión con color personalizado y validación de colores únicos
- **Configuración** — perfil y moneda

Pendientes:

- Reportes
- Usuarios (administración)
- API de Google
- Roles

## Flujo de trabajo en Git

El proyecto se desarrolla con **Git Flow simplificado**:

- `main` — rama principal, solo recibe el estado inicial del proyecto.
- `develop` — rama de integración; aquí se fusionan las entregas mediante *pull requests*.
- `ssantos-2025020` — rama de trabajo donde se realizan los commits de las entregas.

Para cada entrega se sigue el ciclo: **commit → push → pull request** (de `ssantos-2025020` hacia `develop`) **→ merge**, de modo que cada commit queda reflejado en `develop` con su propio pull request.