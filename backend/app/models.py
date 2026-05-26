"""
CleSystem - Modelos Pydantic
Validan los datos que entran y salen de la API.
Esto cumple el objetivo del Charter de "minimizar errores en la informacion".
"""
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


# ==========================================================================
# PRODUCTO / STOCK
# ==========================================================================
class ProductoBase(BaseModel):
    nombre_producto: str = Field(..., min_length=1, max_length=150)
    descripcion: Optional[str] = None
    categoria: str = Field(..., min_length=1, max_length=50)
    modelo_auto: Optional[str] = Field(None, max_length=120)
    codigo_fabricante: Optional[str] = Field(None, max_length=100)
    precio_costo: float = Field(0, ge=0)
    precio_venta: float = Field(0, ge=0)
    activo: bool = True


class ProductoCrear(ProductoBase):
    cantidad_actual: int = Field(0, ge=0)
    stock_minimo: int = Field(0, ge=0)
    ubicacion_estanteria: Optional[str] = Field(None, max_length=60)


class ProductoActualizar(BaseModel):
    nombre_producto: Optional[str] = Field(None, min_length=1, max_length=150)
    descripcion: Optional[str] = None
    categoria: Optional[str] = Field(None, min_length=1, max_length=50)
    modelo_auto: Optional[str] = Field(None, max_length=120)
    codigo_fabricante: Optional[str] = Field(None, max_length=100)
    precio_costo: Optional[float] = Field(None, ge=0)
    precio_venta: Optional[float] = Field(None, ge=0)
    activo: Optional[bool] = None
    cantidad_actual: Optional[int] = Field(None, ge=0)
    stock_minimo: Optional[int] = Field(None, ge=0)
    ubicacion_estanteria: Optional[str] = Field(None, max_length=60)


class ProductoRespuesta(ProductoBase):
    id_producto: int
    cantidad_actual: int
    stock_minimo: int
    ubicacion_estanteria: Optional[str] = None
    estado: str  # calculado: "en_stock" | "stock_bajo" | "sin_stock"


# ==========================================================================
# CATEGORIA
# ==========================================================================
class CategoriaCrear(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=50)


class CategoriaRespuesta(BaseModel):
    id_categoria: int
    nombre: str
    activo: bool = True


# ==========================================================================
# INGRESOS  (lectura - los ingresos se generan al cobrar un trabajo)
# ==========================================================================
class IngresoRespuesta(BaseModel):
    id_ingreso: int
    id_trabajo: int
    monto_recibido: float
    metodo_pago: str
    fecha_ingreso: datetime
    cliente: Optional[str] = None
    descripcion_servicio: Optional[str] = None


class ResumenIngresos(BaseModel):
    """Totales para las tarjetas del dashboard de ingresos."""
    total_dia: float
    total_semana: float
    total_mes: float
    cantidad_trabajos_dia: int
    cantidad_trabajos_mes: int


class IngresoCrear(BaseModel):
    """
    Registro manual de un ingreso ligado a un trabajo.
    Un solo pago por trabajo (decision de diseno del modelo de datos).
    """
    id_trabajo: int
    monto_recibido: float = Field(..., ge=0)
    metodo_pago: str = Field(
        "efectivo",
        pattern="^(efectivo|transferencia|cheque|tarjeta|seguro)$",
    )


# ==========================================================================
# CLIENTES
# ==========================================================================
class ClienteBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    apellido: Optional[str] = Field(None, max_length=100)
    telefono: Optional[str] = Field(None, max_length=30)
    email: Optional[str] = Field(None, max_length=150)
    direccion: Optional[str] = Field(None, max_length=200)
    compania_seguro: Optional[str] = Field(None, max_length=120)
    nro_siniestro: Optional[str] = Field(None, max_length=60)
    es_asegurado: bool = False


class ClienteCrear(ClienteBase):
    pass


class ClienteActualizar(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    apellido: Optional[str] = Field(None, max_length=100)
    telefono: Optional[str] = Field(None, max_length=30)
    email: Optional[str] = Field(None, max_length=150)
    direccion: Optional[str] = Field(None, max_length=200)
    compania_seguro: Optional[str] = Field(None, max_length=120)
    nro_siniestro: Optional[str] = Field(None, max_length=60)
    es_asegurado: Optional[bool] = None


class ClienteRespuesta(ClienteBase):
    id_cliente: int
    creado_en: Optional[datetime] = None


# ==========================================================================
# TRABAJOS
# ==========================================================================
class DetalleTrabajoItem(BaseModel):
    """Un producto usado dentro de un trabajo."""
    id_producto: int
    cantidad: int = Field(..., gt=0)
    precio_unitario: float = Field(..., ge=0)


class DetalleTrabajoRespuesta(BaseModel):
    id_detalle: int
    id_producto: int
    nombre_producto: Optional[str] = None
    cantidad_usada: int
    precio_unitario: float
    subtotal: float


class TrabajoCrear(BaseModel):
    """
    Alta de un trabajo. El backend invoca el RPC crear_trabajo_completo
    que valida stock, descuenta inventario y crea el ingreso, todo en
    una sola transaccion.
    """
    id_cliente: int
    fecha_trabajo: Optional[date] = None
    patente_vehiculo: Optional[str] = Field(None, max_length=20)
    modelo_vehiculo: Optional[str] = Field(None, max_length=120)
    descripcion_servicio: Optional[str] = None
    tipo_servicio: str = Field("servicio", pattern="^(venta|servicio)$")
    estado: str = Field(
        "pendiente",
        pattern="^(pendiente|en_proceso|finalizado|entregado|cancelado)$",
    )
    mano_obra: float = Field(0, ge=0)
    monto_recibido: float = Field(0, ge=0)
    metodo_pago: str = Field(
        "efectivo",
        pattern="^(efectivo|transferencia|cheque|tarjeta|seguro)$",
    )
    estado_pago: Optional[str] = Field(
        None,
        pattern="^(no_pagado|sena|pagado)$",
        description="Si no se envia, se infiere del monto recibido vs total.",
    )
    productos: list[DetalleTrabajoItem] = []


class PagoActualizar(BaseModel):
    """Para cambiar el estado de pago de un trabajo despues de creado."""
    estado_pago: str = Field(..., pattern="^(no_pagado|sena|pagado)$")
    monto_recibido: float = Field(..., ge=0)
    metodo_pago: Optional[str] = Field(
        None,
        pattern="^(efectivo|transferencia|cheque|tarjeta|seguro)$",
    )


class TrabajoActualizar(BaseModel):
    """Solo permite editar el estado (workflow del trabajo)."""
    estado: str = Field(
        ...,
        pattern="^(pendiente|en_proceso|finalizado|entregado|cancelado)$",
    )


class TrabajoRespuesta(BaseModel):
    id_trabajo: int
    id_cliente: int
    cliente: Optional[str] = None
    fecha_trabajo: date
    patente_vehiculo: Optional[str] = None
    modelo_vehiculo: Optional[str] = None
    descripcion_servicio: Optional[str] = None
    tipo_servicio: str
    estado: str
    mano_obra: float
    costo_total: float
    monto_recibido: Optional[float] = None
    metodo_pago: Optional[str] = None
    estado_pago: Optional[str] = None
    productos: Optional[list[DetalleTrabajoRespuesta]] = None


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1, max_length=100)


class LoginRespuesta(BaseModel):
    id_usuario: int
    nombre: str
    username: str
    rol: str


class ResumenTrabajos(BaseModel):
    """Tarjetas del encabezado de la pantalla Trabajos."""
    total_dia: int
    total_semana: int
    total_mes: int
    pendientes: int
