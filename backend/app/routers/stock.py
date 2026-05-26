"""
CleSystem - Router de Stock
Endpoints del modulo de control de stock.
Alcance (Project Charter): altas, bajas, stock disponible.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List

from ..database import get_supabase
from ..models import ProductoCrear, ProductoActualizar, ProductoRespuesta

router = APIRouter(prefix="/api/stock", tags=["Stock"])


def _calcular_estado(cantidad: int, minimo: int) -> str:
    """Regla de negocio del estado de stock (igual que en las maquetas)."""
    if cantidad <= 0:
        return "sin_stock"
    if cantidad <= minimo:
        return "stock_bajo"
    return "en_stock"


def _armar_respuesta(producto: dict, stock: dict) -> dict:
    """Combina datos de producto + stock en la forma que espera el front."""
    cantidad = stock.get("cantidad_actual", 0) if stock else 0
    minimo = stock.get("stock_minimo", 0) if stock else 0
    return {
        "id_producto": producto["id_producto"],
        "nombre_producto": producto["nombre_producto"],
        "descripcion": producto.get("descripcion"),
        "categoria": producto["categoria"],
        "modelo_auto": producto.get("modelo_auto"),
        "precio_costo": float(producto.get("precio_costo", 0)),
        "precio_venta": float(producto.get("precio_venta", 0)),
        "activo": producto.get("activo", True),
        "cantidad_actual": cantidad,
        "stock_minimo": minimo,
        "ubicacion_estanteria": stock.get("ubicacion_estanteria") if stock else None,
        "estado": _calcular_estado(cantidad, minimo),
    }


@router.get("/resumen")
def resumen_stock():
    """
    Tarjetas del encabezado: total productos, en stock, stock bajo, sin stock.
    """
    sb = get_supabase()
    productos = sb.table("producto").select("id_producto").eq("activo", True).execute()
    stocks = sb.table("stock").select("cantidad_actual, stock_minimo").execute()

    total = len(productos.data)
    en_stock = stock_bajo = sin_stock = 0
    for s in stocks.data:
        estado = _calcular_estado(s["cantidad_actual"], s["stock_minimo"])
        if estado == "en_stock":
            en_stock += 1
        elif estado == "stock_bajo":
            stock_bajo += 1
        else:
            sin_stock += 1

    return {
        "total_productos": total,
        "en_stock": en_stock,
        "stock_bajo": stock_bajo,
        "sin_stock": sin_stock,
    }


@router.get("", response_model=List[ProductoRespuesta])
def listar_productos(
    buscar: Optional[str] = Query(None, description="Nombre o categoria"),
    categoria: Optional[str] = Query(None),
    estado: Optional[str] = Query(None, description="en_stock|stock_bajo|sin_stock"),
):
    """Lista de productos con su stock, con filtros opcionales."""
    sb = get_supabase()
    query = sb.table("producto").select("*").eq("activo", True)
    if categoria:
        query = query.eq("categoria", categoria)
    if buscar:
        query = query.ilike("nombre_producto", f"%{buscar}%")
    productos = query.order("nombre_producto").execute()

    resultado = []
    for p in productos.data:
        stock_res = (
            sb.table("stock")
            .select("*")
            .eq("id_producto", p["id_producto"])
            .limit(1)
            .execute()
        )
        stock = stock_res.data[0] if stock_res.data else None
        item = _armar_respuesta(p, stock)
        if estado and item["estado"] != estado:
            continue
        resultado.append(item)
    return resultado


@router.post("", response_model=ProductoRespuesta, status_code=201)
def crear_producto(datos: ProductoCrear):
    """Alta de producto + su registro de stock inicial."""
    sb = get_supabase()
    prod_payload = {
        "nombre_producto": datos.nombre_producto,
        "descripcion": datos.descripcion,
        "categoria": datos.categoria,
        "modelo_auto": datos.modelo_auto,
        "precio_costo": datos.precio_costo,
        "precio_venta": datos.precio_venta,
        "activo": datos.activo,
    }
    prod = sb.table("producto").insert(prod_payload).execute()
    if not prod.data:
        raise HTTPException(500, "No se pudo crear el producto")
    nuevo = prod.data[0]

    stock_payload = {
        "id_producto": nuevo["id_producto"],
        "cantidad_actual": datos.cantidad_actual,
        "stock_minimo": datos.stock_minimo,
        "ubicacion_estanteria": datos.ubicacion_estanteria,
    }
    stock = sb.table("stock").insert(stock_payload).execute()
    return _armar_respuesta(nuevo, stock.data[0] if stock.data else None)


@router.put("/{id_producto}", response_model=ProductoRespuesta)
def actualizar_producto(id_producto: int, datos: ProductoActualizar):
    """Edicion de producto y/o de su stock (altas y bajas de cantidad)."""
    sb = get_supabase()

    existe = (
        sb.table("producto").select("*").eq("id_producto", id_producto).execute()
    )
    if not existe.data:
        raise HTTPException(404, "Producto no encontrado")

    campos_prod = {
        k: v
        for k, v in datos.model_dump(exclude_unset=True).items()
        if k in {
            "nombre_producto", "descripcion", "categoria", "modelo_auto",
            "precio_costo", "precio_venta", "activo",
        }
    }
    if campos_prod:
        sb.table("producto").update(campos_prod).eq(
            "id_producto", id_producto
        ).execute()

    campos_stock = {
        k: v
        for k, v in datos.model_dump(exclude_unset=True).items()
        if k in {"cantidad_actual", "stock_minimo", "ubicacion_estanteria"}
    }
    if campos_stock:
        sb.table("stock").update(campos_stock).eq(
            "id_producto", id_producto
        ).execute()

    prod = (
        sb.table("producto").select("*").eq("id_producto", id_producto).execute()
    )
    stock_res = (
        sb.table("stock")
        .select("*")
        .eq("id_producto", id_producto)
        .limit(1)
        .execute()
    )
    return _armar_respuesta(
        prod.data[0], stock_res.data[0] if stock_res.data else None
    )


@router.delete("/{id_producto}")
def baja_producto(id_producto: int):
    """
    Baja logica: marca el producto como inactivo (no se borra de la base
    para mantener trazabilidad, segun objetivo del Charter).
    """
    sb = get_supabase()
    existe = (
        sb.table("producto").select("id_producto").eq(
            "id_producto", id_producto
        ).execute()
    )
    if not existe.data:
        raise HTTPException(404, "Producto no encontrado")

    sb.table("producto").update({"activo": False}).eq(
        "id_producto", id_producto
    ).execute()
    return {"mensaje": "Producto dado de baja correctamente"}
