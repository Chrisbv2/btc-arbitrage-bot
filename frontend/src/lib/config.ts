export const API_BASE: string =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD
    ? 'https://arb-botbackend-production-9e8e.up.railway.app'
    : 'http://localhost:3001');
