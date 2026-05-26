"""
CleSystem - Router de Trabajos
Endpoints del modulo de Registro de Trabajos.

El alta de un trabajo es transaccional (toca 5 tablas y valida stock).
Por eso se delega a la funcion PL/pgSQL crear_trabajo_completo en la BD
(ver backend/sql/trabajos_rpc.sql). El backend solo arma el payload,
llama al RPC y traduce errores.
"""
from fastapi import APIRouter, HTTPException, Query
from datetime import date, datetime, timedelta
from typing import Optional, List

from ..database import get_supabase
from ..models import (
    TrabajoCrear,
    TrabajoActualizar,
    TrabajoRespuesta,
    DetalleTrabajoRespuesta,
    ResumenTrabajos,
    PagoActualizar,
)

router = APIRouter(prefix="/api/trabajos", tags=["Trabajos"])


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def _armar_trabajo(sb, t: dict, incluir_detalle: bool = False) -> dict:
    """Toma un row de 'trabajo' y le agrega datos del cliente, ingreso y
    (opcionalmente) los productos usados."""
    cliente_nombre = None
    if t.get("id_cliente"):
        cli = (
            sb.table("cliente")
            .select("nombre, apellido")
            .eq("id_cliente", t["id_cliente"])
            .limit(1)
            .execute()
        )
        if cli.data:
            c = cli.data[0]
            cliente_nombre = f"{c['nombre']} {c.get('apellido') or ''}".strip()

    ing = (
        sb.table("ingreso")
        .select("monto_recibido, metodo_pago, estado_pago")
        .eq("id_trabajo", t["id_trabajo"])
        .limit(1)
        .execute()
    )
    monto = float(ing.data[0]["monto_recibido"]) if ing.data else None
    metodo = ing.data[0]["metodo_pago"] if ing.data else None
    estado_pago = ing.data[0].get("estado_pago") if ing.data else None

    fecha = t["fecha_trabajo"]
    if isinstance(fecha, str):
        fecha = date.fromisoformat(fecha)

    out = {
        "id_trabajo": t["id_trabajo"],
        "id_cliente": t["id_cliente"],
        "cliente": cliente_nombre,
        "fecha_trabajo": fecha,
        "patente_vehiculo": t.get("patente_vehiculo"),
        "modelo_vehiculo": t.get("modelo_vehiculo"),
        "descripcion_servicio": t.get("descripcion_servicio"),
        "tipo_servicio": t["tipo_servicio"],
        "estado": t["estado"],
        "mano_obra": float(t.get("mano_obra", 0)),
        "costo_total": float(t.get("costo_total", 0)),
        "monto_recibido": monto,
        "metodo_pago": metodo,
        "estado_pago": estado_pago,
    }

    if incluir_detalle:
        det = (
            sb.table("detalle_trabajo")
            .select("*")
            .eq("id_trabajo", t["id_trabajo"])
            .execute()
        )
        detalles = []
        for d in det.data:
            prod = (
                sb.table("producto")
                .select("nombre_producto")
                .eq("id_producto", d["id_producto"])
                .limit(1)
                .execute()
            )
            detalles.append({
                "id_detalle": d["id_detalle"],
                "id_producto": d["id_producto"],
                "nombre_producto": prod.data[0]["nombre_producto"] if prod.data else None,
                "cantidad_usada": d["cantidad_usada"],
                "precio_unitario": float(d["precio_unitario"]),
                "subtotal": float(d["subtotal"]),
            })
        out["productos"] = detalles

    return out


# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------
@router.get("/resumen", response_model=ResumenTrabajos)
def resumen_trabajos():
    """Tarjetas: trabajos del dia, semana, mes y cuantos quedan pendientes."""
    sb = get_supabase()
    hoy = date.today()
    inicio_semana = hoy - timedelta(days=hoy.weekday())
    inicio_mes = hoy.replace(day=1)

    res = sb.table("trabajo").select("fecha_trabajo, estado").execute()
    total_dia = total_semana = total_mes = pendientes = 0
    for t in res.data:
        f = t["fecha_trabajo"]
        if isinstance(f, str):
            f = date.fromisoformat(f)
        if t["estado"] != "cancelado":
            if f == hoy:
                total_dia += 1
            if f >= inicio_semana:
                total_semana += 1
            if f >= inicio_mes:
                total_mes += 1
        if t["estado"] in ("pendiente", "en_proceso"):
            pendientes += 1

    return ResumenTrabajos(
        total_dia=total_dia,
        total_semana=total_semana,
        total_mes=total_mes,
        pendientes=pendientes,
    )


@router.get("", response_model=List[TrabajoRespuesta])
def listar_trabajos(
    desde: Optional[date] = Query(None),
    hasta: Optional[date] = Query(None),
    id_cliente: Optional[int] = Query(None),
    estado: Optional[str] = Query(None),
):
    """Historico de trabajos con filtros opcionales."""
    sb = get_supabase()
    query = sb.table("trabajo").select("*")
    if desde:
        query = query.gte("fecha_trabajo", desde.isoformat())
    if hasta:
        query = query.lte("fecha_trabajo", hasta.isoformat())
    if id_cliente:
        query = query.eq("id_cliente", id_cliente)
    if estado:
        query = query.eq("estado", estado)
    res = query.order("fecha_trabajo", desc=True).order("id_trabajo", desc=True).execute()
    return [_armar_trabajo(sb, t) for t in res.data]


