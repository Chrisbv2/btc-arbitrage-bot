import { useState } from 'react';
import { fmtPrice, fmtBtc, fmtPnl, fmtPct, fmtTime } from '../lib/format';
import type { Trade } from '../hooks/useArbitrageData';

interface Props {
  trades: Trade[];
}

function FeeRow({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="flex justify-between items-baseline text-[11px]">
      <span className="text-muted">{label}</span>
      <span className="font-mono tabular-nums text-subtle">
        -${value.toFixed(4)}{' '}
        <span className="text-muted text-[10px]">({note})</span>
      </span>
    </div>
  );
}

function TradeRow({ trade, index }: { trade: Trade; index: number }) {
  const [open, setOpen] = useState(false);
  const profitable = trade.netProfitUsd >= 0;

  // Colour scheme: demo → amber, profitable → green, loss → red
  const accentClass = trade.isDemo
    ? 'text-accent'
    : profitable
    ? 'text-profit'
    : 'text-loss';

  const borderClass = trade.isDemo
    ? 'border-accent/25 bg-accent/[0.03]'
    : profitable
    ? 'border-profit/20'
    : 'border-loss/20';

  return (
    <div className={`border rounded-xl overflow-hidden transition-all duration-200 ${borderClass}`}>
      {/* Summary row */}
      <button
        type="button"
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`text-[10px] font-bold transition-transform duration-200 ${open ? 'rotate-90' : ''} text-muted`}>
          ▶
        </span>
        <span className="text-[11px] text-muted font-mono w-5 text-right shrink-0">
          #{index + 1}
        </span>

        {/* Direction */}
        <span className="text-xs font-semibold shrink-0">
          <span className="text-accent">{trade.buyExchange.toUpperCase()}</span>
          <span className="text-dim mx-1">→</span>
          <span className="text-blue-400">{trade.sellExchange.toUpperCase()}</span>
        </span>

        {/* Demo badge */}
        {trade.isDemo && (
          <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-accent/15 text-accent border border-accent/30 shrink-0">
            DEMO TRADE
          </span>
        )}

        {/* Net P&L */}
        <span className={`text-sm font-bold font-mono tabular-nums ml-auto ${accentClass}`}>
          {fmtPnl(trade.netProfitUsd)}
        </span>

        <span className="text-[11px] text-muted font-mono whitespace-nowrap">
          {fmtTime(trade.timestamp)}
        </span>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-dim/40 px-4 py-3 bg-surface/60 space-y-3 text-[11px]">
          {/* Demo mode note */}
          {trade.isDemo && (
            <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-accent/10 border border-accent/20 text-accent text-[11px]">
              <span className="shrink-0 mt-px">⚡</span>
              <span>
                <strong>Demo Trade</strong> — gross spread was positive but fees and slippage
                made this net-unprofitable. In production mode this would be skipped.
              </span>
            </div>
          )}

          {/* Trade legs */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-panel rounded-lg p-2.5 space-y-1">
              <div className="text-[9px] font-bold uppercase tracking-widest text-muted">Buy Leg</div>
              <div className="font-mono font-semibold text-white">{fmtPrice(trade.buyAsk)}</div>
              <div className="text-muted">{fmtBtc(trade.btcAmount)} BTC</div>
              <div className="text-muted">{trade.buyExchange.toUpperCase()}</div>
            </div>
            <div className="bg-panel rounded-lg p-2.5 space-y-1">
              <div className="text-[9px] font-bold uppercase tracking-widest text-muted">Sell Leg</div>
              <div className="font-mono font-semibold text-white">{fmtPrice(trade.sellBid)}</div>
              <div className="text-muted">{fmtBtc(trade.btcAmount)} BTC</div>
              <div className="text-muted">{trade.sellExchange.toUpperCase()}</div>
            </div>
          </div>

          {/* Cost breakdown */}
          <div className="bg-panel rounded-lg p-2.5 space-y-1.5">
            <div className="text-[9px] font-bold uppercase tracking-widest text-muted mb-2">Cost Breakdown</div>
            <div className="flex justify-between items-baseline">
              <span className="text-muted">Gross revenue</span>
              <span className="font-mono tabular-nums text-subtle">
                +${(trade.usdRevenue - trade.usdCost + trade.buyFeeUsd + trade.sellFeeUsd + trade.slippageCostUsd).toFixed(4)}
              </span>
            </div>
            <FeeRow label="Buy fee"     value={trade.buyFeeUsd}       note={`${trade.buyExchange} 0.10%`} />
            <FeeRow label="Sell fee"    value={trade.sellFeeUsd}      note={`${trade.sellExchange} 0.26%`} />
            <FeeRow label="Slippage"    value={trade.slippageCostUsd} note="0.05% × 2 sides" />
            <div className={`flex justify-between items-baseline border-t border-dim/40 pt-1.5 mt-1`}>
              <span className="font-semibold text-white">Net result</span>
              <span className={`font-mono font-bold tabular-nums ${accentClass}`}>
                {fmtPnl(trade.netProfitUsd)}{' '}
                <span className="text-[10px] font-normal">({fmtPct(trade.netProfitPct)})</span>
              </span>
            </div>
          </div>

          {trade.isPartialFill && (
            <div className="text-[10px] text-accent/80 flex items-center gap-1">
              ⚠ Partial fill — order book depth limited execution
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TradesLog({ trades }: Props) {
  const visible = trades.slice(0, 20);

  return (
    <div className="space-y-2 overflow-auto max-h-[520px] pr-1">
      {visible.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted">
          <div className="text-3xl opacity-20">⚡</div>
          <div className="text-xs">No trades executed yet</div>
        </div>
      )}
      {visible.map((trade, i) => (
        <TradeRow key={trade.id} trade={trade} index={i} />
      ))}
    </div>
  );
}
