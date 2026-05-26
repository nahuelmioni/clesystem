# CleSystem — Documentación técnica del proyecto (HANDOFF)

> Documento de traspaso. Leé esto completo antes de tocar código.
> Pensado para que otro asistente (Claude Code, Cursor) continúe el desarrollo
> sin contexto previo.

---

## 0. Producción

| | URL |
|---|---|
| App (Vercel) | https://clesystem.vercel.app |
| API (Render) | https://clesystem.onrender.com |
| Docs API | https://clesystem.onrender.com/docs |
| Repo (GitHub) | https://github.com/nahuelmioni/clesystem |

Credenciales de prueba: `admin` / `admin123`

**Limitación de Render free**: el backend se duerme tras 15 min de
inactividad. Primer request después de dormirse tarda ~50 seg.

Para redeployar: `git push` a `main` → Vercel y Render se actualizan
automáticamente.

---

## 1. Qué es esto

CleSystem es un sistema de gestión web para **Parabrisas La Cle**, una PyME
familiar de reposición de cristales automotores y cerrajería en San Vicente
(GBA Sur, Argentina). Reemplaza procesos manuales (anotaciones en cuaderno,
control visual de estanterías) por un sistema centralizado.

Es un proyecto académico con un **Project Charter aprobado**. El alcance está
formalmente controlado: NO se deben agregar funcionalidades fuera del alcance
sin pasar por el control de cambios. Esto es importante: hay un rol de QA en
el equipo que valida que no haya scope creep.

---

## 2. Alcance del proyecto (qué SÍ y qué NO)

### DENTRO del alcance (implementar)
- Registro digital de trabajos (fecha, servicio/producto, importe)
- Control de stock: altas, bajas, stock disponible
- Visualización de ingresos: diarios, semanales, mensuales
- Consulta de información histórica
- Gestión básica de pedidos a proveedores
- Interfaz simple orientada al usuario principal (el dueño)

### FUERA del alcance (NO implementar sin aprobación formal)
- Módulo de gastos/compras con categorías y métodos de pago
- Balance global ingresos vs gastos / "ganancia neta real"
- Integración con ARCA, bancos, home banking
- Facturación electrónica
- Migración de datos históricos existentes
- Multi-sucursal (el modelo lo soporta a futuro, pero no se implementa ahora)

> Nota: las maquetas originales (imágenes WhatsApp) incluían pantallas de
> "Compras/Gastos" y un dashboard con "Balance final". Esas se EXCLUYERON
> a propósito por estar fuera del alcance aprobado. No reintroducir sin
> aprobación del cliente.

---

## 3. Stack tecnológico

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Frontend | React 18 + Vite + JavaScript | React Router para ruteo |
| Backend | Python + FastAPI | Hace de intermediario, valida con Pydantic |
| Base de datos | Supabase (PostgreSQL) | Cliente oficial `supabase-py` |
| Hosting previsto | Vercel (frontend) | Backend aún sin definir dónde se aloja |

**Decisión de arquitectura clave:** el frontend NUNCA habla directo con
Supabase. Todo pasa por el backend FastAPI. Razones: lógica de negocio
centralizada, y la `service_role` key de Supabase nunca llega al navegador.

---

## 4. Estructura de archivos

