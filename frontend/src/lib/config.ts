// Defaults to direct backend URL so the Vite dev-server proxy is bypassed
// for SSE (Vite's http-proxy buffers streaming responses and breaks SSE).
// Set VITE_API_URL in .env for production builds pointing to Railway/etc.
export const API_BASE: string =
  import.meta.env.VITE_API_URL || 'http://localhost:3001';
