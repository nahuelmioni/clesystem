// CleSystem - App principal con ruteo + gate de login

import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Inicio from "./pages/Inicio";
import Stock from "./pages/Stock";
import Ingresos from "./pages/Ingresos";
import Trabajos from "./pages/Trabajos";
import Clientes from "./pages/Clientes";
import Login from "./pages/Login";
import { auth } from "./api";
import "./styles.css";

export default function App() {
  const [usuario, setUsuario] = useState(() => auth.obtener());

  function cerrarSesion() {
    auth.limpiar();
    setUsuario(null);
  }

  if (!usuario) {
    return <Login onLogin={setUsuario} />;
  }

  return (
    <BrowserRouter>
      <div className="layout">
        <Sidebar usuario={usuario} onCerrarSesion={cerrarSesion} />
        <main className="contenido">
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/ingresos" element={<Ingresos />} />
            <Route path="/trabajos" element={<Trabajos />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
