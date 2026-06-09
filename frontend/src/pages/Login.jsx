// CleSystem - Pantalla de Login
// Sistema mono-usuario, login simple (proyecto academico).

import { useState, useEffect } from "react";
import { authApi, auth, despertarBackend } from "../api";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [err, setErr] = useState(null);

  // Apenas se carga la pantalla, hacemos un ping al backend para que se
  // despierte mientras el usuario tipea. Asi, cuando hace login, el back
  // ya esta listo en vez de hacer cold-start en ese momento.
  useEffect(() => { despertarBackend(); }, []);

  async function entrar(e) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErr("Ingresá usuario y contraseña");
      return;
    }
    setCargando(true);
    setErr(null);
    try {
      const usuario = await authApi.login(username.trim(), password);
      auth.guardar(usuario);
      onLogin(usuario);
    } catch (e) {
      setErr(e.message);
      setCargando(false);
    }
  }

  return (
    <div className="login-bg">
      <form className="login-card" onSubmit={entrar}>
        <div className="login-brand">
          <span className="brand-cle">CLE</span>
          <span className="brand-system">SYSTEM</span>
        </div>
        <p className="login-sub">Parabrisas La Cle</p>

        <h2 className="login-title">Iniciar sesión</h2>

        {err && <div className="alert-error">⚠ {err}</div>}

        <label>Usuario</label>
        <input
          className="input"
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="admin"
        />

        <label>Contraseña</label>
        <input
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />

        <button type="submit" className="btn btn-primary login-btn" disabled={cargando}>
          {cargando ? "Ingresando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
