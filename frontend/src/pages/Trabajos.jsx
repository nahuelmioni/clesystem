// CleSystem - Pagina de Registro de Trabajos
// Alcance (Project Charter): registro digital de trabajos (fecha,
// servicio/producto, importe). Descuenta stock automaticamente y
// genera el ingreso asociado.

import { useState, useEffect, useCallback, useMemo } from "react";
import { trabajosApi, clientesApi, stockApi } from "../api";
import { ModalCliente } from "./Clientes";

const ESTADOS = [
  { v: "pendiente",  txt: "Pendiente",   cls: "badge-warn" },
  { v: "en_proceso", txt: "En proceso",  cls: "badge-warn" },
  { v: "finalizado", txt: "Finalizado",  cls: "badge-ok" },
  { v: "entregado",  txt: "Entregado",   cls: "badge-ok" },
  { v: "cancelado",  txt: "Cancelado",   cls: "badge-danger" },
];
const ESTADOS_PAGO = [
  { v: "no_pagado", txt: "No pagado", cls: "badge-danger" },
  { v: "sena",      txt: "Seña",      cls: "badge-warn" },
  { v: "pagado",    txt: "Pagado",    cls: "badge-ok" },
];
const METODOS = ["efectivo", "transferencia", "cheque", "tarjeta", "seguro"];

function fechaHoy() {
  return new Date().toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function plata(n) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS", maximumFractionDigits: 0,
  }).format(n || 0);
}

