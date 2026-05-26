-- ============================================================================
-- CleSystem - Sistema de Gestion Parabrisas La Cle
-- Script de creacion de base de datos
-- Motor: PostgreSQL 14+ (compatible con Supabase)
-- ============================================================================
-- Decisiones de diseno:
--  - Un solo pago por trabajo  -> TRABAJO 1:1 INGRESO
--  - Mano de obra separada     -> campo mano_obra en TRABAJO
--  - Trazabilidad de stock     -> tabla MOVIMIENTO_STOCK
--  - Catalogo y existencias separados -> PRODUCTO vs STOCK
--  - Ganancia NO se guarda, se calcula (vista v_rentabilidad_trabajo)
-- ============================================================================

-- Limpieza opcional (descomentar solo para reconstruir desde cero)
-- DROP VIEW  IF EXISTS v_rentabilidad_trabajo      CASCADE;
-- DROP VIEW  IF EXISTS v_ingresos_diarios          CASCADE;
-- DROP VIEW  IF EXISTS v_stock_bajo                 CASCADE;
-- DROP TABLE IF EXISTS detalle_pedido               CASCADE;
-- DROP TABLE IF EXISTS pedido_compra                CASCADE;
-- DROP TABLE IF EXISTS proveedor                    CASCADE;
-- DROP TABLE IF EXISTS ingreso                      CASCADE;
-- DROP TABLE IF EXISTS movimiento_stock             CASCADE;
-- DROP TABLE IF EXISTS detalle_trabajo              CASCADE;
-- DROP TABLE IF EXISTS stock                        CASCADE;
-- DROP TABLE IF EXISTS trabajo                      CASCADE;
-- DROP TABLE IF EXISTS producto                     CASCADE;
-- DROP TABLE IF EXISTS cliente                      CASCADE;
-- DROP TABLE IF EXISTS usuario                      CASCADE;

