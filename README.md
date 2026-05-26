# CleSystem - Sistema de Gestion Parabrisas La Cle

Sistema de gestion desarrollado por modulos segun el alcance del Project Charter.

## Modulos en esta entrega
- **Control de Stock**: altas, bajas, stock disponible, estados (en stock / bajo / sin stock)
- **Ingresos**: visualizacion diaria/semanal/mensual + consulta historica filtrable
- **Clientes**: alta y edicion (particulares y asegurados)
- **Registro de Trabajos**: alta con descuento automatico de stock, generacion
  del ingreso asociado, historico filtrable, cambio de estado y cancelacion
  con reversion de stock. La operacion de alta es transaccional (RPC PostgreSQL)

## Stack
- Backend: Python + FastAPI (intermediario con Supabase)
- Frontend: React + JavaScript + Vite
- Base de datos: Supabase (PostgreSQL)
- Hosting previsto: Vercel

## Como correr en local

### 1. Base de datos
Ejecutar en el SQL Editor de Supabase, en este orden:
1. `clesystem_schema.sql` (tablas + vistas + datos de ejemplo)
2. `backend/sql/trabajos_rpc.sql` (funciones RPC del modulo Trabajos)

### 2. Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # completar con credenciales reales de Supabase
uvicorn app.main:app --reload
```
API disponible en http://localhost:8000 — documentacion en http://localhost:8000/docs

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
App disponible en http://localhost:5173

## Fuera de alcance (no implementado a proposito)
Segun el Project Charter, NO se incluye: modulo de gastos/compras,
balance global ingresos-gastos, integracion con ARCA/bancos,
facturacion electronica, migracion de datos historicos.
