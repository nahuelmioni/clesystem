// CleSystem - Barra lateral de navegacion

import { NavLink } from "react-router-dom";

const items = [
  { to: "/", icon: "🏠", label: "Inicio" },
  { to: "/stock", icon: "📦", label: "Control de Stock" },
  { to: "/ingresos", icon: "💲", label: "Ingresos" },
  { to: "/trabajos", icon: "📝", label: "Registrar Trabajo" },
  { to: "/clientes", icon: "👥", label: "Clientes" },
];

export default function Sidebar({ usuario, onCerrarSesion }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-logo">
          <span className="brand-cle">CLE</span>
          <span className="brand-system">SYSTEM</span>
        </div>
        <p className="brand-sub">Parabrisas La Cle</p>
      </div>

      <nav className="sidebar-nav">
        {items.map((item) =>
          item.disabled ? (
            <div
              key={item.to}
              className="nav-item nav-item-disabled"
              title="Disponible en una proxima version"
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              <span className="nav-badge">Pronto</span>
            </div>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `nav-item ${isActive ? "nav-item-active" : ""}`
              }
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          )
        )}
      </nav>

      <div className="sidebar-footer">
        {usuario && (
          <div className="sidebar-user">
            <span className="sidebar-user-avatar">👤</span>
            <div>
              <div className="sidebar-user-name">{usuario.nombre}</div>
              <div className="sidebar-user-rol">{usuario.rol}</div>
            </div>
          </div>
        )}
        <button
          type="button"
          className="nav-item nav-logout"
          onClick={onCerrarSesion}
        >
          <span className="nav-icon">↪</span>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
