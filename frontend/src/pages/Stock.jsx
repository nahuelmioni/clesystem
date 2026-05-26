// CleSystem - Pagina Control de Stock
// Alcance: altas, bajas, stock disponible (Project Charter).

import { useState, useEffect, useCallback, Fragment } from "react";
import { stockApi, categoriasApi } from "../api";

const ESTADO_LABEL = {
  en_stock: { txt: "EN STOCK", cls: "badge-ok" },
  stock_bajo: { txt: "STOCK BAJO", cls: "badge-warn" },
  sin_stock: { txt: "SIN STOCK", cls: "badge-danger" },
};

function fechaHoy() {
  return new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function Stock() {
  const [resumen, setResumen] = useState(null);
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [buscar, setBuscar] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [catsAbierto, setCatsAbierto] = useState(false);
  const [expandidos, setExpandidos] = useState(() => new Set());

  function toggleExpand(id) {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function recargarCategorias() {
    try { setCategorias(await categoriasApi.listar()); }
    catch (e) { /* silenciar: la pantalla sigue siendo usable */ }
  }
  useEffect(() => { recargarCategorias(); }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [res, prods] = await Promise.all([
        stockApi.resumen(),
        stockApi.listar({
          buscar,
          categoria: filtroCategoria,
          estado: filtroEstado,
        }),
      ]);
      setResumen(res);
      setProductos(prods);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [buscar, filtroCategoria, filtroEstado]);

  useEffect(() => {
    const t = setTimeout(cargar, 300);
    return () => clearTimeout(t);
  }, [cargar]);

  async function darBaja(id, nombre) {
    if (!confirm(`¿Dar de baja "${nombre}"? El producto quedará inactivo.`))
      return;
    try {
      await stockApi.baja(id);
      cargar();
    } catch (e) {
      alert("Error: " + e.message);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>📦 Control de Stock</h1>
          <p className="page-sub">Administrá y controlá todos los productos en stock.</p>
        </div>
        <div className="head-right">
          <div className="date-chip">📅 {fechaHoy()}</div>
          <button className="btn btn-ghost" onClick={() => setCatsAbierto(true)}>
            🏷 Categorías
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditando(null);
              setModalAbierto(true);
            }}
          >
            + Agregar producto
          </button>
        </div>
      </header>

      {resumen && (
        <div className="cards-row">
          <Card color="blue" icon="📦" label="TOTAL PRODUCTOS"
            value={resumen.total_productos} sub="Productos en el inventario" />
          <Card color="green" icon="✓" label="EN STOCK"
            value={resumen.en_stock} sub="Con stock disponible" />
          <Card color="amber" icon="⚠" label="STOCK BAJO"
            value={resumen.stock_bajo} sub="Próximos a agotarse" />
          <Card color="red" icon="✕" label="SIN STOCK"
            value={resumen.sin_stock} sub="Productos agotados" />
        </div>
      )}

      <div className="panel">
        <div className="filtros">
          <input
            className="input"
            placeholder="Buscar por nombre o código del fabricante..."
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
          <select
            className="input"
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.id_categoria} value={c.nombre}>
                {c.nombre.charAt(0).toUpperCase() + c.nombre.slice(1)}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="en_stock">En stock</option>
            <option value="stock_bajo">Stock bajo</option>
            <option value="sin_stock">Sin stock</option>
          </select>
        </div>

        {error && <div className="alert-error">⚠ {error}</div>}
        {cargando ? (
          <div className="loading">Cargando productos…</div>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>PRODUCTO</th>
                <th>CATEGORÍA</th>
                <th>STOCK ACTUAL</th>
                <th>STOCK MÍNIMO</th>
                <th>ESTADO</th>
                <th>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {productos.length === 0 && (
                <tr>
                  <td colSpan="7" className="vacio">
                    No hay productos que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
              {productos.map((p) => {
                const est = ESTADO_LABEL[p.estado];
                const abierto = expandidos.has(p.id_producto);
                return (
                  <Fragment key={p.id_producto}>
                    <tr>
                      <td>
                        <button
                          className="btn-expand"
                          onClick={() => toggleExpand(p.id_producto)}
                          title={abierto ? "Ocultar detalle" : "Ver detalle"}
                          aria-expanded={abierto}
                        >
                          {abierto ? "▾" : "▸"}
                        </button>
                      </td>
                      <td>{p.nombre_producto}</td>
                      <td className="cap">{p.categoria}</td>
                      <td className={`stock-num stock-${p.estado}`}>
                        {p.cantidad_actual}{" "}
                        {p.cantidad_actual === 1 ? "unidad" : "unidades"}
                      </td>
                      <td>
                        {p.stock_minimo}{" "}
                        {p.stock_minimo === 1 ? "unidad" : "unidades"}
                      </td>
                      <td>
                        <span className={`badge ${est.cls}`}>{est.txt}</span>
                      </td>
                      <td>
                        <button
                          className="btn-icon btn-edit"
                          onClick={() => {
                            setEditando(p);
                            setModalAbierto(true);
                          }}
                          title="Editar"
                        >
                          ✎
                        </button>
                        <button
                          className="btn-icon btn-del"
                          onClick={() =>
                            darBaja(p.id_producto, p.nombre_producto)
                          }
                          title="Dar de baja"
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                    {abierto && (
                      <tr className="tabla-fila-detalle">
                        <td></td>
                        <td colSpan="6">
                          <div className="tabla-fila-detalle-grid">
                            <div>
                              <span className="det-label">📍 Ubicación</span>
                              <span className="det-valor">{p.ubicacion_estanteria || "—"}</span>
                            </div>
                            <div>
                              <span className="det-label">🔖 Código fabricante</span>
                              <span className="det-valor">{p.codigo_fabricante || "—"}</span>
                            </div>
                            <div>
                              <span className="det-label">🚗 Modelo del auto</span>
                              <span className="det-valor">{p.modelo_auto || "—"}</span>
                            </div>
                            <div>
                              <span className="det-label">💵 Precio costo</span>
                              <span className="det-valor">${Number(p.precio_costo || 0).toLocaleString("es-AR")}</span>
                            </div>
                            <div>
                              <span className="det-label">🏷 Precio venta</span>
                              <span className="det-valor">${Number(p.precio_venta || 0).toLocaleString("es-AR")}</span>
                            </div>
                            <div className="det-descripcion">
                              <span className="det-label">📝 Descripción</span>
                              <span className="det-valor">{p.descripcion || "—"}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="leyenda">
          <span>🟢 En stock: suficiente</span>
          <span>🟡 Stock bajo: ≤ al mínimo</span>
          <span>🔴 Sin stock: 0 unidades</span>
        </div>
      </div>

      {modalAbierto && (
        <ModalProducto
          producto={editando}
          categorias={categorias}
          onCerrar={() => setModalAbierto(false)}
          onGuardado={() => {
            setModalAbierto(false);
            cargar();
          }}
        />
      )}

      {catsAbierto && (
        <ModalCategorias
          categorias={categorias}
          onCerrar={() => setCatsAbierto(false)}
          onCambio={() => {
            recargarCategorias();
            cargar();
          }}
        />
      )}
    </div>
  );
}

function Card({ color, icon, label, value, sub }) {
  return (
    <div className="card">
      <div className={`card-icon card-${color}`}>{icon}</div>
      <div>
        <p className="card-label">{label}</p>
        <p className="card-value">{value}</p>
        <p className="card-sub">{sub}</p>
      </div>
    </div>
  );
}

function ModalProducto({ producto, categorias, onCerrar, onGuardado }) {
  const esEdicion = !!producto;
  const opcionesCat = categorias && categorias.length
    ? categorias.map((c) => c.nombre)
    : ["cristal", "cerrajeria", "insumo"];
  const [form, setForm] = useState({
    nombre_producto: producto?.nombre_producto || "",
    categoria: producto?.categoria || opcionesCat[0] || "",
    modelo_auto: producto?.modelo_auto || "",
    codigo_fabricante: producto?.codigo_fabricante || "",
    descripcion: producto?.descripcion || "",
    precio_costo: producto?.precio_costo || 0,
    precio_venta: producto?.precio_venta || 0,
    cantidad_actual: producto?.cantidad_actual || 0,
    stock_minimo: producto?.stock_minimo || 0,
    ubicacion_estanteria: producto?.ubicacion_estanteria || "",
  });
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState(null);

  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function guardar() {
    if (!form.nombre_producto.trim()) {
      setErr("El nombre es obligatorio");
      return;
    }
    setGuardando(true);
    setErr(null);
    try {
      if (esEdicion) {
        await stockApi.actualizar(producto.id_producto, form);
      } else {
        await stockApi.crear(form);
      }
      onGuardado();
    } catch (e) {
      setErr(e.message);
      setGuardando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{esEdicion ? "Editar producto" : "Nuevo producto"}</h2>
        {err && <div className="alert-error">⚠ {err}</div>}

        <label>Nombre del producto</label>
        <input
          className="input"
          value={form.nombre_producto}
          onChange={(e) => set("nombre_producto", e.target.value)}
        />

        <div className="grid-2">
          <div>
            <label>Categoría</label>
            <select
              className="input"
              value={form.categoria}
              onChange={(e) => set("categoria", e.target.value)}
            >
              {opcionesCat.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Código del fabricante (opcional)</label>
            <input
              className="input"
              placeholder="Ej: VW-3B0845011"
              value={form.codigo_fabricante}
              onChange={(e) => set("codigo_fabricante", e.target.value)}
            />
          </div>
        </div>

        <div className="grid-2">
          <div>
            <label>Modelo de auto (opcional)</label>
            <input
              className="input"
              value={form.modelo_auto}
              onChange={(e) => set("modelo_auto", e.target.value)}
            />
          </div>
          <div>
            <label>Descripción (opcional)</label>
            <input
              className="input"
              value={form.descripcion}
              onChange={(e) => set("descripcion", e.target.value)}
            />
          </div>
        </div>

        <div className="grid-2">
          <div>
            <label>Precio costo</label>
            <input
              type="number"
              className="input"
              value={form.precio_costo}
              onChange={(e) => set("precio_costo", Number(e.target.value))}
            />
          </div>
          <div>
            <label>Precio venta</label>
            <input
              type="number"
              className="input"
              value={form.precio_venta}
              onChange={(e) => set("precio_venta", Number(e.target.value))}
            />
          </div>
        </div>

        <div className="grid-2">
          <div>
            <label>Stock actual</label>
            <input
              type="number"
              className="input"
              value={form.cantidad_actual}
              onChange={(e) => set("cantidad_actual", Number(e.target.value))}
            />
          </div>
          <div>
            <label>Stock mínimo</label>
            <input
              type="number"
              className="input"
              value={form.stock_minimo}
              onChange={(e) => set("stock_minimo", Number(e.target.value))}
            />
          </div>
        </div>

        <label>Ubicación en estantería (opcional)</label>
        <input
          className="input"
          value={form.ubicacion_estanteria}
          onChange={(e) => set("ubicacion_estanteria", e.target.value)}
        />

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={guardar}
            disabled={guardando}
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// Modal: ABM de categorias
// ============================================================================
function ModalCategorias({ categorias, onCerrar, onCambio }) {
  const [nueva, setNueva] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState(null);

  async function agregar() {
    if (!nueva.trim()) { setErr("Escribí un nombre"); return; }
    setGuardando(true);
    setErr(null);
    try {
      await categoriasApi.crear(nueva.trim());
      setNueva("");
      onCambio();
    } catch (e) {
      setErr(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(c) {
    if (!confirm(`¿Borrar la categoría "${c.nombre}"?`)) return;
    try {
      await categoriasApi.eliminar(c.id_categoria);
      onCambio();
    } catch (e) {
      alert("No se pudo borrar: " + e.message);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>🏷 Categorías de productos</h2>
        {err && <div className="alert-error">⚠ {err}</div>}

        <label>Nueva categoría</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            placeholder="Ej: herramientas"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && agregar()}
          />
          <button className="btn btn-primary" onClick={agregar} disabled={guardando}>
            {guardando ? "…" : "Agregar"}
          </button>
        </div>

        <table className="tabla" style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>NOMBRE</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {categorias.length === 0 && (
              <tr><td colSpan="2" className="vacio">No hay categorías cargadas.</td></tr>
            )}
            {categorias.map((c) => (
              <tr key={c.id_categoria}>
                <td className="cap">{c.nombre}</td>
                <td>
                  <button
                    className="btn-icon btn-del"
                    onClick={() => borrar(c)}
                    title="Borrar"
                  >
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
