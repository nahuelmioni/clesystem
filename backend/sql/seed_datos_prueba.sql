-- ============================================================================
-- CleSystem - Datos de prueba (seed)
--
-- Ejecutar en el SQL Editor de Supabase para tener clientes y trabajos
-- ficticios con los que probar la UI. Se puede correr mas de una vez:
-- los INSERTs son aditivos (siempre crea filas nuevas).
--
-- NOTA: los trabajos de prueba se insertan "historicos" (fechas pasadas),
-- con sus detalle_trabajo e ingreso, pero NO descuentan stock (representan
-- trabajos ya cerrados antes de que existiera el sistema). El stock actual
-- queda como esta para no romper futuras pruebas con el flujo real.
--
-- Requiere haber ejecutado:
--   1. clesystem_schema.sql
--   2. trabajos_rpc.sql
--   3. migracion_estado_pago.sql  (para que ingreso.estado_pago exista)
-- ============================================================================


-- ============================================================================
-- 1. CLIENTES de prueba
-- ============================================================================
INSERT INTO cliente (nombre, apellido, telefono, email, direccion, es_asegurado, compania_seguro, nro_siniestro) VALUES
    ('Carlos',  'Rodriguez', '1166778899', 'crodriguez@mail.com', 'Av. San Martin 1234, San Vicente', FALSE, NULL, NULL),
    ('Laura',   'Fernandez', '1177889900', 'lfernandez@mail.com', 'Belgrano 567',                     TRUE,  'La Caja Seguros',  'SIN-00789'),
    ('Roberto', 'Lopez',     '1188990011', 'rlopez@mail.com',     'Mitre 890',                        FALSE, NULL, NULL),
    ('Sofia',   'Martinez',  '1199001122', 'smartinez@mail.com',  'Rivadavia 234',                    TRUE,  'Sancor Seguros',   'SIN-00990'),
    ('Diego',   'Gonzalez',  '1144556677', 'dgonzalez@mail.com',  'San Lorenzo 456',                  FALSE, NULL, NULL),
    ('Patricia','Sanchez',   '1133445566', 'psanchez@mail.com',   'Moreno 789',                       TRUE,  'Federacion Patronal','SIN-01122'),
    ('Martin',  'Romero',    '1122334455', 'mromero@mail.com',    'Sarmiento 321',                    FALSE, NULL, NULL),
    ('Lucia',   'Diaz',      '1155667788', 'ldiaz@mail.com',      'Alvear 654',                       FALSE, NULL, NULL);


-- ============================================================================
-- 2. TRABAJOS de prueba (con detalle + ingreso, sin tocar stock)
-- ============================================================================
-- Resuelvo los ids dinamicos (cliente, producto) con sub-selects para no
-- depender de valores hardcodeados. Asumo que existen los productos que
-- vinieron en el schema base (Parabrisas Gol Trend, Kangoo, Kit cerradura,
-- Sellador poliuretano).

DO $$
DECLARE
    v_id_cliente   INTEGER;
    v_id_trabajo   INTEGER;
    v_id_prod1     INTEGER;
    v_id_prod2     INTEGER;
    v_id_prod3     INTEGER;