export default function Trabajos() {
  const [resumen, setResumen] = useState(null);
  const [trabajos, setTrabajos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  const [modalAbierto, setModalAbierto] = useState(false);
  const [verTrabajo, setVerTrabajo] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [res, lista] = await Promise.all([
        trabajosApi.resumen(),
        trabajosApi.listar({
          estado: filtroEstado,
          desde: filtroDesde || undefined,
          hasta: filtroHasta || undefined,
        }),
      ]);
      setResumen(res);
      setTrabajos(lista);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [filtroEstado, filtroDesde, filtroHasta]);

  useEffect(() => {
    const t = setTimeout(cargar, 200);
    return () => clearTimeout(t);
  }, [cargar]);

  async function cancelar(id) {
    if (!confirm("¿Cancelar este trabajo? Se devolverán los productos al stock."))
      return;
    try {
      await trabajosApi.cancelar(id);
      cargar();
    } catch (e) {
      alert("Error: " + e.message);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>📝 Registro de Trabajos</h1>
          <p className="page-sub">Cargá los trabajos realizados y el cobro asociado.</p>
        </div>
        <div className="head-right">
          <div className="date-chip">📅 {fechaHoy()}</div>
          <button className="btn btn-primary" onClick={() => setModalAbierto(true)}>
            + Registrar nuevo trabajo
          </button>
        </div>
      </header>

      {resumen && (
        <div className="cards-row">
          <Card color="blue" icon="📝" label="HOY"
            value={resumen.total_dia} sub="Trabajos del día" />
          <Card color="green" icon="📅" label="ESTA SEMANA"
            value={resumen.total_semana} sub="Trabajos de la semana" />
          <Card color="purple" icon="📆" label="ESTE MES"
            value={resumen.total_mes} sub="Trabajos del mes" />
          <Card color="amber" icon="⏳" label="PENDIENTES"
            value={resumen.pendientes} sub="Sin entregar" />
        </div>
      )}

      <div className="panel">
        <div className="filtros">
          <select className="input" value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {ESTADOS.map((e) => <option key={e.v} value={e.v}>{e.txt}</option>)}
          </select>
          <input type="date" className="input" value={filtroDesde}
            onChange={(e) => setFiltroDesde(e.target.value)} />
          <input type="date" className="input" value={filtroHasta}
            onChange={(e) => setFiltroHasta(e.target.value)} />
        </div>

        {error && <div className="alert-error">⚠ {error}</div>}
        {cargando ? (
          <div className="loading">Cargando trabajos…</div>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>FECHA</th>
                <th>CLIENTE</th>
                <th>VEHÍCULO</th>
                <th>SERVICIO</th>
                <th>TOTAL</th>
                <th>ESTADO</th>
                <th>PAGO</th>
                <th>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {trabajos.length === 0 && (
                <tr><td colSpan="8" className="vacio">No hay trabajos para los filtros aplicados.</td></tr>
              )}
              {trabajos.map((t) => {
                const est = ESTADOS.find((e) => e.v === t.estado) || ESTADOS[0];
                const pag = ESTADOS_PAGO.find((p) => p.v === t.estado_pago) || ESTADOS_PAGO[0];
                return (
                  <tr key={t.id_trabajo}>
                    <td>{t.fecha_trabajo}</td>
                    <td>{t.cliente || "—"}</td>
                    <td>
                      {t.modelo_vehiculo || "—"}
                      {t.patente_vehiculo && (
                        <div style={{ fontSize: 12, color: "#64748b" }}>{t.patente_vehiculo}</div>
                      )}
                    </td>
                    <td>{t.descripcion_servicio || "—"}</td>
                    <td className="monto-pos">{plata(t.monto_recibido || t.costo_total)}</td>
                    <td><span className={`badge ${est.cls}`}>{est.txt.toUpperCase()}</span></td>
                    <td><span className={`badge ${pag.cls}`}>{pag.txt.toUpperCase()}</span></td>
                    <td>
                      <button className="btn-icon btn-edit" title="Ver detalle"
                        onClick={() => setVerTrabajo(t.id_trabajo)}>
                        👁
                      </button>
                      {t.estado !== "cancelado" && (
                        <button className="btn-icon btn-del" title="Cancelar"
                          onClick={() => cancelar(t.id_trabajo)}>
                          🗑
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalAbierto && (
        <ModalTrabajo
          onCerrar={() => setModalAbierto(false)}
          onGuardado={() => { setModalAbierto(false); cargar(); }}
        />
      )}

      {verTrabajo && (
        <ModalDetalleTrabajo
          id={verTrabajo}
          onCerrar={() => setVerTrabajo(null)}
          onCambio={() => { setVerTrabajo(null); cargar(); }}
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


// ============================================================================
// Modal: ALTA de trabajo
// ============================================================================
function ModalTrabajo({ onCerrar, onGuardado }) {
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [nuevoClienteAbierto, setNuevoClienteAbierto] = useState(false);

  const [form, setForm] = useState({
    id_cliente: "",
    fecha_trabajo: new Date().toISOString().slice(0, 10),
    patente_vehiculo: "",
    modelo_vehiculo: "",
    descripcion_servicio: "",
    tipo_servicio: "servicio",
    estado: "finalizado",
    mano_obra: 0,
    metodo_pago: "efectivo",
    monto_recibido: 0,
    estado_pago: "pagado",  // default: pago total al cargar el trabajo
  });
  const [items, setItems] = useState([
    { id_producto: "", cantidad: 1, precio_unitario: 0 },
  ]);
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [cs, ps] = await Promise.all([
          clientesApi.listar(),
          stockApi.listar(),
        ]);
        setClientes(cs);
        setProductos(ps);
      } catch (e) {
        setErr(e.message);
      }
    })();
  }, []);

  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function setItem(i, campo, valor) {
    setItems((arr) => arr.map((it, idx) => idx === i ? { ...it, [campo]: valor } : it));
  }

  function agregarItem() {
    setItems((arr) => [...arr, { id_producto: "", cantidad: 1, precio_unitario: 0 }]);
  }
  function quitarItem(i) {
    setItems((arr) => arr.filter((_, idx) => idx !== i));
  }

  // Cuando se elige un producto, pre-cargar precio_venta
  function elegirProducto(i, idProd) {
    const p = productos.find((x) => x.id_producto === Number(idProd));
    setItems((arr) => arr.map((it, idx) =>
      idx === i ? { ...it, id_producto: idProd, precio_unitario: p?.precio_venta || 0 } : it
    ));
  }

  const subtotalProductos = useMemo(() => items.reduce(
    (acc, it) => acc + (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0),
    0,
  ), [items]);
  const total = subtotalProductos + Number(form.mano_obra || 0);

  // El monto recibido depende del estado_pago elegido:
  //   pagado    -> total
  //   no_pagado -> 0
  //   sena      -> lo que escriba el usuario (no se sobreescribe)
  useEffect(() => {
    if (form.estado_pago === "pagado") {
      setForm((f) => ({ ...f, monto_recibido: total }));
    } else if (form.estado_pago === "no_pagado") {
      setForm((f) => ({ ...f, monto_recibido: 0 }));
    }
  }, [total, form.estado_pago]);

  function validarStock() {
    for (const it of items) {
      if (!it.id_producto) continue;
      const p = productos.find((x) => x.id_producto === Number(it.id_producto));
      if (!p) continue;
      if (Number(it.cantidad) > p.cantidad_actual) {
        return `Stock insuficiente para "${p.nombre_producto}": hay ${p.cantidad_actual} y se piden ${it.cantidad}.`;
      }
    }
    return null;
  }

  async function guardar() {
    if (!form.id_cliente) { setErr("Elegí un cliente"); return; }
    const itemsValidos = items.filter((it) => it.id_producto && Number(it.cantidad) > 0);
    const stockErr = validarStock();
    if (stockErr) { setErr(stockErr); return; }

    setGuardando(true);
    setErr(null);
    try {
      await trabajosApi.crear({
        id_cliente: Number(form.id_cliente),
        fecha_trabajo: form.fecha_trabajo,
        patente_vehiculo: form.patente_vehiculo || null,
        modelo_vehiculo: form.modelo_vehiculo || null,
        descripcion_servicio: form.descripcion_servicio || null,
        tipo_servicio: form.tipo_servicio,
        estado: form.estado,
        mano_obra: Number(form.mano_obra) || 0,
        metodo_pago: form.metodo_pago,
        monto_recibido: Number(form.monto_recibido) || 0,
        estado_pago: form.estado_pago,
        productos: itemsValidos.map((it) => ({
          id_producto: Number(it.id_producto),
          cantidad: Number(it.cantidad),
          precio_unitario: Number(it.precio_unitario),
        })),
      });
      onGuardado();
    } catch (e) {
      setErr(e.message);
      setGuardando(false);
    }
  }

  return (
    <>
      <div className="modal-overlay" onClick={onCerrar}>
        <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
          <h2>Nuevo trabajo</h2>
          {err && <div className="alert-error">⚠ {err}</div>}

          <div className="grid-2">
            <div>
              <label>Cliente</label>
              <div style={{ display: "flex", gap: 8 }}>
                <select className="input" value={form.id_cliente}
                  onChange={(e) => set("id_cliente", e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  {clientes.map((c) => (
                    <option key={c.id_cliente} value={c.id_cliente}>
                      {c.nombre} {c.apellido || ""}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn-ghost"
                  onClick={() => setNuevoClienteAbierto(true)}>+ Nuevo</button>
              </div>
            </div>
            <div>
              <label>Fecha</label>
              <input type="date" className="input" value={form.fecha_trabajo}
                onChange={(e) => set("fecha_trabajo", e.target.value)} />
            </div>
          </div>

          <div className="grid-2">
            <div>
              <label>Modelo del vehículo</label>
              <input className="input" placeholder="Ej: Peugeot 208"
                value={form.modelo_vehiculo}
                onChange={(e) => set("modelo_vehiculo", e.target.value)} />
            </div>
            <div>
              <label>Patente</label>
              <input className="input" value={form.patente_vehiculo}
                onChange={(e) => set("patente_vehiculo", e.target.value.toUpperCase())} />
            </div>
          </div>

          <label>Descripción del servicio</label>
          <input className="input" placeholder="Ej: Cambio de parabrisas"
            value={form.descripcion_servicio}
            onChange={(e) => set("descripcion_servicio", e.target.value)} />

          <div className="grid-2">
            <div>
              <label>Tipo</label>
              <select className="input" value={form.tipo_servicio}
                onChange={(e) => set("tipo_servicio", e.target.value)}>
                <option value="servicio">Servicio</option>
                <option value="venta">Venta</option>
              </select>
            </div>
            <div>
              <label>Estado</label>
              <select className="input" value={form.estado}
                onChange={(e) => set("estado", e.target.value)}>
                {ESTADOS.filter((e) => e.v !== "cancelado").map((e) =>
                  <option key={e.v} value={e.v}>{e.txt}</option>
                )}
              </select>
            </div>
          </div>

          <h3 style={{ marginTop: 20, fontSize: 15, fontWeight: 600 }}>
            Productos usados
          </h3>
          <table className="tabla" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>PRODUCTO</th>
                <th style={{ width: 90 }}>CANT.</th>
                <th style={{ width: 140 }}>PRECIO UNIT.</th>
                <th style={{ width: 140 }}>SUBTOTAL</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const p = productos.find((x) => x.id_producto === Number(it.id_producto));
                const sinStock = p && Number(it.cantidad) > p.cantidad_actual;
                return (
                  <tr key={i}>
                    <td>
                      <select className="input" value={it.id_producto}
                        onChange={(e) => elegirProducto(i, e.target.value)}>
                        <option value="">— Elegir —</option>
                        {productos.map((p) => (
                          <option key={p.id_producto} value={p.id_producto}
                            disabled={p.cantidad_actual <= 0}>
                            {p.nombre_producto} (stock: {p.cantidad_actual})
                          </option>
                        ))}
                      </select>
                      {sinStock && (
                        <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 4 }}>
                          ⚠ Sin stock suficiente. Pedir reposición.
                        </div>
                      )}
                    </td>
                    <td>
                      <input type="number" min="1" className="input"
                        value={it.cantidad}
                        onChange={(e) => setItem(i, "cantidad", e.target.value)} />
                    </td>
                    <td>
                      <input type="number" min="0" className="input"
                        value={it.precio_unitario}
                        onChange={(e) => setItem(i, "precio_unitario", e.target.value)} />
                    </td>
                    <td>{plata((Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0))}</td>
                    <td>
                      <button className="btn-icon btn-del" title="Quitar"
                        onClick={() => quitarItem(i)}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button type="button" className="btn btn-ghost" onClick={agregarItem}
            style={{ marginTop: 8 }}>+ Agregar producto</button>

          <div className="grid-2" style={{ marginTop: 20 }}>
            <div>
              <label>Mano de obra</label>
              <input type="number" min="0" className="input" value={form.mano_obra}
                onChange={(e) => set("mano_obra", e.target.value)} />
            </div>
            <div>
              <label>Método de pago</label>
              <select className="input" value={form.metodo_pago}
                onChange={(e) => set("metodo_pago", e.target.value)}>
                {METODOS.map((m) =>
                  <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                )}
              </select>
            </div>
          </div>

          <div className="resumen-trabajo">
            <div><span>Subtotal productos:</span> <strong>{plata(subtotalProductos)}</strong></div>
            <div><span>Mano de obra:</span> <strong>{plata(form.mano_obra)}</strong></div>
            <div className="resumen-total"><span>TOTAL:</span> <strong>{plata(total)}</strong></div>
          </div>

          <label style={{ marginTop: 16 }}>¿Cómo paga el cliente?</label>
          <div className="radio-group">
            {ESTADOS_PAGO.map((op) => (
              <label key={op.v} className={`radio-card ${form.estado_pago === op.v ? "radio-card-active" : ""}`}>
                <input type="radio" name="estado_pago" value={op.v}
                  checked={form.estado_pago === op.v}
                  onChange={(e) => set("estado_pago", e.target.value)} />
                <span>{op.txt}</span>
              </label>
            ))}
          </div>

          {form.estado_pago === "sena" && (
            <div>
              <label>Monto de la seña</label>
              <input type="number" min="0" max={total} className="input"
                value={form.monto_recibido}
                onChange={(e) => set("monto_recibido", e.target.value)} />
              <small style={{ color: "#64748b", fontSize: 12 }}>
                Queda pendiente: {plata(total - Number(form.monto_recibido || 0))}
              </small>
            </div>
          )}

          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={onCerrar}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando…" : "Registrar trabajo"}
            </button>
          </div>
        </div>
      </div>

      {nuevoClienteAbierto && (
        <ModalCliente
          cliente={null}
          onCerrar={() => setNuevoClienteAbierto(false)}
          onGuardado={async () => {
            setNuevoClienteAbierto(false);
            const cs = await clientesApi.listar();
            setClientes(cs);
            // Seleccionar el ultimo creado (el de mayor id)
            if (cs.length) {
              const ultimo = cs.reduce((a, b) => (a.id_cliente > b.id_cliente ? a : b));
              set("id_cliente", String(ultimo.id_cliente));
            }
          }}
        />
      )}
    </>
  );
}


// ============================================================================
// Modal: VER detalle de trabajo
// ============================================================================
function ModalDetalleTrabajo({ id, onCerrar, onCambio }) {
  const [trabajo, setTrabajo] = useState(null);
  const [err, setErr] = useState(null);
  const [pagoAbierto, setPagoAbierto] = useState(false);

  async function recargar() {
    try { setTrabajo(await trabajosApi.obtener(id)); }
    catch (e) { setErr(e.message); }
  }

  useEffect(() => { recargar(); }, [id]);

  async function cambiarEstado(nuevo) {
    try {
      await trabajosApi.actualizar(id, { estado: nuevo });
      onCambio();
    } catch (e) {
      alert("Error: " + e.message);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <h2>Trabajo #{id}</h2>
        {err && <div className="alert-error">⚠ {err}</div>}
        {!trabajo ? (
          <div className="loading">Cargando…</div>
        ) : (
          <>
            <div className="grid-2">
              <div><label>Cliente</label><p>{trabajo.cliente || "—"}</p></div>
              <div><label>Fecha</label><p>{trabajo.fecha_trabajo}</p></div>
            </div>
            <div className="grid-2">
              <div><label>Vehículo</label><p>{trabajo.modelo_vehiculo || "—"}</p></div>
              <div><label>Patente</label><p>{trabajo.patente_vehiculo || "—"}</p></div>
            </div>
            <label>Descripción</label>
            <p>{trabajo.descripcion_servicio || "—"}</p>

            <h3 style={{ marginTop: 16, fontSize: 15, fontWeight: 600 }}>Productos</h3>
            <table className="tabla">
              <thead>
                <tr><th>PRODUCTO</th><th>CANT.</th><th>PRECIO</th><th>SUBTOTAL</th></tr>
              </thead>
              <tbody>
                {(trabajo.productos || []).length === 0 && (
                  <tr><td colSpan="4" className="vacio">Sin productos.</td></tr>
                )}
                {(trabajo.productos || []).map((p) => (
                  <tr key={p.id_detalle}>
                    <td>{p.nombre_producto}</td>
                    <td>{p.cantidad_usada}</td>
                    <td>{plata(p.precio_unitario)}</td>
                    <td>{plata(p.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="resumen-trabajo">
              <div><span>Mano de obra:</span> <strong>{plata(trabajo.mano_obra)}</strong></div>
              <div><span>Costo total:</span> <strong>{plata(trabajo.costo_total)}</strong></div>
              <div>
                <span>Pago ({trabajo.metodo_pago || "—"}):</span>
                <strong>
                  <span className={`badge ${(ESTADOS_PAGO.find(p=>p.v===trabajo.estado_pago)||{}).cls || ""}`}>
                    {(ESTADOS_PAGO.find(p=>p.v===trabajo.estado_pago)||{}).txt?.toUpperCase() || "—"}
                  </span>
                </strong>
              </div>
              <div className="resumen-total">
                <span>Cobrado:</span>
                <strong>{plata(trabajo.monto_recibido)}</strong>
              </div>
              {trabajo.estado_pago === "sena" && (
                <div>
                  <span>Pendiente:</span>
                  <strong style={{ color: "#b45309" }}>
                    {plata((trabajo.costo_total || 0) - (trabajo.monto_recibido || 0))}
                  </strong>
                </div>
              )}
            </div>

            {trabajo.estado !== "cancelado" && (
              <div style={{ marginTop: 12, textAlign: "right" }}>
                <button className="btn btn-ghost" onClick={() => setPagoAbierto(true)}>
                  💲 Cambiar estado de pago
                </button>
              </div>
            )}

            <div className="grid-2" style={{ marginTop: 16 }}>
              <div>
                <label>Estado del trabajo</label>
                <p><span className={`badge ${(ESTADOS.find(e=>e.v===trabajo.estado)||{}).cls || ""}`}>
                  {trabajo.estado.toUpperCase()}
                </span></p>
              </div>
              {trabajo.estado !== "cancelado" && trabajo.estado !== "entregado" && (
                <div>
                  <label>Cambiar a</label>
                  <select className="input" defaultValue=""
                    onChange={(e) => e.target.value && cambiarEstado(e.target.value)}>
                    <option value="">— Elegir —</option>
                    {ESTADOS.filter((e) => e.v !== "cancelado" && e.v !== trabajo.estado).map((e) =>
                      <option key={e.v} value={e.v}>{e.txt}</option>
                    )}
                  </select>
                </div>
              )}
            </div>
          </>
        )}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>

      {pagoAbierto && trabajo && (
        <ModalCambioPago
          trabajo={trabajo}
          onCerrar={() => setPagoAbierto(false)}
          onGuardado={() => { setPagoAbierto(false); recargar(); onCambio?.(); }}
        />
      )}
    </div>
  );
}


// ============================================================================
// Modal: CAMBIAR estado de pago de un trabajo existente
// ============================================================================
function ModalCambioPago({ trabajo, onCerrar, onGuardado }) {
  const total = Number(trabajo.costo_total) || 0;
  const [estado, setEstado] = useState(trabajo.estado_pago || "pagado");
  const [monto, setMonto] = useState(Number(trabajo.monto_recibido) || 0);
  const [metodo, setMetodo] = useState(trabajo.metodo_pago || "efectivo");
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (estado === "pagado") setMonto(total);
    else if (estado === "no_pagado") setMonto(0);
  }, [estado, total]);

  async function guardar() {
    if (estado === "sena" && (monto <= 0 || monto >= total)) {
      setErr(`La seña tiene que estar entre 0 y ${total}`);
      return;
    }
    setGuardando(true);
    setErr(null);
    try {
      await trabajosApi.actualizarPago(trabajo.id_trabajo, {
        estado_pago: estado,
        monto_recibido: Number(monto) || 0,
        metodo_pago: metodo,
      });
      onGuardado();
    } catch (e) {
      setErr(e.message);
      setGuardando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Cambiar estado de pago</h2>
        {err && <div className="alert-error">⚠ {err}</div>}

        <p style={{ color: "#64748b", fontSize: 14, marginBottom: 12 }}>
          Total del trabajo: <strong>{plata(total)}</strong>
        </p>

        <label>Estado de pago</label>
        <div className="radio-group">
          {ESTADOS_PAGO.map((op) => (
            <label key={op.v} className={`radio-card ${estado === op.v ? "radio-card-active" : ""}`}>
              <input type="radio" name="ep" value={op.v}
                checked={estado === op.v}
                onChange={(e) => setEstado(e.target.value)} />
              <span>{op.txt}</span>
            </label>
          ))}
        </div>

        {estado === "sena" && (
          <div>
            <label>Monto de la seña</label>
            <input type="number" min="0" max={total} className="input"
              value={monto} onChange={(e) => setMonto(e.target.value)} />
            <small style={{ color: "#64748b", fontSize: 12 }}>
              Pendiente: {plata(total - Number(monto || 0))}
            </small>
          </div>
        )}

        {estado !== "no_pagado" && (
          <>
            <label>Método de pago</label>
            <select className="input" value={metodo}
              onChange={(e) => setMetodo(e.target.value)}>
              {METODOS.map((m) =>
                <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
              )}
            </select>
          </>
        )}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
