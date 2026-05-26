-- ============================================================================
-- CleSystem - Funciones RPC para el modulo de Trabajos
--
-- Ejecutar este script UNA VEZ en el SQL Editor de Supabase, despues de
-- haber corrido clesystem_schema.sql. Crea dos funciones PL/pgSQL que el
-- backend FastAPI invoca via supabase.rpc(...):
--
--   1. crear_trabajo_completo(payload jsonb)  -> JSONB  (id_trabajo creado)
--   2. cancelar_trabajo(p_id_trabajo int)     -> VOID   (revierte stock)
--
-- Motivo de hacer esto en la base y no en Python:
--   El alta de un trabajo toca 5 tablas (trabajo, detalle_trabajo,
--   movimiento_stock, stock, ingreso) y debe validar stock disponible.
--   PostgreSQL garantiza atomicidad: o se crea todo o no se crea nada.
--   El cliente supabase-py no expone transacciones nativas, asi que el
--   rollback manual desde Python seria fragil.
-- ============================================================================


-- ============================================================================
-- 1. crear_trabajo_completo
-- ============================================================================
-- Recibe un JSON con la forma:
-- {
--   "id_cliente": 1,
--   "fecha_trabajo": "2026-05-26",          (opcional, default CURRENT_DATE)
--   "patente_vehiculo": "AB123CD",
--   "modelo_vehiculo": "Peugeot 208",
--   "descripcion_servicio": "Cambio parabrisas",
--   "tipo_servicio": "servicio",            ('venta' | 'servicio')
--   "estado": "finalizado",                 (opcional, default 'pendiente')
--   "mano_obra": 15000,
--   "metodo_pago": "efectivo",
--   "monto_recibido": 95000,                (lo que efectivamente cobra)
--   "productos": [
--      { "id_producto": 1, "cantidad": 1, "precio_unitario": 85000 }
--   ]
-- }
-- Devuelve: { "id_trabajo": 42 }
-- ============================================================================
CREATE OR REPLACE FUNCTION crear_trabajo_completo(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_id_trabajo      INTEGER;
    v_id_usuario      INTEGER;
    v_costo_productos NUMERIC(12,2) := 0;
    v_costo_total     NUMERIC(12,2);
    v_mano_obra       NUMERIC(12,2);
    v_monto_recibido  NUMERIC(12,2);
    v_estado_pago     VARCHAR(20);
    v_producto        JSONB;
    v_id_producto     INTEGER;
    v_cantidad        INTEGER;
    v_precio_unit     NUMERIC(12,2);
    v_stock_actual    INTEGER;
    v_nombre_prod     VARCHAR;
BEGIN
    -- Usuario por defecto: primer "dueno" activo (sistema mono-usuario)
    SELECT id_usuario INTO v_id_usuario
    FROM usuario
    WHERE rol = 'dueno' AND activo = TRUE
    ORDER BY id_usuario
    LIMIT 1;

    v_mano_obra      := COALESCE((payload->>'mano_obra')::NUMERIC, 0);
    v_monto_recibido := COALESCE((payload->>'monto_recibido')::NUMERIC, 0);

    -- Validar stock disponible para CADA producto antes de tocar nada
    FOR v_producto IN SELECT * FROM jsonb_array_elements(payload->'productos')
    LOOP
        v_id_producto := (v_producto->>'id_producto')::INTEGER;
        v_cantidad    := (v_producto->>'cantidad')::INTEGER;

        IF v_cantidad <= 0 THEN
            RAISE EXCEPTION 'La cantidad debe ser mayor a cero';
        END IF;

        SELECT s.cantidad_actual, p.nombre_producto
          INTO v_stock_actual, v_nombre_prod
        FROM stock s
        JOIN producto p ON p.id_producto = s.id_producto
        WHERE s.id_producto = v_id_producto
        LIMIT 1;

        IF v_stock_actual IS NULL THEN
            RAISE EXCEPTION 'No se encontro stock del producto %', v_id_producto;
        END IF;

        IF v_stock_actual < v_cantidad THEN
            RAISE EXCEPTION 'Stock insuficiente para "%": hay % y se piden %',
                v_nombre_prod, v_stock_actual, v_cantidad;
        END IF;
    END LOOP;

    -- Calcular costo total (subtotales + mano de obra)
    FOR v_producto IN SELECT * FROM jsonb_array_elements(payload->'productos')
    LOOP
        v_costo_productos := v_costo_productos +
            ((v_producto->>'cantidad')::INTEGER *
             (v_producto->>'precio_unitario')::NUMERIC);
    END LOOP;
    v_costo_total := v_costo_productos + v_mano_obra;

    -- Resolver estado_pago: si vino explicito lo usamos; si no, lo inferimos.
    v_estado_pago := payload->>'estado_pago';
    IF v_estado_pago IS NULL THEN
        IF v_monto_recibido <= 0 THEN
            v_estado_pago := 'no_pagado';
        ELSIF v_monto_recibido < v_costo_total THEN
            v_estado_pago := 'sena';
        ELSE
            v_estado_pago := 'pagado';
        END IF;
    END IF;

    -- 1. Insertar el trabajo
    INSERT INTO trabajo (
        id_cliente, id_usuario, fecha_trabajo, patente_vehiculo,
        modelo_vehiculo, descripcion_servicio, tipo_servicio,
        estado, mano_obra, costo_total
    )
    VALUES (
        (payload->>'id_cliente')::INTEGER,
        v_id_usuario,
        COALESCE((payload->>'fecha_trabajo')::DATE, CURRENT_DATE),
        payload->>'patente_vehiculo',
        payload->>'modelo_vehiculo',
        payload->>'descripcion_servicio',
        COALESCE(payload->>'tipo_servicio', 'servicio'),
        COALESCE(payload->>'estado', 'pendiente'),
        v_mano_obra,
        v_costo_total
    )
    RETURNING id_trabajo INTO v_id_trabajo;

    -- 2. Por cada producto: detalle + movimiento_stock + descontar stock
    FOR v_producto IN SELECT * FROM jsonb_array_elements(payload->'productos')
    LOOP
        v_id_producto := (v_producto->>'id_producto')::INTEGER;
        v_cantidad    := (v_producto->>'cantidad')::INTEGER;
        v_precio_unit := (v_producto->>'precio_unitario')::NUMERIC;

        INSERT INTO detalle_trabajo (id_trabajo, id_producto, cantidad_usada, precio_unitario)
        VALUES (v_id_trabajo, v_id_producto, v_cantidad, v_precio_unit);

        INSERT INTO movimiento_stock (
            id_producto, id_usuario, tipo_movimiento, cantidad, motivo
        )
        VALUES (
            v_id_producto, v_id_usuario, 'salida', v_cantidad,
            'uso en trabajo #' || v_id_trabajo
        );

        UPDATE stock
        SET cantidad_actual = cantidad_actual - v_cantidad
        WHERE id_producto = v_id_producto;
    END LOOP;

    -- 3. Insertar el ingreso (un solo pago por trabajo).
    --    Siempre se crea, incluso si no pago: monto=0, estado='no_pagado'.
    INSERT INTO ingreso (id_trabajo, monto_recibido, metodo_pago, estado_pago)
    VALUES (
        v_id_trabajo,
        v_monto_recibido,
        COALESCE(payload->>'metodo_pago', 'efectivo'),
        v_estado_pago
    );

    RETURN jsonb_build_object('id_trabajo', v_id_trabajo);
END;
$$;


-- ============================================================================
-- 2. cancelar_trabajo
-- ============================================================================
-- Marca el trabajo como 'cancelado' y devuelve los productos al stock,
-- dejando un movimiento_stock de tipo 'entrada' por cada uno con motivo
-- "cancelacion trabajo #X". El ingreso asociado se elimina (cascade).
-- ============================================================================
CREATE OR REPLACE FUNCTION cancelar_trabajo(p_id_trabajo INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_id_usuario INTEGER;
    v_estado     VARCHAR;
    r            RECORD;
BEGIN
    SELECT estado INTO v_estado FROM trabajo WHERE id_trabajo = p_id_trabajo;
    IF v_estado IS NULL THEN
        RAISE EXCEPTION 'Trabajo % no existe', p_id_trabajo;
    END IF;
    IF v_estado = 'cancelado' THEN
        RAISE EXCEPTION 'El trabajo ya estaba cancelado';
    END IF;

    SELECT id_usuario INTO v_id_usuario
    FROM usuario WHERE rol = 'dueno' AND activo = TRUE
    ORDER BY id_usuario LIMIT 1;

    -- Devolver al stock cada producto usado
    FOR r IN
        SELECT id_producto, cantidad_usada
        FROM detalle_trabajo
        WHERE id_trabajo = p_id_trabajo
    LOOP
        UPDATE stock
        SET cantidad_actual = cantidad_actual + r.cantidad_usada
        WHERE id_producto = r.id_producto;

        INSERT INTO movimiento_stock (
            id_producto, id_usuario, tipo_movimiento, cantidad, motivo
        )
        VALUES (
            r.id_producto, v_id_usuario, 'entrada', r.cantidad_usada,
            'cancelacion trabajo #' || p_id_trabajo
        );
    END LOOP;

    -- Borrar el ingreso (no hubo cobro real si se cancela)
    DELETE FROM ingreso WHERE id_trabajo = p_id_trabajo;

    -- Marcar el trabajo
    UPDATE trabajo SET estado = 'cancelado' WHERE id_trabajo = p_id_trabajo;
END;
$$;

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
