-- ============================================================================
-- CleSystem - Migracion: estado_pago en ingreso
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase, despues de tener corridos
-- clesystem_schema.sql y trabajos_rpc.sql.
--
-- Cambios:
--   1. Agrega columna estado_pago a la tabla ingreso.
--   2. Reemplaza la funcion crear_trabajo_completo para que reciba y guarde
--      el estado de pago (la version vieja queda sobrescrita).
-- ============================================================================

-- 1. Columna nueva en ingreso. Default 'pagado' para que las filas viejas
--    queden marcadas como pagadas (era la unica posibilidad antes).
ALTER TABLE ingreso
    ADD COLUMN IF NOT EXISTS estado_pago VARCHAR(20) NOT NULL DEFAULT 'pagado'
        CHECK (estado_pago IN ('no_pagado', 'sena', 'pagado'));


-- 2. RPC actualizado: ahora acepta "estado_pago" en el payload JSON.
--    Si no viene, se infiere: monto 0 -> no_pagado, monto < total -> sena,
--    monto >= total -> pagado.
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

    -- 1. Trabajo
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

    -- 2. Detalle + movimiento + descontar stock
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

    -- 3. Ingreso (siempre se crea, incluso si no pago: monto=0, estado='no_pagado')
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
-- FIN
-- ============================================================================
