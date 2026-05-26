-- ============================================================================
-- CleSystem - Migracion: login simple
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase.
-- Agrega columnas username y password_hash a la tabla usuario y crea
-- (o actualiza) un usuario admin / admin123.
--
-- Notas:
--   - Sistema mono-usuario, login ficticio (proyecto academico).
--   - El hash es SHA-256 plano del password. Sirve para no guardar la
--     contrasena en texto pero NO es apto para produccion real
--     (faltaria salt + bcrypt/argon2).
-- ============================================================================

ALTER TABLE usuario ADD COLUMN IF NOT EXISTS username       VARCHAR(50) UNIQUE;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS password_hash  VARCHAR(64);

-- Crear o actualizar el usuario admin (admin / admin123)
INSERT INTO usuario (nombre, email, username, password_hash, rol, activo)
VALUES (
    'Administrador',
    'admin@lacle.com',
    'admin',
    encode(sha256('admin123'::bytea), 'hex'),
    'dueno',
    TRUE
)
ON CONFLICT (email) DO UPDATE SET
    username      = EXCLUDED.username,
    password_hash = EXCLUDED.password_hash,
    rol           = 'dueno',
    activo        = TRUE;

-- ============================================================================
-- FIN
-- ============================================================================
