"""
CleSystem - Router de Categorias
ABM de categorias de productos. La tabla `categoria` reemplaza al CHECK
constraint hardcodeado (cristal | cerrajeria | insumo).
"""
from fastapi import APIRouter, HTTPException
from typing import List

from ..database import get_supabase
from ..models import CategoriaCrear, CategoriaRespuesta

router = APIRouter(prefix="/api/categorias", tags=["Categorias"])


@router.get("", response_model=List[CategoriaRespuesta])
def listar_categorias():
    """Lista todas las categorias activas."""
    sb = get_supabase()
    res = (
        sb.table("categoria")
        .select("*")
        .eq("activo", True)
        .order("nombre")
        .execute()
    )
    return res.data


@router.post("", response_model=CategoriaRespuesta, status_code=201)
def crear_categoria(datos: CategoriaCrear):
    """Alta de categoria. El nombre se normaliza a minusculas."""
    sb = get_supabase()
    nombre = datos.nombre.strip().lower()
    if not nombre:
        raise HTTPException(400, "El nombre no puede estar vacio")

    # Si ya existe pero esta inactiva, la reactivamos en vez de crear duplicada.
    existente = (
        sb.table("categoria").select("*").eq("nombre", nombre).limit(1).execute()
    )
    if existente.data:
        cat = existente.data[0]
        if cat["activo"]:
            raise HTTPException(400, f'La categoria "{nombre}" ya existe')
        sb.table("categoria").update({"activo": True}).eq(
            "id_categoria", cat["id_categoria"]
        ).execute()
        cat["activo"] = True
        return cat

    res = sb.table("categoria").insert({"nombre": nombre}).execute()
    if not res.data:
        raise HTTPException(500, "No se pudo crear la categoria")
    return res.data[0]


@router.delete("/{id_categoria}")
def eliminar_categoria(id_categoria: int):
    """
    Borra una categoria. Rechaza si hay productos activos usandola
    (para no romper el catalogo).
    """
    sb = get_supabase()
    cat = (
        sb.table("categoria")
        .select("*")
        .eq("id_categoria", id_categoria)
        .limit(1)
        .execute()
    )
    if not cat.data:
        raise HTTPException(404, "Categoria no encontrada")

    nombre = cat.data[0]["nombre"]
    en_uso = (
        sb.table("producto")
        .select("id_producto")
        .eq("categoria", nombre)
        .eq("activo", True)
        .limit(1)
        .execute()
    )
    if en_uso.data:
        # Contar total para el mensaje
        total = (
            sb.table("producto")
            .select("id_producto", count="exact")
            .eq("categoria", nombre)
            .eq("activo", True)
            .execute()
        )
        cantidad = total.count if hasattr(total, "count") and total.count is not None else len(en_uso.data)
        raise HTTPException(
            400,
            f'No se puede borrar "{nombre}": hay {cantidad} producto(s) usandola. '
            f"Cambia esos productos de categoria primero.",
        )

    sb.table("categoria").delete().eq("id_categoria", id_categoria).execute()
    return {"mensaje": f'Categoria "{nombre}" eliminada'}
