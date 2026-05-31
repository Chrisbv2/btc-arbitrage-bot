import { useMemo } from 'react';
import { fmtPrice, fmtPct } from '../lib/format';
import type { PriceSummary } from '../hooks/useArbitrageData';

// Fee constants — mirror backend
const FEES: Record<string, number> = { binance: 0.001, kraken: 0.0026 };
const SLIPPAGE = 0.0005;
// MIN_NET is computed inside the component from the demoMode prop

interface Props {
  prices: Record<string, PriceSummary>;
  demoMode: boolean;
}

interface SpreadInfo {
  direction: string;
  buyExchange: string;
  sellExchange: string;
  rawSpreadPct: number;
  netSpreadPct: number;
  isOpportunity: boolean;
}

function PricePanel({
  label,
  data,
  accentColor,
}: {
  label: string;
  data: PriceSummary | undefined;
  accentColor: string;
}) {
  if (!data) {
    return (
      <div className="flex-1 bg-card border border-border rounded-xl p-4 space-y-3">
        <div className={`text-xs font-semibold uppercase tracking-widest ${accentColor}`}>{label}</div>
        <div className="text-muted text-sm">Connecting…</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-card border border-border rounded-xl p-4 space-y-3">
      <div className={`text-xs font-semibold uppercase tracking-widest ${accentColor}`}>{label}</div>
      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-[11px] text-muted">BID</span>
          <span
            key={data.bestBid}
            className="font-mono font-semibold text-white text-lg tabular-nums animate-flash"
          >
            {fmtPrice(data.bestBid)}
          </span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-[11px] text-muted">ASK</span>
          <span
            key={data.bestAsk}
            className="font-mono font-semibold text-subtle text-lg tabular-nums animate-flash"
          >
            {fmtPrice(data.bestAsk)}
          </span>
        </div>
        <div className="flex justify-between items-baseline pt-1 border-t border-dim">
          <span className="text-[11px] text-muted">MID</span>
          <span className="font-mono text-xs text-muted tabular-nums">
            {fmtPrice(data.midPrice)}
          </span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-[11px] text-muted">INT. SPREAD</span>
          <span className="font-mono text-xs text-muted tabular-nums">
            {fmtPct(data.spreadPct, 5)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function PriceComparison({ prices, demoMode }: Props) {
  const binance = prices['binance'];
  const kraken  = prices['kraken'];

  // Mirror backend: 0% threshold in demo mode (any positive-net trade executes),
  // 0.15% in production.
  const MIN_NET = demoMode ? 0 : 0.0015;

  const spread = useMemo<SpreadInfo | null>(() => {
    if (!binance || !kraken) return null;

    const directions = [
      {
        direction: 'BNB → KRK',
        buyExchange: 'binance',
        sellExchange: 'kraken',
        buyAsk: binance.bestAsk,
        sellBid: kraken.bestBid,
      },
      {
        direction: 'KRK → BNB',
        buyExchange: 'kraken',
        sellExchange: 'binance',
        buyAsk: kraken.bestAsk,
        sellBid: binance.bestBid,
      },
    ].map(({ direction, buyExchange, sellExchange, buyAsk, sellBid }) => {
      const rawSpreadPct = (sellBid - buyAsk) / buyAsk;
      const effectiveBuy  = buyAsk  * (1 + SLIPPAGE) * (1 + FEES[buyExchange]);
      const effectiveSell = sellBid * (1 - SLIPPAGE) * (1 - FEES[sellExchange]);
      const netSpreadPct  = (effectiveSell - effectiveBuy) / effectiveBuy;
      return { direction, buyExchange, sellExchange, rawSpreadPct, netSpreadPct, isOpportunity: netSpreadPct >= MIN_NET };
    });

    return directions.sort((a, b) => b.netSpreadPct - a.netSpreadPct)[0];
  }, [binance, kraken, MIN_NET]);

  const hasOpp = spread?.isOpportunity ?? false;
  // In demo mode: gross positive but net negative → show as demo trade indicator
  const isDemoSpread = demoMode && !hasOpp && (spread?.rawSpreadPct ?? 0) > 0 && (spread?.netSpreadPct ?? 0) < 0;

  return (
    <div className="bg-panel border border-border rounded-2xl p-4 space-y-4 h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">Live Prices</h2>
        <span className="text-[10px] text-muted font-mono">BTC/USDT</span>
      </div>

      <div className="flex gap-3">
        <PricePanel label="Binance" data={binance} accentColor="text-accent" />
        <PricePanel label="Kraken"  data={kraken}  accentColor="text-blue-400" />
      </div>

      {/* Cross-exchange spread meter */}
      <div
        className={`rounded-xl p-3 border transition-colors duration-500 ${
          hasOpp
            ? 'border-profit/40 bg-profit/10'
            : isDemoSpread
            ? 'border-accent/30 bg-accent/[0.06]'
            : 'border-border bg-card'
        }`}
      >
        {spread ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-muted uppercase tracking-widest">
                Best Direction
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${hasOpp ? 'text-profit animate-pulse' : isDemoSpread ? 'text-accent animate-pulse' : 'text-muted'}`}>
                {hasOpp ? '● Opportunity' : isDemoSpread ? '⚡ Demo Trade' : '○ No Edge'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-white">{spread.direction}</span>
              <span className={`font-mono text-sm font-bold tabular-nums ${spread.rawSpreadPct >= 0 ? 'text-profit' : 'text-loss'}`}>
                {fmtPct(spread.rawSpreadPct)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted">Net (fees + slippage)</span>
              <span className={`font-mono text-sm font-bold tabular-nums ${spread.netSpreadPct >= MIN_NET ? 'text-profit' : spread.netSpreadPct >= 0 ? 'text-subtle' : 'text-loss'}`}>
                {fmtPct(spread.netSpreadPct)}
              </span>
            </div>
            {/* Visual spread bar */}
            <div className="h-1 w-full bg-dim rounded-full overflow-hidden mt-1">
              <div
                className={`h-full rounded-full transition-all duration-300 ${hasOpp ? 'bg-profit' : isDemoSpread ? 'bg-accent' : 'bg-muted'}`}
                style={{ width: `${Math.min(100, Math.abs(spread.rawSpreadPct) / 0.005 * 100)}%` }}
              />
            </div>
            <div className="text-[9px] text-muted text-right">
              {demoMode
                ? isDemoSpread
                  ? 'gross spread positive — DEMO TRADE'
                  : `threshold ${(MIN_NET * 100).toFixed(4)}% (demo)`
                : `threshold ${(MIN_NET * 100).toFixed(4)}%`}
            </div>
          </div>
        ) : (
          <div className="text-center text-muted text-xs py-2">Awaiting both feeds…</div>
        )}
      </div>
    </div>
  );
}
