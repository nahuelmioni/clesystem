# CleSystem - Sistema de Gestion Parabrisas La Cle

Sistema de gestion desarrollado por modulos segun el alcance del Project Charter.

## 🚀 Demo en produccion

| | URL |
|---|---|
| **App** | https://clesystem.vercel.app |
| **API** | https://clesystem.onrender.com |
| **Docs API** | https://clesystem.onrender.com/docs |
| **Repo** | https://github.com/nahuelmioni/clesystem |

**Credenciales de prueba:** usuario `admin` / contraseña `admin123`

> ⚠️ El backend corre en plan free de Render: si nadie lo usa por mas de
> 15 min se "duerme". El primer login despues de un rato puede tardar
> ~50 segundos en responder mientras se levanta. Despues anda fluido.

## Modulos en esta entrega
- **Login**: pantalla de ingreso simple (mono-usuario, hash SHA-256)
- **Control de Stock**: altas, bajas, stock disponible, estados (en stock / bajo / sin stock)
- **Ingresos**: visualizacion diaria/semanal/mensual + consulta historica filtrable
- **Clientes**: alta y edicion (particulares y asegurados)
- **Registro de Trabajos**: alta con descuento automatico de stock, generacion
  del ingreso asociado, historico filtrable, cambio de estado y cancelacion
  con reversion de stock. La operacion de alta es transaccional (RPC PostgreSQL).
  Control de pago en tres estados: no pagado / seña / pagado.

## Stack
- **Frontend**: React + JavaScript + Vite (hosteado en Vercel)
- **Backend**: Python + FastAPI (hosteado en Render, Python 3.11)
- **Base de datos**: Supabase (PostgreSQL)

## Como correr en local

### 1. Base de datos
Ejecutar en el SQL Editor de Supabase, en este orden:
1. `clesystem_schema.sql` (tablas + vistas + datos de ejemplo)
2. `backend/sql/trabajos_rpc.sql` (funciones RPC del modulo Trabajos)
3. `backend/sql/migracion_estado_pago.sql` (estado de pago en ingresos)
4. `backend/sql/migracion_login.sql` (usuario admin para login)
5. (opcional) `backend/sql/seed_datos_prueba.sql` (clientes y trabajos ficticios)

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

## Despliegue
- **Frontend (Vercel)**: importar el repo, Root Directory = `frontend`,
  agregar variable `VITE_API_URL` apuntando a la URL del backend.
- **Backend (Render)**: importar el repo, Root Directory = `backend`,
  Build = `pip install -r requirements.txt`, Start =
  `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Variables:
  `SUPABASE_URL`, `SUPABASE_KEY`, `PYTHON_VERSION=3.11.9`.

## Fuera de alcance (no implementado a proposito)
Segun el Project Charter, NO se incluye: modulo de gastos/compras,
balance global ingresos-gastos, integracion con ARCA/bancos,
facturacion electronica, migracion de datos historicos.
