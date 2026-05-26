-- ============================================================================
-- CleSystem - Migracion: categorias dinamicas + codigo de fabricante
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase.
--
-- Cambios:
--   1. Crea la tabla `categoria` con las tres categorias actuales como datos
--      iniciales (cristal, cerrajeria, insumo).
--   2. Elimina el CHECK constraint que limitaba producto.categoria a esos
--      tres valores: ahora puede ser cualquier nombre de la tabla categoria.
--   3. Agrega la columna `codigo_fabricante` a producto (nullable).
-- ============================================================================

-- 1. Tabla categoria
CREATE TABLE IF NOT EXISTS categoria (
    id_categoria SERIAL PRIMARY KEY,
    nombre       VARCHAR(50)  NOT NULL UNIQUE,
    activo       BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en    TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Datos iniciales (ON CONFLICT por si la corren varias veces)
INSERT INTO categoria (nombre) VALUES
    ('cristal'),
    ('cerrajeria'),
    ('insumo')
ON CONFLICT (nombre) DO NOTHING;


-- 2. Eliminar la restriccion CHECK que ataba producto.categoria a esos 3 valores
ALTER TABLE producto DROP CONSTRAINT IF EXISTS producto_categoria_check;


-- 3. Codigo de fabricante en producto
ALTER TABLE producto ADD COLUMN IF NOT EXISTS codigo_fabricante VARCHAR(100);

-- Indice opcional para acelerar la busqueda por codigo
CREATE INDEX IF NOT EXISTS idx_producto_codigo_fabricante
    ON producto(codigo_fabricante);

-- ============================================================================
-- FIN
-- ============================================================================
