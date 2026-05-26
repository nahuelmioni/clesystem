"""
CleSystem - API principal
Sistema de gestion para Parabrisas La Cle.

Modulos activos: Stock, Ingresos, Clientes, Trabajos.
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from .routers import stock, ingresos, clientes, trabajos, auth, categorias

app = FastAPI(
    title="CleSystem API",
    description="Sistema de gestion - Parabrisas La Cle",
    version="1.0.0",
)

# CORS: en local permite localhost; en produccion acepta cualquier subdominio
# de vercel.app (todos los preview y production del frontend).
origenes = [
    "http://localhost:5173",
    "http://localhost:3000",
]
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    origenes.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origenes,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(stock.router)
app.include_router(categorias.router)
app.include_router(ingresos.router)
app.include_router(clientes.router)
app.include_router(trabajos.router)


@app.get("/")
def raiz():
    return {
        "sistema": "CleSystem",
        "estado": "activo",
        "modulos": ["stock", "categorias", "ingresos", "clientes", "trabajos"],
        "documentacion": "/docs",
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}
