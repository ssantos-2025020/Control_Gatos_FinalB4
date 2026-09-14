-- Añadir columna google_id a la tabla usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);

-- Crear índice para búsquedas más rápidas por google_id
CREATE INDEX IF NOT EXISTS idx_usuarios_google_id ON usuarios(google_id);

-- Permitir que google_id sea único (opcional, pero recomendado)
-- ALTER TABLE usuarios ADD CONSTRAINT unique_google_id UNIQUE (google_id);