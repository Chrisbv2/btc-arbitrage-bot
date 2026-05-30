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
  const { prices, opportunities, status, balances, spreadHistory } = useArbitrageData();

  const binance = prices['binance'];
  const kraken = prices['kraken'];

  const profitable = opportunities.filter((o) => o.isProfitable);
  const bestOpp = profitable[0];

  const totalUsd = Object.values(balances).reduce((s, b) => s + b.usd, 0);
  const totalBtc = Object.values(balances).reduce((s, b) => s + b.btc, 0);

  return (
    <div className="min-h-screen bg-surface text-white">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-accent font-semibold text-lg tracking-tight">₿ ARB</span>
          <span className="text-gray-600 text-sm">BTC/USD · Paper Trading</span>
        </div>
        <StatusIndicator status={status} />
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Live prices */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard
            label="Binance Ask"
            value={binance ? `$${fmt(binance.ask)}` : '—'}
            sub="best ask (taker entry)"
            highlight="neutral"
          />
          <StatsCard
            label="Kraken Ask"
            value={kraken ? `$${fmt(kraken.ask)}` : '—'}
            sub="best ask (taker entry)"
            highlight="neutral"
          />
          <StatsCard
            label="Best Net Profit"
            value={bestOpp ? `${(bestOpp.netProfitPct * 100).toFixed(4)}%` : '—'}
            sub={bestOpp ? `$${fmt(bestOpp.netProfitUsd, 4)} on ${bestOpp.tradeSize} BTC` : undefined}
            highlight={bestOpp ? 'profit' : 'neutral'}
          />
          <StatsCard
            label="Profitable Opps"
            value={`${profitable.length}`}
            sub={`of ${opportunities.length} detected`}
            highlight={profitable.length > 0 ? 'profit' : 'neutral'}
          />
        </div>

        {/* Spread chart */}
        <section className="bg-panel border border-border rounded-xl p-5">
          <h2 className="text-sm text-gray-400 mb-3 uppercase tracking-wider">
            Raw Spread % (Binance→Kraken)
          </h2>
          <PriceChart data={spreadHistory} />
        </section>

        {/* Wallet */}
        <section className="bg-panel border border-border rounded-xl p-5">
          <h2 className="text-sm text-gray-400 mb-3 uppercase tracking-wider">Paper Wallet</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {Object.entries(balances).map(([ex, bal]) => (
              <div key={ex} className="bg-surface rounded-lg p-3 border border-border">
                <div className="text-gray-500 text-xs uppercase mb-2">{ex}</div>
                <div className="text-accent">${bal.usd.toFixed(2)}</div>
                <div className="text-gray-300">{bal.btc.toFixed(6)} BTC</div>
              </div>
            ))}
            <div className="bg-surface rounded-lg p-3 border border-border">
              <div className="text-gray-500 text-xs uppercase mb-2">Total USD</div>
              <div className="text-white font-semibold">${totalUsd.toFixed(2)}</div>
              <div className="text-gray-300">{totalBtc.toFixed(6)} BTC</div>
            </div>
          </div>
        </section>

        {/* Opportunity log */}
        <section className="bg-panel border border-border rounded-xl p-5">
          <h2 className="text-sm text-gray-400 mb-3 uppercase tracking-wider">
            Opportunity Log{' '}
            <span className="text-gray-600 normal-case text-xs ml-1">(last 50 of {opportunities.length})</span>
          </h2>
          <OpportunityLog opportunities={opportunities} />
        </section>
      </main>
    </div>
  );
}