```
clesystem/
├── README.md                       # Guía de instalación rápida
├── clesystem_schema.sql            # Script de creación de la BD (ejecutar en Supabase)
│
├── backend/
│   ├── requirements.txt            # Dependencias Python
│   ├── .env.example                # Plantilla de variables (copiar a .env)
│   ├── sql/
│   │   └── trabajos_rpc.sql        # Funciones PL/pgSQL del módulo Trabajos
│   └── app/
│       ├── __init__.py
│       ├── main.py                 # App FastAPI, CORS, registro de routers
│       ├── database.py             # Cliente Supabase (singleton con lru_cache)
│       ├── models.py               # Modelos Pydantic (validación entrada/salida)
│       └── routers/
│           ├── __init__.py
│           ├── stock.py            # Endpoints módulo Stock
│           ├── ingresos.py         # Endpoints módulo Ingresos
│           ├── clientes.py         # CRUD de clientes
│           └── trabajos.py         # Endpoints módulo Trabajos (alta vía RPC)
│
└── frontend/
    ├── package.json                # Dependencias Node
    ├── vite.config.js              # Config Vite (puerto 5173)
    ├── index.html                  # Entry HTML
    ├── .env.example                # Plantilla (VITE_API_URL)
    └── src/
        ├── main.jsx                # Entry React
        ├── App.jsx                 # Rutas (React Router)
        ├── api.js                  # Cliente API centralizado (fetch al backend)
        ├── styles.css              # Todos los estilos (replica maquetas aprobadas)
        ├── components/
        │   └── Sidebar.jsx         # Menú lateral
        └── pages/
            ├── Inicio.jsx          # Dashboard resumen
            ├── Stock.jsx           # Control de stock (tabla + modal alta/edición)
            ├── Ingresos.jsx        # Visualización + histórico de ingresos
            ├── Trabajos.jsx        # Registro de trabajos (alta + histórico)
            └── Clientes.jsx        # CRUD básico de clientes
```

---

## 5. Estado actual del desarrollo

### Implementado y probado funcionando
- **Módulo Stock** (completo): listar con filtros, crear, editar, baja lógica,
  tarjetas de resumen, cálculo de estado (en_stock / stock_bajo / sin_stock).
- **Módulo Ingresos** (completo en lectura): resumen día/semana/mes,
  histórico filtrable por fecha y método de pago, agrupación por día.
- **Módulo Clientes**: listado con búsqueda + alta/edición (particulares y
  asegurados).
- **Módulo Registro de Trabajos** (completo): resumen día/semana/mes/pendientes,
  histórico con filtros, alta con lista dinámica de productos, descuento
  automático de stock, generación del ingreso asociado, edición de estado,
  cancelación con reversión de stock. El alta es **transaccional** vía RPC
  PostgreSQL (`crear_trabajo_completo`).
- **Pantalla Inicio**: dashboard con resumen de ingresos + estado de stock.
- **Sidebar**: navegación con los 5 módulos.

### Próximos pasos (todavía pendientes)
- Gestión básica de pedidos a proveedores (sin UI; tablas ya existen).
- Despliegue (frontend a Vercel + backend a Railway/Render/Fly).

### Decisiones de diseño ya tomadas (respetarlas)
- Un trabajo recibe **un solo pago** (relación TRABAJO 1:1 INGRESO).
- La **mano de obra** se registra aparte: campo `mano_obra` en tabla `trabajo`.
- La **ganancia NO se guarda** como campo: se calcula con la vista
  `v_rentabilidad_trabajo`. No agregar columna de ganancia persistida.
- La **baja de productos es lógica** (`activo = false`), nunca DELETE físico,
  para mantener trazabilidad (objetivo del Charter).
- El `subtotal` en `detalle_trabajo` es una **columna generada** en PostgreSQL
  (`GENERATED ALWAYS AS cantidad_usada * precio_unitario STORED`). No
  escribirla desde la app.
- `movimiento_stock` da la trazabilidad: toda entrada/salida debe registrarse
  ahí. Actualmente la actualización de `stock.cantidad_actual` se hace desde
  el backend (no hay trigger en la BD). Decidir si conviene un trigger cuando
  se desarrolle Trabajos.

---

## 6. Base de datos

Modelo relacional normalizado. 11 tablas + 3 vistas. Ver `clesystem_schema.sql`
para el DDL completo (incluye CHECK constraints, FKs, índices y datos de
ejemplo).