@router.get("/{id_trabajo}", response_model=TrabajoRespuesta)
def obtener_trabajo(id_trabajo: int):
    """Detalle de un trabajo con los productos usados."""
    sb = get_supabase()
    res = sb.table("trabajo").select("*").eq("id_trabajo", id_trabajo).limit(1).execute()
    if not res.data:
        raise HTTPException(404, "Trabajo no encontrado")
    return _armar_trabajo(sb, res.data[0], incluir_detalle=True)


@router.post("", response_model=TrabajoRespuesta, status_code=201)
def crear_trabajo(datos: TrabajoCrear):
    """
    Alta de un trabajo (transaccional: usa el RPC crear_trabajo_completo
    en PostgreSQL para que sea todo o nada).
    """
    sb = get_supabase()

    # Verificar que el cliente exista
    cli = (
        sb.table("cliente").select("id_cliente").eq(
            "id_cliente", datos.id_cliente
        ).limit(1).execute()
    )
    if not cli.data:
        raise HTTPException(404, "El cliente indicado no existe")

    payload = {
        "id_cliente": datos.id_cliente,
        "fecha_trabajo": datos.fecha_trabajo.isoformat() if datos.fecha_trabajo else None,
        "patente_vehiculo": datos.patente_vehiculo,
        "modelo_vehiculo": datos.modelo_vehiculo,
        "descripcion_servicio": datos.descripcion_servicio,
        "tipo_servicio": datos.tipo_servicio,
        "estado": datos.estado,
        "mano_obra": datos.mano_obra,
        "monto_recibido": datos.monto_recibido,
        "metodo_pago": datos.metodo_pago,
        "estado_pago": datos.estado_pago,
        "productos": [p.model_dump() for p in datos.productos],
    }

    try:
        rpc = sb.rpc("crear_trabajo_completo", {"payload": payload}).execute()
    except Exception as e:
        # Postgres devuelve los RAISE EXCEPTION del RPC como error de cliente
        raise HTTPException(400, str(e))

    if not rpc.data or "id_trabajo" not in rpc.data:
        raise HTTPException(500, "El RPC no devolvio el id del trabajo")
    nuevo_id = rpc.data["id_trabajo"]

    res = sb.table("trabajo").select("*").eq("id_trabajo", nuevo_id).limit(1).execute()
    return _armar_trabajo(sb, res.data[0], incluir_detalle=True)


@router.put("/{id_trabajo}", response_model=TrabajoRespuesta)
def actualizar_estado(id_trabajo: int, datos: TrabajoActualizar):
    """Cambio de estado del trabajo (workflow pendiente -> entregado, etc).
    Para cancelar y revertir stock usar el endpoint DELETE."""
    sb = get_supabase()
    existe = (
        sb.table("trabajo").select("id_trabajo").eq("id_trabajo", id_trabajo).execute()
    )
    if not existe.data:
        raise HTTPException(404, "Trabajo no encontrado")

    if datos.estado == "cancelado":
        raise HTTPException(
            400,
            "Para cancelar un trabajo y revertir el stock usar DELETE /api/trabajos/{id}",
        )

    sb.table("trabajo").update({"estado": datos.estado}).eq(
        "id_trabajo", id_trabajo
    ).execute()
    res = sb.table("trabajo").select("*").eq("id_trabajo", id_trabajo).limit(1).execute()
    return _armar_trabajo(sb, res.data[0], incluir_detalle=True)


@router.put("/{id_trabajo}/pago", response_model=TrabajoRespuesta)
def actualizar_pago(id_trabajo: int, datos: PagoActualizar):
    """
    Actualiza el estado de pago de un trabajo (no_pagado / sena / pagado)
    y el monto recibido. Util cuando un cliente paga el resto despues de
    haber dejado una sena, o cuando se carga un trabajo "a cobrar".
    """
    sb = get_supabase()
    existe = (
        sb.table("trabajo").select("id_trabajo").eq("id_trabajo", id_trabajo).execute()
    )
    if not existe.data:
        raise HTTPException(404, "Trabajo no encontrado")

    update = {
        "estado_pago": datos.estado_pago,
        "monto_recibido": datos.monto_recibido,
    }
    if datos.metodo_pago:
        update["metodo_pago"] = datos.metodo_pago

    res = (
        sb.table("ingreso").update(update).eq("id_trabajo", id_trabajo).execute()
    )
    if not res.data:
        raise HTTPException(404, "No se encontro el ingreso asociado al trabajo")

    trab = sb.table("trabajo").select("*").eq("id_trabajo", id_trabajo).limit(1).execute()
    return _armar_trabajo(sb, trab.data[0], incluir_detalle=True)


@router.delete("/{id_trabajo}")
def cancelar_trabajo(id_trabajo: int):
    """
    Cancela el trabajo y devuelve los productos al stock (transaccional).
    Usa el RPC cancelar_trabajo. No borra el trabajo: queda con estado
    'cancelado' para mantener trazabilidad (objetivo del Charter).
    """
    sb = get_supabase()
    try:
        sb.rpc("cancelar_trabajo", {"p_id_trabajo": id_trabajo}).execute()
    except Exception as e:
        raise HTTPException(400, str(e))
    return {"mensaje": "Trabajo cancelado y stock revertido"}
