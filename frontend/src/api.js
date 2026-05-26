// CleSystem - Cliente API
// Centraliza todas las llamadas al backend FastAPI.
// El frontend NUNCA habla directo con Supabase: siempre pasa por el backend.

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(endpoint, options = {}) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Error del servidor" }));
    throw new Error(error.detail || `Error ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ===== AUTH =====
export const authApi = {
  login: (username, password) =>
    request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
};

const AUTH_KEY = "cle_auth";

export const auth = {
  guardar(usuario) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(usuario));
  },
  obtener() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); }
    catch { return null; }
  },
  limpiar() { localStorage.removeItem(AUTH_KEY); },
  estaLogueado() { return !!localStorage.getItem(AUTH_KEY); },
};

// ===== STOCK =====
export const stockApi = {
  resumen: () => request("/api/stock/resumen"),
  listar: (filtros = {}) => {
    const params = new URLSearchParams();
    if (filtros.buscar) params.set("buscar", filtros.buscar);
    if (filtros.categoria) params.set("categoria", filtros.categoria);
    if (filtros.estado) params.set("estado", filtros.estado);
    const qs = params.toString();
    return request(`/api/stock${qs ? `?${qs}` : ""}`);
  },
  crear: (datos) =>
    request("/api/stock", { method: "POST", body: JSON.stringify(datos) }),
  actualizar: (id, datos) =>
    request(`/api/stock/${id}`, { method: "PUT", body: JSON.stringify(datos) }),
  baja: (id) => request(`/api/stock/${id}`, { method: "DELETE" }),
};

// ===== INGRESOS =====
export const ingresosApi = {
  resumen: () => request("/api/ingresos/resumen"),
  listar: (filtros = {}) => {
    const params = new URLSearchParams();
    if (filtros.desde) params.set("desde", filtros.desde);
    if (filtros.hasta) params.set("hasta", filtros.hasta);
    if (filtros.metodo_pago) params.set("metodo_pago", filtros.metodo_pago);
    const qs = params.toString();
    return request(`/api/ingresos${qs ? `?${qs}` : ""}`);
  },
  porDia: (dias = 7) => request(`/api/ingresos/por-dia?dias=${dias}`),
};

// ===== CLIENTES =====
export const clientesApi = {
  listar: (buscar = "") => {
    const qs = buscar ? `?buscar=${encodeURIComponent(buscar)}` : "";
    return request(`/api/clientes${qs}`);
  },
  crear: (datos) =>
    request("/api/clientes", { method: "POST", body: JSON.stringify(datos) }),
  actualizar: (id, datos) =>
    request(`/api/clientes/${id}`, { method: "PUT", body: JSON.stringify(datos) }),
  eliminar: (id) => request(`/api/clientes/${id}`, { method: "DELETE" }),
};

// ===== CATEGORIAS =====
export const categoriasApi = {
  listar: () => request("/api/categorias"),
  crear: (nombre) =>
    request("/api/categorias", { method: "POST", body: JSON.stringify({ nombre }) }),
  eliminar: (id) => request(`/api/categorias/${id}`, { method: "DELETE" }),
};

// ===== TRABAJOS =====
export const trabajosApi = {
  resumen: () => request("/api/trabajos/resumen"),
  listar: (filtros = {}) => {
    const params = new URLSearchParams();
    if (filtros.desde) params.set("desde", filtros.desde);
    if (filtros.hasta) params.set("hasta", filtros.hasta);
    if (filtros.id_cliente) params.set("id_cliente", filtros.id_cliente);
    if (filtros.estado) params.set("estado", filtros.estado);
    const qs = params.toString();
    return request(`/api/trabajos${qs ? `?${qs}` : ""}`);
  },
  obtener: (id) => request(`/api/trabajos/${id}`),
  crear: (datos) =>
    request("/api/trabajos", { method: "POST", body: JSON.stringify(datos) }),
  actualizar: (id, datos) =>
    request(`/api/trabajos/${id}`, { method: "PUT", body: JSON.stringify(datos) }),
  actualizarPago: (id, datos) =>
    request(`/api/trabajos/${id}/pago`, { method: "PUT", body: JSON.stringify(datos) }),
  cancelar: (id) => request(`/api/trabajos/${id}`, { method: "DELETE" }),
};
