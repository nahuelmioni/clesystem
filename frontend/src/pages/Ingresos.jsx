// CleSystem - Pagina Ingresos
// Alcance: visualizacion de ingresos diarios/semanales/mensuales
// + consulta de informacion historica (Project Charter).
// NO incluye balance contra gastos (gastos esta fuera de alcance).

import { useState, useEffect, useCallback } from "react";
import { ingresosApi } from "../api";

function moneda(n) {
  return "$" + Number(n || 0).toLocaleString("es-AR");
}

function fechaHoy() {
  return new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const METODOS = ["efectivo", "transferencia", "cheque", "tarjeta", "seguro"];

export default function Ingresos() {
  const [resumen, setResumen] = useState(null);
  const [ingresos, setIngresos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [metodo, setMetodo] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [res, lista] = await Promise.all([
        ingresosApi.resumen(),
        ingresosApi.listar({ desde, hasta, metodo_pago: metodo }),
      ]);
      setResumen(res);
      setIngresos(lista);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [desde, hasta, metodo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>💲 Ingresos</h1>
          <p className="page-sub">
            Visualizá los ingresos del negocio y consultá el histórico.
          </p>
        </div>
        <div className="head-right">
          <div className="date-chip">📅 {fechaHoy()}</div>
        </div>
      </header>

      {resumen && (
        <div className="cards-row">
          <Card color="green" icon="$" label="INGRESOS DEL DÍA"
            value={moneda(resumen.total_dia)}
            sub={`${resumen.cantidad_trabajos_dia} trabajo(s) hoy`} />
          <Card color="blue" icon="📅" label="INGRESOS DE LA SEMANA"
            value={moneda(resumen.total_semana)}
            sub="Total ingresado esta semana" />
          <Card color="purple" icon="📆" label="INGRESOS DEL MES"
            value={moneda(resumen.total_mes)}
            sub={`${resumen.cantidad_trabajos_mes} trabajo(s) este mes`} />
        </div>
      )}

      <div className="panel">
        <div className="filtros">
          <div className="filtro-fecha">
            <label>Desde</label>
            <input
              type="date"
              className="input"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>
          <div className="filtro-fecha">
            <label>Hasta</label>
            <input
              type="date"
              className="input"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
          <select
            className="input"
            value={metodo}
            onChange={(e) => setMetodo(e.target.value)}
          >
            <option value="">Todos los métodos</option>
            {METODOS.map((m) => (
              <option key={m} value={m}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </option>
            ))}
          </select>
          {(desde || hasta || metodo) && (
            <button
              className="btn btn-ghost"
              onClick={() => {
                setDesde("");
                setHasta("");
                setMetodo("");
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {error && <div className="alert-error">⚠ {error}</div>}
        {cargando ? (
          <div className="loading">Cargando ingresos…</div>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>FECHA</th>
                <th>CLIENTE</th>
                <th>SERVICIO</th>
                <th>MÉTODO DE PAGO</th>
                <th>MONTO</th>
              </tr>
            </thead>
            <tbody>
              {ingresos.length === 0 && (
                <tr>
                  <td colSpan="5" className="vacio">
                    No hay ingresos registrados en este período.
                  </td>
                </tr>
              )}
              {ingresos.map((i) => (
                <tr key={i.id_ingreso}>
                  <td>
                    {new Date(i.fecha_ingreso).toLocaleDateString("es-AR")}
                  </td>
                  <td>{i.cliente || "—"}</td>
                  <td>{i.descripcion_servicio || "—"}</td>
                  <td className="cap">{i.metodo_pago}</td>
                  <td className="monto-pos">{moneda(i.monto_recibido)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Card({ color, icon, label, value, sub }) {
  return (
    <div className="card">
      <div className={`card-icon card-${color}`}>{icon}</div>
      <div>
        <p className="card-label">{label}</p>
        <p className="card-value card-value-money">{value}</p>
        <p className="card-sub">{sub}</p>
      </div>
    </div>
  );
}
