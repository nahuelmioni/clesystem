"""
CleSystem - Router de Clientes
CRUD basico de clientes. Existe porque un trabajo necesita un cliente
asociado y la pantalla de trabajos debe poder darlos de alta.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List

from ..database import get_supabase
from ..models import ClienteCrear, ClienteActualizar, ClienteRespuesta

router = APIRouter(prefix="/api/clientes", tags=["Clientes"])


@router.get("", response_model=List[ClienteRespuesta])
def listar_clientes(buscar: Optional[str] = Query(None)):
    """Lista clientes. Si se pasa 'buscar', filtra por nombre o apellido."""
    sb = get_supabase()
    query = sb.table("cliente").select("*")
    if buscar:
        # ilike no soporta OR nativo en supabase-py: usamos .or_
        query = query.or_(
            f"nombre.ilike.%{buscar}%,apellido.ilike.%{buscar}%"
        )
    res = query.order("nombre").execute()
    return res.data


@router.post("", response_model=ClienteRespuesta, status_code=201)
def crear_cliente(datos: ClienteCrear):
    """Alta de cliente. Si es asegurado debe traer compania_seguro."""
    if datos.es_asegurado and not datos.compania_seguro:
        raise HTTPException(
            400, "Un cliente asegurado debe tener compania de seguro"
        )
    sb = get_supabase()
    res = sb.table("cliente").insert(datos.model_dump()).execute()
    if not res.data:
        raise HTTPException(500, "No se pudo crear el cliente")
    return res.data[0]


@router.put("/{id_cliente}", response_model=ClienteRespuesta)
def actualizar_cliente(id_cliente: int, datos: ClienteActualizar):
    sb = get_supabase()
    existe = (
        sb.table("cliente").select("id_cliente").eq("id_cliente", id_cliente).execute()
    )
    if not existe.data:
        raise HTTPException(404, "Cliente no encontrado")

    campos = datos.model_dump(exclude_unset=True)
    if not campos:
        raise HTTPException(400, "Nada para actualizar")

    sb.table("cliente").update(campos).eq("id_cliente", id_cliente).execute()
    res = sb.table("cliente").select("*").eq("id_cliente", id_cliente).execute()
    return res.data[0]


@router.delete("/{id_cliente}")
def eliminar_cliente(id_cliente: int):
    """
    Borra un cliente. Rechaza si tiene trabajos registrados para no
    romper el historial (los trabajos referencian cliente con ON DELETE
    RESTRICT, ademas).
    """
    sb = get_supabase()
    existe = (
        sb.table("cliente").select("nombre, apellido").eq("id_cliente", id_cliente).execute()
    )
    if not existe.data:
        raise HTTPException(404, "Cliente no encontrado")

    trabajos = (
        sb.table("trabajo")
        .select("id_trabajo", count="exact")
        .eq("id_cliente", id_cliente)
        .execute()
    )
    cantidad = trabajos.count if hasattr(trabajos, "count") and trabajos.count is not None else len(trabajos.data or [])
    if cantidad > 0:
        raise HTTPException(
            400,
            f"No se puede borrar: el cliente tiene {cantidad} trabajo(s) "
            f"registrado(s). Editalo en vez de borrarlo.",
        )

    sb.table("cliente").delete().eq("id_cliente", id_cliente).execute()
    return {"mensaje": "Cliente eliminado"}
