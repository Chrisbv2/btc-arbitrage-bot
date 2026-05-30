import type { Opportunity } from '../hooks/useArbitrageData';

interface Props {
  opportunities: Opportunity[];
}

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

function fmtPct(n: number): string {
  const s = (n * 100).toFixed(4);
  return `${n >= 0 ? '+' : ''}${s}%`;
}

export function OpportunityLog({ opportunities }: Props) {
  const visible = opportunities.slice(0, 50);

  return (
    <div className="overflow-auto max-h-96">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 bg-panel z-10">
          <tr className="text-gray-500 uppercase tracking-wider">
            <th className="text-left py-2 pr-3">Time</th>
            <th className="text-left py-2 pr-3">Direction</th>
            <th className="text-right py-2 pr-3">Buy Ask</th>
            <th className="text-right py-2 pr-3">Sell Bid</th>
            <th className="text-right py-2 pr-3">Raw Spread</th>
            <th className="text-right py-2 pr-3">Net P&L</th>
            <th className="text-right py-2">Size (BTC)</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center text-gray-600 py-8">
                Waiting for profitable opportunities…
              </td>
            </tr>
          )}
          {visible.map((opp) => {
            const profitable = opp.netProfitPct > 0;
            return (
              <tr
                key={opp.id}
                className={`border-t border-border transition-colors ${
                  profitable ? 'bg-profit/5 hover:bg-profit/10' : 'hover:bg-white/5'
                }`}
              >
                <td className="py-1.5 pr-3 text-gray-500">
                  {new Date(opp.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                </td>
                <td className="py-1.5 pr-3 font-medium">
                  <span className="text-accent">{opp.buyExchange.toUpperCase()}</span>
                  <span className="text-gray-600 mx-1">→</span>
                  <span className="text-blue-400">{opp.sellExchange.toUpperCase()}</span>
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  ${fmt(opp.buyAsk, 2)}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  ${fmt(opp.sellBid, 2)}
                </td>
                <td
                  className={`py-1.5 pr-3 text-right tabular-nums ${
                    opp.rawSpreadPct >= 0 ? 'text-profit' : 'text-loss'
                  }`}
                >
                  {fmtPct(opp.rawSpreadPct)}
                </td>
                <td
                  className={`py-1.5 pr-3 text-right tabular-nums font-semibold ${
                    profitable ? 'text-profit' : 'text-loss'
                  }`}
                >
                  {fmtPct(opp.netProfitPct)}
                </td>
                <td className="py-1.5 text-right tabular-nums text-gray-400">
                  {opp.executableBtc.toFixed(4)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
