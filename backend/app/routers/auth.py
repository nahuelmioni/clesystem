"""
CleSystem - Router de autenticacion
Login simple para un sistema mono-usuario.

No usa JWT ni sesion del lado del servidor: el frontend recuerda al usuario
en localStorage. Los endpoints del backend siguen sin requerir auth (el TP
asume que solo el dueno opera el sistema).
"""
import hashlib
from fastapi import APIRouter, HTTPException

from ..database import get_supabase
from ..models import LoginRequest, LoginRespuesta

router = APIRouter(prefix="/api/auth", tags=["Auth"])


def _hash_password(password: str) -> str:
    """Hash SHA-256 del password (matchea la columna password_hash de la BD)."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


@router.post("/login", response_model=LoginRespuesta)
def login(datos: LoginRequest):
    """Valida usuario y password contra la tabla usuario."""
    sb = get_supabase()
    res = (
        sb.table("usuario")
        .select("id_usuario, nombre, username, password_hash, rol, activo")
        .eq("username", datos.username)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(401, "Usuario o contraseña incorrectos")

    u = res.data[0]
    if not u.get("activo"):
        raise HTTPException(403, "Usuario inactivo")
    if u.get("password_hash") != _hash_password(datos.password):
        raise HTTPException(401, "Usuario o contraseña incorrectos")

    return LoginRespuesta(
        id_usuario=u["id_usuario"],
        nombre=u["nombre"],
        username=u["username"],
        rol=u["rol"],
    )
