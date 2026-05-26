// CleSystem - Pagina de Clientes
// CRUD basico. La pantalla de Trabajos tambien puede dar de alta clientes
// inline, pero esta pagina permite gestionarlos sueltos.

import { useState, useEffect, useCallback } from "react";
import { clientesApi } from "../api";

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [buscar, setBuscar] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setClientes(await clientesApi.listar(buscar));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [buscar]);

  async function borrar(c) {
    const nombre = `${c.nombre} ${c.apellido || ""}`.trim();
    if (!confirm(`¿Borrar al cliente "${nombre}"? Esta acción no se puede deshacer.`))
      return;
    try {
      await clientesApi.eliminar(c.id_cliente);
      cargar();
    } catch (e) {
      alert("No se pudo borrar: " + e.message);
    }
  }

  useEffect(() => {
    const t = setTimeout(cargar, 300);
    return () => clearTimeout(t);
  }, [cargar]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>👥 Clientes</h1>
          <p className="page-sub">Administrá los clientes (particulares y asegurados).</p>
        </div>
        <div className="head-right">
          <button
            className="btn btn-primary"
            onClick={() => { setEditando(null); setModalAbierto(true); }}
          >
            + Nuevo cliente
          </button>
        </div>
      </header>

      <div className="panel">
        <div className="filtros">
          <input
            className="input"
            placeholder="Buscar por nombre o apellido..."
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
        </div>

        {error && <div className="alert-error">⚠ {error}</div>}
        {cargando ? (
          <div className="loading">Cargando clientes…</div>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>NOMBRE</th>
                <th>TELÉFONO</th>
                <th>EMAIL</th>
                <th>TIPO</th>
                <th>SEGURO</th>
                <th>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {clientes.length === 0 && (
                <tr><td colSpan="6" className="vacio">No hay clientes cargados.</td></tr>
              )}
              {clientes.map((c) => (
                <tr key={c.id_cliente}>
                  <td>{c.nombre} {c.apellido || ""}</td>
                  <td>{c.telefono || "—"}</td>
                  <td>{c.email || "—"}</td>
                  <td>
                    <span className={`badge ${c.es_asegurado ? "badge-warn" : "badge-ok"}`}>
                      {c.es_asegurado ? "ASEGURADO" : "PARTICULAR"}
                    </span>
                  </td>
                  <td>{c.compania_seguro || "—"}</td>
                  <td>
                    <button
                      className="btn-icon btn-edit"
                      onClick={() => { setEditando(c); setModalAbierto(true); }}
                      title="Editar"
                    >
                      ✎
                    </button>
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
        )}
      </div>

      {modalAbierto && (
        <ModalCliente
          cliente={editando}
          onCerrar={() => setModalAbierto(false)}
          onGuardado={() => { setModalAbierto(false); cargar(); }}
        />
      )}
    </div>
  );
}

export function ModalCliente({ cliente, onCerrar, onGuardado }) {
  const esEdicion = !!cliente;
  const [form, setForm] = useState({
    nombre: cliente?.nombre || "",
    apellido: cliente?.apellido || "",
    telefono: cliente?.telefono || "",
    email: cliente?.email || "",
    direccion: cliente?.direccion || "",
    es_asegurado: cliente?.es_asegurado || false,
    compania_seguro: cliente?.compania_seguro || "",
    nro_siniestro: cliente?.nro_siniestro || "",
  });
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState(null);

  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function guardar() {
    if (!form.nombre.trim()) {
      setErr("El nombre es obligatorio");
      return;
    }
    setGuardando(true);
    setErr(null);
    try {
      if (esEdicion) {
        await clientesApi.actualizar(cliente.id_cliente, form);
      } else {
        await clientesApi.crear(form);
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
        <h2>{esEdicion ? "Editar cliente" : "Nuevo cliente"}</h2>
        {err && <div className="alert-error">⚠ {err}</div>}

        <div className="grid-2">
          <div>
            <label>Nombre</label>
            <input className="input" value={form.nombre}
              onChange={(e) => set("nombre", e.target.value)} />
          </div>
          <div>
            <label>Apellido</label>
            <input className="input" value={form.apellido}
              onChange={(e) => set("apellido", e.target.value)} />
          </div>
        </div>

        <div className="grid-2">
          <div>
            <label>Teléfono</label>
            <input className="input" value={form.telefono}
              onChange={(e) => set("telefono", e.target.value)} />
          </div>
          <div>
            <label>Email</label>
            <input className="input" value={form.email}
              onChange={(e) => set("email", e.target.value)} />
          </div>
        </div>

        <label>Dirección</label>
        <input className="input" value={form.direccion}
          onChange={(e) => set("direccion", e.target.value)} />

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
          <input type="checkbox" checked={form.es_asegurado}
            onChange={(e) => set("es_asegurado", e.target.checked)} />
          Es asegurado (cliente con seguro)
        </label>

        {form.es_asegurado && (
          <div className="grid-2">
            <div>
              <label>Compañía de seguro</label>
              <input className="input" value={form.compania_seguro}
                onChange={(e) => set("compania_seguro", e.target.value)} />
            </div>
            <div>
              <label>Nro. de siniestro</label>
              <input className="input" value={form.nro_siniestro}
                onChange={(e) => set("nro_siniestro", e.target.value)} />
            </div>
          </div>
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