-- ============================================================================
-- 1. USUARIO  (quien opera el sistema: dueno, tecnico, etc.)
-- ============================================================================
CREATE TABLE usuario (
    id_usuario   SERIAL PRIMARY KEY,
    nombre       VARCHAR(120)  NOT NULL,
    email        VARCHAR(150)  UNIQUE NOT NULL,
    rol          VARCHAR(30)   NOT NULL DEFAULT 'operador'
                 CHECK (rol IN ('dueno', 'administrativo', 'tecnico', 'operador')),
    activo       BOOLEAN       NOT NULL DEFAULT TRUE,
    creado_en    TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. CLIENTE  (particular o asegurado)
-- ============================================================================
CREATE TABLE cliente (
    id_cliente        SERIAL PRIMARY KEY,
    nombre            VARCHAR(100) NOT NULL,
    apellido          VARCHAR(100),
    telefono          VARCHAR(30),
    email             VARCHAR(150),
    direccion         VARCHAR(200),
    compania_seguro   VARCHAR(120),     -- NULL si es particular
    nro_siniestro     VARCHAR(60),      -- NULL si es particular
    es_asegurado      BOOLEAN      NOT NULL DEFAULT FALSE,
    creado_en         TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. PRODUCTO  (catalogo: cristales, insumos, cerrajeria)
-- ============================================================================
CREATE TABLE producto (
    id_producto       SERIAL PRIMARY KEY,
    nombre_producto   VARCHAR(150) NOT NULL,
    descripcion       TEXT,
    categoria         VARCHAR(50)  NOT NULL
                      CHECK (categoria IN ('cristal', 'cerrajeria', 'insumo')),
    modelo_auto       VARCHAR(120),     -- ej: Gol Trend, Kangoo. NULL si no aplica
    precio_costo      DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (precio_costo >= 0),
    precio_venta      DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (precio_venta >= 0),
    activo            BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en         TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. STOCK  (existencias fisicas por ubicacion)
-- ============================================================================
CREATE TABLE stock (
    id_stock              SERIAL PRIMARY KEY,
    id_producto           INTEGER NOT NULL REFERENCES producto(id_producto)
                          ON UPDATE CASCADE ON DELETE RESTRICT,
    cantidad_actual       INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_actual >= 0),
    stock_minimo          INTEGER NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
    ubicacion_estanteria  VARCHAR(60),
    UNIQUE (id_producto, ubicacion_estanteria)
);

-- ============================================================================
-- 5. TRABAJO  (servicio realizado a un cliente)
-- ============================================================================
CREATE TABLE trabajo (
    id_trabajo            SERIAL PRIMARY KEY,
    id_cliente            INTEGER NOT NULL REFERENCES cliente(id_cliente)
                          ON UPDATE CASCADE ON DELETE RESTRICT,
    id_usuario            INTEGER REFERENCES usuario(id_usuario)
                          ON UPDATE CASCADE ON DELETE SET NULL,
    fecha_trabajo         DATE        NOT NULL DEFAULT CURRENT_DATE,
    patente_vehiculo      VARCHAR(20),
    modelo_vehiculo       VARCHAR(120),
    descripcion_servicio  TEXT,
    tipo_servicio         VARCHAR(20) NOT NULL DEFAULT 'servicio'
                          CHECK (tipo_servicio IN ('venta', 'servicio')),
    estado                VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                          CHECK (estado IN ('pendiente', 'en_proceso',
                                            'finalizado', 'entregado', 'cancelado')),
    mano_obra             DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (mano_obra >= 0),
    costo_total           DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (costo_total >= 0),
    creado_en             TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. DETALLE_TRABAJO  (productos usados en cada trabajo)
-- ============================================================================
CREATE TABLE detalle_trabajo (
    id_detalle        SERIAL PRIMARY KEY,
    id_trabajo        INTEGER NOT NULL REFERENCES trabajo(id_trabajo)
                      ON UPDATE CASCADE ON DELETE CASCADE,
    id_producto       INTEGER NOT NULL REFERENCES producto(id_producto)
                      ON UPDATE CASCADE ON DELETE RESTRICT,
    cantidad_usada    INTEGER NOT NULL CHECK (cantidad_usada > 0),
    precio_unitario   DECIMAL(12,2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal          DECIMAL(12,2) GENERATED ALWAYS AS
                          (cantidad_usada * precio_unitario) STORED
);

-- ============================================================================
-- 7. INGRESO  (cobro del trabajo - un solo pago por trabajo)
-- ============================================================================
CREATE TABLE ingreso (
    id_ingreso        SERIAL PRIMARY KEY,
    id_trabajo        INTEGER NOT NULL UNIQUE REFERENCES trabajo(id_trabajo)
                      ON UPDATE CASCADE ON DELETE CASCADE,
    monto_recibido    DECIMAL(12,2) NOT NULL CHECK (monto_recibido >= 0),
    metodo_pago       VARCHAR(30)  NOT NULL DEFAULT 'efectivo'
                      CHECK (metodo_pago IN ('efectivo', 'transferencia',
                                             'cheque', 'tarjeta', 'seguro')),
    fecha_ingreso     TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 8. MOVIMIENTO_STOCK  (trazabilidad: cada entrada/salida)
-- ============================================================================
CREATE TABLE movimiento_stock (
    id_movimiento     SERIAL PRIMARY KEY,
    id_producto       INTEGER NOT NULL REFERENCES producto(id_producto)
                      ON UPDATE CASCADE ON DELETE RESTRICT,
    id_usuario        INTEGER REFERENCES usuario(id_usuario)
                      ON UPDATE CASCADE ON DELETE SET NULL,
    tipo_movimiento   VARCHAR(20) NOT NULL
                      CHECK (tipo_movimiento IN ('entrada', 'salida', 'ajuste')),
    cantidad          INTEGER NOT NULL CHECK (cantidad <> 0),
    motivo            VARCHAR(150),     -- ej: "compra proveedor", "uso en trabajo #12"
    fecha_movimiento  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 9. PROVEEDOR  (de cristales o cerrajeria)
-- ============================================================================
CREATE TABLE proveedor (
    id_proveedor      SERIAL PRIMARY KEY,
    nombre_proveedor  VARCHAR(150) NOT NULL,
    canal_contacto    VARCHAR(60),      -- ej: Web, WhatsApp
    telefono          VARCHAR(30),
    tipo_insumo       VARCHAR(60),      -- ej: cristales, cerrajeria
    creado_en         TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 10. PEDIDO_COMPRA  (gestion basica de pedidos a proveedores)
-- ============================================================================
CREATE TABLE pedido_compra (
    id_pedido         SERIAL PRIMARY KEY,
    id_proveedor      INTEGER NOT NULL REFERENCES proveedor(id_proveedor)
                      ON UPDATE CASCADE ON DELETE RESTRICT,
    fecha_pedido      DATE         NOT NULL DEFAULT CURRENT_DATE,
    monto_total       DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (monto_total >= 0),
    metodo_pago       VARCHAR(30)  DEFAULT 'efectivo'
                      CHECK (metodo_pago IN ('efectivo', 'transferencia', 'cheque')),
    nro_cheque        VARCHAR(60),      -- solo si metodo_pago = cheque
    estado_pago       VARCHAR(20)  NOT NULL DEFAULT 'pendiente'
                      CHECK (estado_pago IN ('pendiente', 'pagado', 'parcial')),
    creado_en         TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 11. DETALLE_PEDIDO  (productos de cada pedido de compra)
-- ============================================================================
CREATE TABLE detalle_pedido (
    id_detalle_pedido SERIAL PRIMARY KEY,
    id_pedido         INTEGER NOT NULL REFERENCES pedido_compra(id_pedido)
                      ON UPDATE CASCADE ON DELETE CASCADE,
    id_producto       INTEGER NOT NULL REFERENCES producto(id_producto)
                      ON UPDATE CASCADE ON DELETE RESTRICT,
    cantidad          INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario   DECIMAL(12,2) NOT NULL CHECK (precio_unitario >= 0)
);

-- ============================================================================
-- INDICES  (para acelerar consultas frecuentes)
-- ============================================================================
CREATE INDEX idx_trabajo_cliente       ON trabajo(id_cliente);
CREATE INDEX idx_trabajo_fecha         ON trabajo(fecha_trabajo);
CREATE INDEX idx_trabajo_estado        ON trabajo(estado);
CREATE INDEX idx_detalle_trabajo_trab  ON detalle_trabajo(id_trabajo);
CREATE INDEX idx_detalle_trabajo_prod  ON detalle_trabajo(id_producto);
CREATE INDEX idx_ingreso_fecha         ON ingreso(fecha_ingreso);
CREATE INDEX idx_mov_stock_producto    ON movimiento_stock(id_producto);
CREATE INDEX idx_mov_stock_fecha       ON movimiento_stock(fecha_movimiento);
CREATE INDEX idx_stock_producto        ON stock(id_producto);
CREATE INDEX idx_pedido_proveedor      ON pedido_compra(id_proveedor);

-- ============================================================================
-- VISTAS  (calculos automaticos: NO se guardan, se calculan al consultar)
-- ============================================================================

-- Rentabilidad por trabajo: lo cobrado menos costo de productos y mano de obra
CREATE VIEW v_rentabilidad_trabajo AS
SELECT
    t.id_trabajo,
    t.fecha_trabajo,
    c.nombre || ' ' || COALESCE(c.apellido, '')          AS cliente,
    t.tipo_servicio,
    t.estado,
    COALESCE(i.monto_recibido, 0)                         AS total_cobrado,
    t.mano_obra,
    COALESCE(SUM(dt.subtotal), 0)                         AS total_productos_venta,
    COALESCE(SUM(dt.cantidad_usada * p.precio_costo), 0)  AS costo_productos,
    COALESCE(i.monto_recibido, 0)
        - COALESCE(SUM(dt.cantidad_usada * p.precio_costo), 0)
        - t.mano_obra                                     AS ganancia_neta
FROM trabajo t
JOIN cliente c              ON c.id_cliente = t.id_cliente
LEFT JOIN ingreso i         ON i.id_trabajo = t.id_trabajo
LEFT JOIN detalle_trabajo dt ON dt.id_trabajo = t.id_trabajo
LEFT JOIN producto p        ON p.id_producto = dt.id_producto
GROUP BY t.id_trabajo, t.fecha_trabajo, c.nombre, c.apellido,
         t.tipo_servicio, t.estado, i.monto_recibido, t.mano_obra;

-- Ingresos agrupados por dia (base para reportes diarios/semanales/mensuales)
CREATE VIEW v_ingresos_diarios AS
SELECT
    DATE(i.fecha_ingreso)        AS dia,
    COUNT(*)                     AS cantidad_trabajos,
    SUM(i.monto_recibido)        AS total_ingresos
FROM ingreso i
GROUP BY DATE(i.fecha_ingreso)
ORDER BY dia DESC;

-- Productos con stock por debajo del minimo (alerta de reposicion)
CREATE VIEW v_stock_bajo AS
SELECT
    p.id_producto,
    p.nombre_producto,
    p.categoria,
    p.modelo_auto,
    s.cantidad_actual,
    s.stock_minimo,
    s.ubicacion_estanteria
FROM stock s
JOIN producto p ON p.id_producto = s.id_producto
WHERE s.cantidad_actual <= s.stock_minimo
  AND p.activo = TRUE
ORDER BY s.cantidad_actual ASC;

-- ============================================================================
-- DATOS DE EJEMPLO (opcional - para probar el sistema)
-- ============================================================================
INSERT INTO usuario (nombre, email, rol) VALUES
    ('Dueno La Cle', 'dueno@lacle.com', 'dueno'),
    ('Tecnico Instalador', 'tecnico@lacle.com', 'tecnico');

INSERT INTO cliente (nombre, apellido, telefono, es_asegurado, compania_seguro, nro_siniestro) VALUES
    ('Juan', 'Perez', '1145678901', FALSE, NULL, NULL),
    ('Maria', 'Gomez', '1156789012', TRUE, 'Seguro XYZ', 'SIN-00123');

INSERT INTO producto (nombre_producto, categoria, modelo_auto, precio_costo, precio_venta) VALUES
    ('Parabrisas Gol Trend', 'cristal', 'Gol Trend', 45000.00, 85000.00),
    ('Parabrisas Kangoo', 'cristal', 'Kangoo', 52000.00, 95000.00),
    ('Kit cerradura puerta', 'cerrajeria', NULL, 8000.00, 18000.00),
    ('Sellador poliuretano', 'insumo', NULL, 3000.00, 6000.00);

INSERT INTO stock (id_producto, cantidad_actual, stock_minimo, ubicacion_estanteria) VALUES
    (1, 5, 2, 'Fila A - Sector 1'),
    (2, 1, 2, 'Fila A - Sector 2'),
    (3, 10, 3, 'Fila B - Sector 1'),
    (4, 20, 5, 'Fila C - Sector 1');

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
