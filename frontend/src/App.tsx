import { useArbitrageData } from './hooks/useArbitrageData';
import { StatsCard } from './components/StatsCard';
import { PriceChart } from './components/PriceChart';
import { OpportunityLog } from './components/OpportunityLog';
import { StatusIndicator } from './components/StatusIndicator';

function fmt(n: number | undefined, decimals = 2): string {
  if (n === undefined) return '—';
  return n.toFixed(decimals);
}

export default function App() {
  const { prices, opportunities, trades, status, wallets, circuitBreaker, spreadHistory } =
    useArbitrageData();

  const binance = prices['binance'];
  const kraken  = prices['kraken'];

  // Engine only emits opportunities above the 0.15% threshold — all are profitable
  const bestOpp = opportunities[0];

  const walletEntries = Object.entries(wallets) as [string, { usdt: number; btc: number }][];
  const totalUsdt = walletEntries.reduce((s, [, b]) => s + b.usdt, 0);
  const totalBtc  = walletEntries.reduce((s, [, b]) => s + b.btc,  0);

  const totalNetPnl = trades.reduce((s, t) => s + t.netProfitUsd, 0);

  return (
    <div className="min-h-screen bg-surface text-white">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-accent font-semibold text-lg tracking-tight">₿ ARB</span>
          <span className="text-gray-600 text-sm">BTC/USDT · Paper Trading</span>
        </div>
        <div className="flex items-center gap-4">
          {circuitBreaker.active && (
            <span className="text-xs text-loss font-semibold animate-pulse">
              ⚡ Circuit breaker active
            </span>
          )}
          <StatusIndicator status={status} />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Live stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard
            label="Binance Ask"
            value={binance ? `$${fmt(binance.bestAsk)}` : '—'}
            sub={binance ? `bid $${fmt(binance.bestBid)}` : 'connecting…'}
            highlight="neutral"
          />
          <StatsCard
            label="Kraken Ask"
            value={kraken ? `$${fmt(kraken.bestAsk)}` : '—'}
            sub={kraken ? `bid $${fmt(kraken.bestBid)}` : 'connecting…'}
            highlight="neutral"
          />
          <StatsCard
            label="Best Opportunity"
            value={bestOpp ? `${(bestOpp.netProfitPct * 100).toFixed(4)}%` : '—'}
            sub={
              bestOpp
                ? `$${fmt(bestOpp.netProfitUsd, 2)} · ${fmt(bestOpp.executableBtc, 4)} BTC`
                : undefined
            }
            highlight={bestOpp ? 'profit' : 'neutral'}
          />
          <StatsCard
            label="Realised P&L"
            value={trades.length ? `$${fmt(totalNetPnl, 2)}` : '—'}
            sub={`${trades.length} trades`}
            highlight={totalNetPnl > 0 ? 'profit' : totalNetPnl < 0 ? 'loss' : 'neutral'}
          />
        </div>

        {/* Spread chart */}
        <section className="bg-panel border border-border rounded-xl p-5">
          <h2 className="text-sm text-gray-400 mb-3 uppercase tracking-wider">
            Raw Cross-Exchange Spread %
          </h2>
          <PriceChart data={spreadHistory} />
        </section>

        {/* Wallet */}
        <section className="bg-panel border border-border rounded-xl p-5">
          <h2 className="text-sm text-gray-400 mb-3 uppercase tracking-wider">Paper Wallet</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {walletEntries.map(([ex, bal]) => (
              <div key={ex} className="bg-surface rounded-lg p-3 border border-border">
                <div className="text-gray-500 text-xs uppercase mb-2">{ex}</div>
                <div className="text-accent">${bal.usdt.toFixed(2)}</div>
                <div className="text-gray-300">{bal.btc.toFixed(6)} BTC</div>
              </div>
            ))}
            <div className="bg-surface rounded-lg p-3 border border-border">
              <div className="text-gray-500 text-xs uppercase mb-2">Total</div>
              <div className="text-white font-semibold">${totalUsdt.toFixed(2)}</div>
              <div className="text-gray-300">{totalBtc.toFixed(6)} BTC</div>
            </div>
          </div>
        </section>

        {/* Opportunity log */}
        <section className="bg-panel border border-border rounded-xl p-5">
          <h2 className="text-sm text-gray-400 mb-3 uppercase tracking-wider">
            Opportunity Log
            <span className="text-gray-600 normal-case text-xs ml-2">
              ({opportunities.length} detected)
            </span>
          </h2>
          <OpportunityLog opportunities={opportunities} />
        </section>
      </main>
    </div>
  );
}
