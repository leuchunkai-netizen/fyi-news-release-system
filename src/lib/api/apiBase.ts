/**
 * Build absolute API URL. Default: relative paths (e.g. `/api/...`) so Vite dev proxy can forward to the backend.
 * If the proxy returns 404, set `VITE_API_URL=http://localhost:10000` in `.env` and ensure the backend enables CORS.
 */
export function apiUrl(path: string): string {
  const raw = import.meta.env.VITE_API_URL;
  const base = typeof raw === "string" ? raw.replace(/\/$/, "") : "";
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}
