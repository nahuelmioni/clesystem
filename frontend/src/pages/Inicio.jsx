// CleSystem - Pagina Inicio (dashboard)
// Resumen general dentro del alcance: ingresos + estado de stock.
// NO incluye "ganancia neta real" ni "balance final" porque dependen
// del modulo de gastos, que esta fuera del alcance aprobado.

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ingresosApi, stockApi } from "../api";

function moneda(n) {
  return "$" + Number(n || 0).toLocaleString("es-AR");
}

export default function Inicio() {
  const [ing, setIng] = useState(null);
  const [stk, setStk] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([ingresosApi.resumen(), stockApi.resumen()])
      .then(([i, s]) => {
        setIng(i);
        setStk(s);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Hola, La Cle 👋</h1>
          <p className="page-sub">Este es el resumen general de tu negocio.</p>
        </div>
      </header>

      {error && <div className="alert-error">⚠ {error}</div>}

      {ing && (
        <div className="cards-row">
          <Card color="green" icon="$" label="INGRESOS DEL DÍA"
            value={moneda(ing.total_dia)} sub="Total ingresado hoy" />
          <Card color="blue" icon="📅" label="INGRESOS DE LA SEMANA"
            value={moneda(ing.total_semana)} sub="Total esta semana" />
          <Card color="purple" icon="📆" label="INGRESOS DEL MES"
            value={moneda(ing.total_mes)} sub="Total este mes" />
        </div>
      )}

      {stk && (
        <div className="panel">
          <div className="panel-head">
            <h2>📦 Estado del stock</h2>
            <Link to="/stock" className="link-ver">
              Ver stock completo →
            </Link>
          </div>
          <div className="mini-stats">
            <div className="mini-stat">
              <span className="mini-num">{stk.total_productos}</span>
              <span className="mini-lbl">Productos</span>
            </div>
            <div className="mini-stat ok">
              <span className="mini-num">{stk.en_stock}</span>
              <span className="mini-lbl">En stock</span>
            </div>
            <div className="mini-stat warn">
              <span className="mini-num">{stk.stock_bajo}</span>
              <span className="mini-lbl">Stock bajo</span>
            </div>
            <div className="mini-stat danger">
              <span className="mini-num">{stk.sin_stock}</span>
              <span className="mini-lbl">Sin stock</span>
            </div>
          </div>
          {(stk.stock_bajo > 0 || stk.sin_stock > 0) && (
            <div className="alerta-stock">
              ⚠ {stk.sin_stock} sin stock y {stk.stock_bajo} con stock bajo.{" "}
              <Link to="/stock">Revisar ahora →</Link>
            </div>
          )}
        </div>
      )}

      <div className="panel">
        <h2>Accesos rápidos</h2>
        <div className="accesos">
          <Link to="/stock" className="acceso">
            📦 <span>Control de Stock</span>
          </Link>
          <Link to="/ingresos" className="acceso">
            💲 <span>Ver Ingresos</span>
          </Link>
          <div className="acceso acceso-disabled" title="Próximamente">
            📝 <span>Registrar Trabajo (pronto)</span>
          </div>
        </div>
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