### Tablas
- `usuario` — quién opera el sistema (dueño, técnico)
- `cliente` — particulares y asegurados (compania_seguro, nro_siniestro)
- `producto` — catálogo (nombre, categoría, precio_costo, precio_venta)
- `stock` — existencias físicas por ubicación (cantidad_actual, stock_minimo)
- `trabajo` — servicio a un cliente (incluye campo `mano_obra`)
- `detalle_trabajo` — productos usados por trabajo (subtotal es generado)
- `ingreso` — cobro del trabajo (UNIQUE id_trabajo → un pago por trabajo)
- `movimiento_stock` — trazabilidad de entradas/salidas
- `proveedor` — proveedores de cristales/cerrajería
- `pedido_compra` — pedidos a proveedores (gestión básica)
- `detalle_pedido` — ítems de cada pedido

### Vistas (cálculos automáticos, no persistir estos valores)
- `v_rentabilidad_trabajo` — ganancia neta = cobrado − costo productos − mano_obra
- `v_ingresos_diarios` — ingresos agrupados por día
- `v_stock_bajo` — productos con cantidad <= mínimo (alerta reposición)

### Separación importante
`producto` (catálogo) y `stock` (existencias) están SEPARADOS a propósito.
Un producto puede tener stock en distintas ubicaciones. No volver a unificar.

---

## 7. API — Endpoints actuales

Base URL local: `http://localhost:8000`
Documentación interactiva auto-generada: `http://localhost:8000/docs`

### Stock (`/api/stock`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/stock/resumen` | Totales: total, en_stock, stock_bajo, sin_stock |
| GET | `/api/stock` | Lista productos. Query: `buscar`, `categoria`, `estado` |
| POST | `/api/stock` | Alta de producto + stock inicial |
| PUT | `/api/stock/{id}` | Edición de producto y/o stock |
| DELETE | `/api/stock/{id}` | Baja lógica (activo = false) |

### Ingresos (`/api/ingresos`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/ingresos/resumen` | Totales día/semana/mes |
| GET | `/api/ingresos` | Histórico. Query: `desde`, `hasta`, `metodo_pago` |
| GET | `/api/ingresos/por-dia` | Agrupado por día. Query: `dias` (1-90) |
| POST | `/api/ingresos` | Registrar cobro de un trabajo (uso futuro desde Trabajos) |

### Otros
- `GET /` — info del sistema y módulos activos
- `GET /api/health` — healthcheck

### Clientes (`/api/clientes`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/clientes` | Lista clientes. Query: `buscar` (nombre o apellido) |
| POST | `/api/clientes` | Alta |
| PUT | `/api/clientes/{id}` | Edición |

### Trabajos (`/api/trabajos`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/trabajos/resumen` | Totales día/semana/mes + pendientes |
| GET | `/api/trabajos` | Listado. Query: `desde`, `hasta`, `id_cliente`, `estado` |
| GET | `/api/trabajos/{id}` | Detalle del trabajo + productos usados |
| POST | `/api/trabajos` | Alta (llama al RPC `crear_trabajo_completo`) |
| PUT | `/api/trabajos/{id}` | Cambio de estado (no admite "cancelado") |
| PATCH | `/api/trabajos/{id}/pago` | Actualiza estado_pago + monto + metodo del ingreso |
| DELETE | `/api/trabajos/{id}` | Cancela y revierte stock (RPC `cancelar_trabajo`) |

### Funciones RPC en PostgreSQL (Supabase)
Las operaciones multi-tabla del módulo Trabajos viven en
`backend/sql/trabajos_rpc.sql`. **Hay que ejecutarlo una vez** en el SQL
Editor de Supabase (después del schema). Define:
- `crear_trabajo_completo(payload JSONB)` — valida stock, crea trabajo +
  detalles + movimientos + ingreso y descuenta stock, todo en una sola
  transacción. Si algo falla, rollback automático.
- `cancelar_trabajo(p_id_trabajo INTEGER)` — devuelve productos al stock,
  elimina el ingreso y marca el trabajo como cancelado.

