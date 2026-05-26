"""
CleSystem - Conexion a Supabase
Centraliza el cliente de Supabase para que todos los routers lo reutilicen.
La clave NUNCA se expone al frontend: vive solo en el backend.
"""
import os
from functools import lru_cache
from supabase import create_client, Client


@lru_cache()
def get_supabase() -> Client:
    """
    Devuelve un cliente de Supabase reutilizable.
    Las credenciales se leen de variables de entorno (.env).
    """
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")

    if not url or not key:
        raise RuntimeError(
            "Faltan SUPABASE_URL o SUPABASE_KEY. "
            "Configuralas en el archivo .env del backend."
        )

    return create_client(url, key)
