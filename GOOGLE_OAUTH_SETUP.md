# Configuración de Inicio de Sesión con Google

## Pasos para configurar Google OAuth

### 1. Crear proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la API de Google Sign-In:
   - Ve a "APIs & Services" > "Library"
   - Busca "Google Sign-In API"
   - Haz clic en "Enable"

### 2. Configurar OAuth 2.0

1. Ve a "APIs & Services" > "Credentials"
2. Haz clic en "Create Credentials" > "OAuth client ID"
3. Configura el consent screen:
   - Selecciona "External" (o "Internal" si es para una organización)
   - Completa la información básica de la aplicación
   - Agrega los scopes necesarios (email, profile)
4. Crea el OAuth client ID:
   - **Application type**: Web application
   - **Name**: Control de Gastos (o el nombre que prefieras)
   - **Authorized JavaScript origins**: 
     - `http://localhost:4200` (desarrollo)
     - `https://tu-dominio.com` (producción)
   - **Authorized redirect URIs**: 
     - `http://localhost:4200` (desarrollo)
     - `https://tu-dominio.com` (producción)

### 3. Configurar el backend

1. Instala la dependencia de Google Auth Library:
   ```bash
   cd backend
   pnpm add google-auth-library
   ```

2. Ejecuta la migración de base de datos:
   ```bash
   # Ejecuta el SQL en tu base de datos PostgreSQL
   # Archivo: backend/migrations/add_google_id_to_users.sql
   ```

3. Configura las variables de entorno:
   ```bash
   # Copia el archivo de ejemplo
   cp backend/.env.example backend/.env
   
   # Edita backend/.env y agrega:
   GOOGLE_CLIENT_ID=tu_google_client_id_obtenido
   ```

### 4. Configurar el frontend

1. Edita `frontend/src/environments/environment.ts`:
   ```typescript
   export const environment = {
     production: false,
     apiUrl: 'http://localhost:2500/api',
     googleClientId: 'tu_google_client_id_obtenido',
   };
   ```

2. Para producción, crea `environment.prod.ts`:
   ```typescript
   export const environment = {
     production: true,
     apiUrl: 'https://tu-api.com/api',
     googleClientId: 'tu_google_client_id_obtenido',
   };
   ```

### 5. Reiniciar servidores

```bash
# Backend
cd backend
pnpm run dev

# Frontend (en otra terminal)
cd frontend
pnpm start
```

## Flujo de autenticación

1. El usuario hace clic en "Iniciar sesión con Google"
2. Google muestra el popup de autenticación
3. Google devuelve un `idToken` al frontend
4. El frontend envía el `idToken` al backend via `POST /api/auth/google`
5. El backend verifica el token con Google Auth Library
6. Si el usuario no existe, se crea automáticamente
7. El backend genera un JWT token y lo devuelve al frontend
8. El frontend guarda el token y redirige al dashboard

## Notas importantes

- El token de Google se valida en el backend, no en el frontend
- Los usuarios nuevos se crean automáticamente con rol `USER`
- Si el usuario ya existe pero no tiene `google_id`, se actualiza
- La sesión funciona igual que el login tradicional con JWT

## Solución de problemas

### Error: "La variable de entorno GOOGLE_CLIENT_ID es obligatoria"
- Asegúrate de configurar `GOOGLE_CLIENT_ID` en `backend/.env`
- Reinicia el servidor backend

### Error: "Token inválido o expirado"
- Verifica que el `GOOGLE_CLIENT_ID` sea correcto
- Asegúrate de que los orígenes autorizados en Google Console coincidan

### El botón de Google no aparece
- Verifica que el SDK de Google se cargó correctamente
- Revisa la consola del navegador para errores
- Asegúrate de que `googleClientId` esté configurado en environment.ts