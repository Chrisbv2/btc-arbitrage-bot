import { useArbitrageData } from './hooks/useArbitrageData';
import { HeaderStats }       from './components/HeaderStats';
import { PriceComparison }   from './components/PriceComparison';
import { PnLChart }          from './components/PnLChart';
import { OpportunitiesTable } from './components/OpportunitiesTable';
import { TradesLog }         from './components/TradesLog';
import { WalletBalances }    from './components/WalletBalances';

function LiveDot({ on }: { on: boolean }) {
  return (
    <span className="relative inline-flex h-2 w-2">
      {on && <span className="absolute inline-flex h-full w-full rounded-full bg-profit opacity-75 animate-ping" />}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${on ? 'bg-profit' : 'bg-muted'}`} />
    </span>
  );
}

function Panel({ title, children, className = '' }: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-panel border border-border rounded-2xl flex flex-col overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-dim/40 shrink-0">
        <h2 className="text-[10px] font-bold text-muted uppercase tracking-widest">{title}</h2>
      </div>
      <div className="flex-1 overflow-auto p-4">{children}</div>
    </div>
  );
}

export default function App() {
  const {
    prices,
    opportunities,
    trades,
    wallets,
    connStatus,
    circuitBreaker,
    demoMode,
    uptimeBaseMs,
    stats,
  } = useArbitrageData();

  return (
    <div className="min-h-screen bg-surface text-white font-mono">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur px-5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-accent font-bold text-base tracking-tight">₿ ARB</span>
          <span className="text-dim">|</span>
          <span className="text-muted text-xs">BTC/USDT Paper Trading</span>
        </div>

        <div className="flex items-center gap-5 text-xs">
          {demoMode && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest bg-accent/15 text-accent border border-accent/30 animate-pulse-slow">
              ◈ Demo Mode
            </span>
          )}
          {circuitBreaker.active && (
            <span className="text-loss font-bold animate-pulse text-[11px]">
              ⚡ Circuit Breaker Active
            </span>
          )}
          <span className="flex items-center gap-1.5 text-muted">
            <LiveDot on={connStatus.binance} />
            Binance
          </span>
          <span className="flex items-center gap-1.5 text-muted">
            <LiveDot on={connStatus.kraken} />
            Kraken
          </span>
          <span className="text-dim font-mono text-[10px]">
            {new Date().toLocaleTimeString('en-US', { hour12: false })}
          </span>
        </div>
      </header>

      {/* ── Main grid ───────────────────────────────────────────────────── */}
      <main className="max-w-[1600px] mx-auto px-4 py-4 space-y-4">

        {/* Row 1 — KPI strip */}
        <HeaderStats
          totalPnl={stats.totalPnl}
          totalTrades={trades.length}
          winRate={stats.winRate}
          uptimeBaseMs={uptimeBaseMs}
          lastOppTs={stats.lastOppTs}
        />

        {/* Row 2 — Prices + P&L chart */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-4">
            <PriceComparison prices={prices} demoMode={demoMode} />
          </div>
          <div className="col-span-12 md:col-span-8">
            <Panel title="Cumulative P&L — last 100 trades">
              <PnLChart data={stats.pnlSeries} />
            </Panel>
          </div>
        </div>

        {/* Row 3 — Wallets (full-width mini cards) */}
        <Panel title="Paper Wallet Balances">
          <WalletBalances wallets={wallets} />
        </Panel>

        {/* Row 4 — Opportunities + Trades */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-7">
            <Panel title={`Detected Opportunities (${opportunities.length})`} className="min-h-[340px]">
              <OpportunitiesTable opportunities={opportunities} />
            </Panel>
          </div>
          <div className="col-span-12 lg:col-span-5">
            <Panel title={`Executed Trades (${trades.length})`} className="min-h-[340px]">
              <TradesLog trades={trades} />
            </Panel>
          </div>
        </div>

      </main>
    </div>
  );
}