### Categorías y enums válidos (CHECK constraints en BD)
- `producto.categoria`: `cristal` | `cerrajeria` | `insumo`
- `trabajo.tipo_servicio`: `venta` | `servicio`
- `trabajo.estado`: `pendiente` | `en_proceso` | `finalizado` | `entregado` | `cancelado`
- `ingreso.metodo_pago`: `efectivo` | `transferencia` | `cheque` | `tarjeta` | `seguro`
- `ingreso.estado_pago`: `no_pagado` | `sena` | `pagado` (agregado en migracion)
- `usuario.rol`: `dueno` | `administrativo` | `tecnico` | `operador`
- `movimiento_stock.tipo_movimiento`: `entrada` | `salida` | `ajuste`

---

## 8. Cómo correr el proyecto en local

### Prerrequisitos
- Python 3.10+
- Node.js 18+
- Proyecto Supabase con `clesystem_schema.sql` ya ejecutado
- Adicionalmente, ejecutar en el SQL Editor de Supabase (en este orden):
  1. `backend/sql/trabajos_rpc.sql` — crea funciones RPC del modulo Trabajos
  2. `backend/sql/migracion_estado_pago.sql` — agrega ingreso.estado_pago
     y actualiza el RPC para que lo reciba
  3. `backend/sql/migracion_login.sql` — agrega columnas username y
     password_hash a usuario, crea el usuario admin/admin123
  4. (opcional) `backend/sql/seed_datos_prueba.sql` — clientes y trabajos
     ficticios para probar la UI

### Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Editar .env con SUPABASE_URL y SUPABASE_KEY (service_role) reales
uvicorn app.main:app --reload
# Corre en http://localhost:8000  — docs en /docs
```

### Frontend (terminal aparte, backend debe seguir corriendo)
```bash
cd frontend
npm install
cp .env.example .env                 # default ya apunta a localhost:8000
npm run dev
# Corre en http://localhost:5173
```

### Variables de entorno
**backend/.env**
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=<service_role key — secreta, nunca exponer al frontend>
```
**frontend/.env**
```
VITE_API_URL=http://localhost:8000
```

---

## 9. Próximos pasos sugeridos (roadmap)

Orden definido: ingresos → stock → trabajos. **Los tres están hechos.**
Queda:

1. **Gestión básica de pedidos a proveedores** (está en alcance pero aún
   sin UI): tablas `proveedor`, `pedido_compra`, `detalle_pedido` ya existen
   en la BD. Falta backend + frontend.

2. **Despliegue**: configurar Vercel para el frontend y definir hosting del
   backend (Railway, Render, Fly.io o similar). Actualizar `allow_origins`
   en `backend/app/main.py` con la URL de producción y `VITE_API_URL` en
   el frontend.

### Al continuar, respetar
- El alcance del Charter (sección 2). No agregar gastos/balance/ARCA.
- Las decisiones de diseño ya tomadas (sección 5).
- El patrón: frontend → backend → Supabase. Nunca frontend → Supabase directo.
- Validación Pydantic en todo input del backend.
- Baja lógica, nunca DELETE físico.
- Mantener el diseño visual existente (styles.css replica las maquetas que
  el cliente ya aprobó — no rediseñar).

---

## 10. Notas de seguridad

- La `service_role` key de Supabase da acceso total a la BD. Vive solo en
  `backend/.env`. Nunca commitearla (agregar `.env` a `.gitignore`).
- Si la key se expuso alguna vez, rotarla en Supabase: Settings → API → Reset.
- Hay un login **simple/ficticio** para el TP (usuario `admin` /
  contraseña `admin123`). El password se guarda hasheado en SHA-256, sin
  salt. Login mono-usuario, sin JWT ni sesión del lado del servidor:
  el frontend recuerda al usuario en `localStorage`. Para producción real
  habría que: agregar salt + bcrypt/argon2, emitir JWT y proteger los
  endpoints del backend con `Depends`.
```
