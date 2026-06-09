// CleSystem - Cliente API
// Centraliza todas las llamadas al backend FastAPI.
// El frontend NUNCA habla directo con Supabase: siempre pasa por el backend.

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Render free tier duerme el backend tras 15 min de inactividad. El primer
// request al despertarlo puede tardar 30-50 seg y a veces el navegador lo
// corta como "Failed to fetch". Reintentamos varias veces antes de
// rendirnos para tapar ese cold-start de forma transparente al usuario.
const REINTENTOS = 3;
const ESPERA_INICIAL_MS = 1500;

async function fetchConRetry(url, opts, intento = 0) {
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 60000); // 60s max por intento
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(timeout);
    return res;
  } catch (e) {
    // TypeError = "Failed to fetch" o AbortError = timeout: ambos indican
    // que el backend probablemente esta durmiendo. Reintentamos.
    const esRed = e.name === "TypeError" || e.name === "AbortError";
    if (esRed && intento < REINTENTOS) {
      const espera = ESPERA_INICIAL_MS * Math.pow(2, intento);
      await new Promise((r) => setTimeout(r, espera));
      return fetchConRetry(url, opts, intento + 1);
    }
    throw e;
  }
}

async function request(endpoint, options = {}) {
  let res;
  try {
    res = await fetchConRetry(`${API_URL}${endpoint}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch (e) {
    // Ya agotamos los reintentos: damos un mensaje mas claro
    if (e.name === "TypeError" || e.name === "AbortError") {
      throw new Error(
        "No se pudo conectar con el servidor. " +
        "Si es la primera consulta del día puede tardar hasta un minuto en despertarse — probá de nuevo."
      );
    }
    throw e;
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Error del servidor" }));
    throw new Error(error.detail || `Error ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Ping silencioso al backend para "despertarlo" sin esperar al primer
// request real. Se llama desde el login.
export function despertarBackend() {
  fetch(`${API_URL}/api/health`).catch(() => {});
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
