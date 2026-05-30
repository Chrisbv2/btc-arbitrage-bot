const PRICE_FMT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** $67,345.12 */
export function fmtPrice(n: number): string {
  return '$' + PRICE_FMT.format(n);
}

/** 0.07312500 */
export function fmtBtc(n: number): string {
  return n.toFixed(8);
}

/** +0.2453% or -0.1200% */
export function fmtPct(n: number, decimals = 4): string {
  const v = (n * 100).toFixed(decimals);
  return (n >= 0 ? '+' : '') + v + '%';
}

/** +$12.54 or -$3.21 */
export function fmtPnl(n: number): string {
  return (n >= 0 ? '+$' : '-$') + Math.abs(n).toFixed(2);
}

/** 2h 34m 09s / 12m 30s / 45s */
export function fmtUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

/** 2.3s ago / 1m 4s ago */
export function fmtAgo(ts: number): string {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60)   return `${diff.toFixed(1)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${Math.floor(diff % 60)}s ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

/** HH:MM:SS */
export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false });
}