BEGIN
    -- Capturar ids de productos del schema base
    SELECT id_producto INTO v_id_prod1 FROM producto WHERE nombre_producto = 'Parabrisas Gol Trend' LIMIT 1;
    SELECT id_producto INTO v_id_prod2 FROM producto WHERE nombre_producto = 'Parabrisas Kangoo' LIMIT 1;
    SELECT id_producto INTO v_id_prod3 FROM producto WHERE nombre_producto = 'Kit cerradura puerta' LIMIT 1;

    -- ---- Trabajo 1: Carlos Rodriguez, parabrisas, pagado completo, entregado ----
    SELECT id_cliente INTO v_id_cliente FROM cliente WHERE nombre='Carlos' AND apellido='Rodriguez' ORDER BY id_cliente DESC LIMIT 1;
    INSERT INTO trabajo (id_cliente, fecha_trabajo, patente_vehiculo, modelo_vehiculo, descripcion_servicio, tipo_servicio, estado, mano_obra, costo_total)
    VALUES (v_id_cliente, CURRENT_DATE - INTERVAL '15 days', 'AB123CD', 'Volkswagen Gol Trend', 'Cambio de parabrisas completo', 'servicio', 'entregado', 15000, 100000)
    RETURNING id_trabajo INTO v_id_trabajo;
    INSERT INTO detalle_trabajo (id_trabajo, id_producto, cantidad_usada, precio_unitario)
        VALUES (v_id_trabajo, v_id_prod1, 1, 85000);
    INSERT INTO ingreso (id_trabajo, monto_recibido, metodo_pago, estado_pago, fecha_ingreso)
        VALUES (v_id_trabajo, 100000, 'efectivo', 'pagado', NOW() - INTERVAL '15 days');

    -- ---- Trabajo 2: Laura Fernandez, asegurada, seña, en proceso ----
    SELECT id_cliente INTO v_id_cliente FROM cliente WHERE nombre='Laura' AND apellido='Fernandez' ORDER BY id_cliente DESC LIMIT 1;
    INSERT INTO trabajo (id_cliente, fecha_trabajo, patente_vehiculo, modelo_vehiculo, descripcion_servicio, tipo_servicio, estado, mano_obra, costo_total)
    VALUES (v_id_cliente, CURRENT_DATE - INTERVAL '5 days', 'CD456EF', 'Renault Kangoo', 'Reposicion parabrisas (seguro)', 'servicio', 'en_proceso', 20000, 115000)
    RETURNING id_trabajo INTO v_id_trabajo;
    INSERT INTO detalle_trabajo (id_trabajo, id_producto, cantidad_usada, precio_unitario)
        VALUES (v_id_trabajo, v_id_prod2, 1, 95000);
    INSERT INTO ingreso (id_trabajo, monto_recibido, metodo_pago, estado_pago, fecha_ingreso)
        VALUES (v_id_trabajo, 40000, 'transferencia', 'sena', NOW() - INTERVAL '5 days');

    -- ---- Trabajo 3: Roberto Lopez, cerradura, no pago aun, pendiente ----
    SELECT id_cliente INTO v_id_cliente FROM cliente WHERE nombre='Roberto' AND apellido='Lopez' ORDER BY id_cliente DESC LIMIT 1;
    INSERT INTO trabajo (id_cliente, fecha_trabajo, patente_vehiculo, modelo_vehiculo, descripcion_servicio, tipo_servicio, estado, mano_obra, costo_total)
    VALUES (v_id_cliente, CURRENT_DATE - INTERVAL '2 days', 'GH789IJ', 'Ford Fiesta', 'Cambio de cerradura puerta delantera', 'servicio', 'pendiente', 8000, 26000)
    RETURNING id_trabajo INTO v_id_trabajo;
    INSERT INTO detalle_trabajo (id_trabajo, id_producto, cantidad_usada, precio_unitario)
        VALUES (v_id_trabajo, v_id_prod3, 1, 18000);
    INSERT INTO ingreso (id_trabajo, monto_recibido, metodo_pago, estado_pago, fecha_ingreso)
        VALUES (v_id_trabajo, 0, 'efectivo', 'no_pagado', NOW() - INTERVAL '2 days');

    -- ---- Trabajo 4: Sofia Martinez, asegurada, pagado por seguro, entregado ----
    SELECT id_cliente INTO v_id_cliente FROM cliente WHERE nombre='Sofia' AND apellido='Martinez' ORDER BY id_cliente DESC LIMIT 1;
    INSERT INTO trabajo (id_cliente, fecha_trabajo, patente_vehiculo, modelo_vehiculo, descripcion_servicio, tipo_servicio, estado, mano_obra, costo_total)
    VALUES (v_id_cliente, CURRENT_DATE - INTERVAL '20 days', 'KL012MN', 'Volkswagen Gol Trend', 'Parabrisas + sellador (seguro)', 'servicio', 'entregado', 18000, 103000)
    RETURNING id_trabajo INTO v_id_trabajo;
    INSERT INTO detalle_trabajo (id_trabajo, id_producto, cantidad_usada, precio_unitario)
        VALUES (v_id_trabajo, v_id_prod1, 1, 85000);
    INSERT INTO ingreso (id_trabajo, monto_recibido, metodo_pago, estado_pago, fecha_ingreso)
        VALUES (v_id_trabajo, 103000, 'seguro', 'pagado', NOW() - INTERVAL '20 days');

    -- ---- Trabajo 5: Diego Gonzalez, venta directa, pagado completo ----
    SELECT id_cliente INTO v_id_cliente FROM cliente WHERE nombre='Diego' AND apellido='Gonzalez' ORDER BY id_cliente DESC LIMIT 1;
    INSERT INTO trabajo (id_cliente, fecha_trabajo, patente_vehiculo, modelo_vehiculo, descripcion_servicio, tipo_servicio, estado, mano_obra, costo_total)
    VALUES (v_id_cliente, CURRENT_DATE - INTERVAL '1 days', 'OP345QR', 'Peugeot 208', 'Venta parabrisas (cliente lo coloca)', 'venta', 'entregado', 0, 95000)
    RETURNING id_trabajo INTO v_id_trabajo;
    INSERT INTO detalle_trabajo (id_trabajo, id_producto, cantidad_usada, precio_unitario)
        VALUES (v_id_trabajo, v_id_prod2, 1, 95000);
    INSERT INTO ingreso (id_trabajo, monto_recibido, metodo_pago, estado_pago, fecha_ingreso)
        VALUES (v_id_trabajo, 95000, 'tarjeta', 'pagado', NOW() - INTERVAL '1 days');

    -- ---- Trabajo 6: Patricia Sanchez, finalizado pero no retiro ni pago ----
    SELECT id_cliente INTO v_id_cliente FROM cliente WHERE nombre='Patricia' AND apellido='Sanchez' ORDER BY id_cliente DESC LIMIT 1;
    INSERT INTO trabajo (id_cliente, fecha_trabajo, patente_vehiculo, modelo_vehiculo, descripcion_servicio, tipo_servicio, estado, mano_obra, costo_total)
    VALUES (v_id_cliente, CURRENT_DATE - INTERVAL '3 days', 'ST678UV', 'Chevrolet Onix', 'Cambio parabrisas trasero', 'servicio', 'finalizado', 12000, 107000)
    RETURNING id_trabajo INTO v_id_trabajo;
    INSERT INTO detalle_trabajo (id_trabajo, id_producto, cantidad_usada, precio_unitario)
        VALUES (v_id_trabajo, v_id_prod1, 1, 85000);
    INSERT INTO ingreso (id_trabajo, monto_recibido, metodo_pago, estado_pago, fecha_ingreso)
        VALUES (v_id_trabajo, 0, 'efectivo', 'no_pagado', NOW() - INTERVAL '3 days');

    -- ---- Trabajo 7: Martin Romero, cerradura, seña, pendiente ----
    SELECT id_cliente INTO v_id_cliente FROM cliente WHERE nombre='Martin' AND apellido='Romero' ORDER BY id_cliente DESC LIMIT 1;
    INSERT INTO trabajo (id_cliente, fecha_trabajo, patente_vehiculo, modelo_vehiculo, descripcion_servicio, tipo_servicio, estado, mano_obra, costo_total)
    VALUES (v_id_cliente, CURRENT_DATE, 'WX901YZ', 'Toyota Corolla', 'Cambio juego de cerraduras', 'servicio', 'pendiente', 12000, 48000)
    RETURNING id_trabajo INTO v_id_trabajo;
    INSERT INTO detalle_trabajo (id_trabajo, id_producto, cantidad_usada, precio_unitario)
        VALUES (v_id_trabajo, v_id_prod3, 2, 18000);
    INSERT INTO ingreso (id_trabajo, monto_recibido, metodo_pago, estado_pago, fecha_ingreso)
        VALUES (v_id_trabajo, 20000, 'efectivo', 'sena', NOW());

    -- ---- Trabajo 8: Lucia Diaz, hoy mismo, pagado completo ----
    SELECT id_cliente INTO v_id_cliente FROM cliente WHERE nombre='Lucia' AND apellido='Diaz' ORDER BY id_cliente DESC LIMIT 1;
    INSERT INTO trabajo (id_cliente, fecha_trabajo, patente_vehiculo, modelo_vehiculo, descripcion_servicio, tipo_servicio, estado, mano_obra, costo_total)
    VALUES (v_id_cliente, CURRENT_DATE, 'AA111BB', 'Fiat Cronos', 'Cambio parabrisas', 'servicio', 'entregado', 15000, 100000)
    RETURNING id_trabajo INTO v_id_trabajo;
    INSERT INTO detalle_trabajo (id_trabajo, id_producto, cantidad_usada, precio_unitario)
        VALUES (v_id_trabajo, v_id_prod1, 1, 85000);
    INSERT INTO ingreso (id_trabajo, monto_recibido, metodo_pago, estado_pago, fecha_ingreso)
        VALUES (v_id_trabajo, 100000, 'transferencia', 'pagado', NOW());

END $$;

-- ============================================================================
-- FIN
-- ============================================================================
