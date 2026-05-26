"""
CleSystem - Router de Ingresos
Endpoints del modulo de ingresos.
Alcance (Project Charter): visualizacion de ingresos diarios, semanales,
mensuales + consulta de informacion historica.
NO incluye: balance global contra gastos (gastos esta fuera de alcance).
"""
from fastapi import APIRouter, HTTPException, Query
from datetime import date, datetime, timedelta
from typing import Optional, List

from ..database import get_supabase
from ..models import IngresoRespuesta, ResumenIngresos, IngresoCrear

router = APIRouter(prefix="/api/ingresos", tags=["Ingresos"])


def _enriquecer(sb, ingreso: dict) -> dict:
    """Agrega datos del cliente y del servicio al ingreso."""
    cliente_nombre = None
    descripcion = None
    trabajo_res = (
        sb.table("trabajo")
        .select("id_cliente, descripcion_servicio")
        .eq("id_trabajo", ingreso["id_trabajo"])
        .limit(1)
        .execute()
    )
    if trabajo_res.data:
        t = trabajo_res.data[0]
        descripcion = t.get("descripcion_servicio")
        cli_res = (
            sb.table("cliente")
            .select("nombre, apellido")
            .eq("id_cliente", t["id_cliente"])
            .limit(1)
            .execute()
        )
        if cli_res.data:
            c = cli_res.data[0]
            cliente_nombre = f"{c['nombre']} {c.get('apellido', '') or ''}".strip()

    return {
        "id_ingreso": ingreso["id_ingreso"],
        "id_trabajo": ingreso["id_trabajo"],
        "monto_recibido": float(ingreso["monto_recibido"]),
        "metodo_pago": ingreso["metodo_pago"],
        "fecha_ingreso": ingreso["fecha_ingreso"],
        "cliente": cliente_nombre,
        "descripcion_servicio": descripcion,
    }


@router.get("/resumen", response_model=ResumenIngresos)
def resumen_ingresos():
    """
    Tarjetas del dashboard: total del dia, de la semana y del mes.
    """
    sb = get_supabase()
    hoy = date.today()
    inicio_semana = hoy - timedelta(days=hoy.weekday())
    inicio_mes = hoy.replace(day=1)

    ingresos = (
        sb.table("ingreso")
        .select("monto_recibido, fecha_ingreso, estado_pago")
        .neq("estado_pago", "no_pagado")
        .execute()
    )

    total_dia = total_semana = total_mes = 0.0
    cant_dia = cant_mes = 0

    for ing in ingresos.data:
        fecha_str = ing["fecha_ingreso"]
        f = datetime.fromisoformat(fecha_str.replace("Z", "+00:00")).date()
        monto = float(ing["monto_recibido"])

        if f == hoy:
            total_dia += monto
            cant_dia += 1
        if f >= inicio_semana:
            total_semana += monto
        if f >= inicio_mes:
            total_mes += monto
            cant_mes += 1

    return ResumenIngresos(
        total_dia=total_dia,
        total_semana=total_semana,
        total_mes=total_mes,
        cantidad_trabajos_dia=cant_dia,
        cantidad_trabajos_mes=cant_mes,
    )


@router.get("", response_model=List[IngresoRespuesta])
def listar_ingresos(
    desde: Optional[date] = Query(None),
    hasta: Optional[date] = Query(None),
    metodo_pago: Optional[str] = Query(None),
):
    """
    Historico de ingresos con filtros opcionales por rango de fechas.
    Cumple el objetivo de "consulta de informacion historica".
    """
    sb = get_supabase()
    query = sb.table("ingreso").select("*").neq("estado_pago", "no_pagado")
    if metodo_pago:
        query = query.eq("metodo_pago", metodo_pago)
    if desde:
        query = query.gte("fecha_ingreso", desde.isoformat())
    if hasta:
        query = query.lte("fecha_ingreso", f"{hasta.isoformat()}T23:59:59")

    ingresos = query.order("fecha_ingreso", desc=True).execute()
    return [_enriquecer(sb, i) for i in ingresos.data]


@router.get("/por-dia")
def ingresos_por_dia(dias: int = Query(7, ge=1, le=90)):
    """
    Ingresos agrupados por dia para los ultimos N dias (para grafico/reporte).
    """
    sb = get_supabase()
    desde = (date.today() - timedelta(days=dias - 1)).isoformat()
    ingresos = (
        sb.table("ingreso")
        .select("monto_recibido, fecha_ingreso, estado_pago")
        .neq("estado_pago", "no_pagado")
        .gte("fecha_ingreso", desde)
        .execute()
    )

    agrupado: dict = {}
    for ing in ingresos.data:
        f = datetime.fromisoformat(
            ing["fecha_ingreso"].replace("Z", "+00:00")
        ).date().isoformat()
        agrupado.setdefault(f, {"dia": f, "total": 0.0, "cantidad": 0})
        agrupado[f]["total"] += float(ing["monto_recibido"])
        agrupado[f]["cantidad"] += 1

    return sorted(agrupado.values(), key=lambda x: x["dia"], reverse=True)


@router.post("", response_model=IngresoRespuesta, status_code=201)
def registrar_ingreso(datos: IngresoCrear):
    """
    Registra el cobro de un trabajo (un solo pago por trabajo).
    Si el trabajo ya tiene un ingreso, lo rechaza.
    """
    sb = get_supabase()

    trabajo = (
        sb.table("trabajo")
        .select("id_trabajo")
        .eq("id_trabajo", datos.id_trabajo)
        .execute()
    )
    if not trabajo.data:
        raise HTTPException(404, "El trabajo indicado no existe")

    ya_existe = (
        sb.table("ingreso")
        .select("id_ingreso")
        .eq("id_trabajo", datos.id_trabajo)
        .execute()
    )
    if ya_existe.data:
        raise HTTPException(
            400, "Este trabajo ya tiene un ingreso registrado"
        )

    nuevo = (
        sb.table("ingreso")
        .insert(
            {
                "id_trabajo": datos.id_trabajo,
                "monto_recibido": datos.monto_recibido,
                "metodo_pago": datos.metodo_pago,
            }
        )
        .execute()
    )
    return _enriquecer(sb, nuevo.data[0])
