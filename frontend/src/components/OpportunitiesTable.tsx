import { fmtPrice, fmtPct, fmtBtc, fmtTime } from '../lib/format';
import type { Opportunity } from '../hooks/useArbitrageData';

interface Props {
  opportunities: Opportunity[];
}

function StatusBadge({ status }: { status: 'executed' | 'skipped' }) {
  if (status === 'executed') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-profit/15 text-profit border border-profit/30">
        ✓ Executed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-dim/40 text-muted border border-dim">
      ↷ Skipped
    </span>
  );
}

export function OpportunitiesTable({ opportunities }: Props) {
  const visible = opportunities.slice(0, 20);

  return (
    <div className="overflow-auto">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 bg-panel z-10">
          <tr className="border-b border-dim">
            {['Time', 'Direction', 'Buy Ask', 'Sell Bid', 'Gross %', 'Net %', 'Volume', 'Status'].map((h) => (
              <th
                key={h}
                className="text-left py-2 px-2 first:pl-0 last:pr-0 text-[10px] font-semibold text-muted uppercase tracking-wider whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center text-muted py-10 text-xs">
                No opportunities detected yet — waiting for profitable spreads…
              </td>
            </tr>
          )}
          {visible.map((opp) => {
            const executed = opp.status === 'executed';
            return (
              <tr
                key={opp.id}
                className={`border-b border-dim/40 transition-colors duration-200 ${
                  executed ? 'bg-profit/[0.04] hover:bg-profit/[0.08]' : 'hover:bg-white/[0.03]'
                }`}
              >
                <td className="py-2 px-2 pl-0 font-mono text-muted whitespace-nowrap">
                  {fmtTime(opp.timestamp)}
                </td>
                <td className="py-2 px-2 font-semibold whitespace-nowrap">
                  <span className="text-accent">{opp.buyExchange.toUpperCase()}</span>
                  <span className="text-dim mx-1">→</span>
                  <span className="text-blue-400">{opp.sellExchange.toUpperCase()}</span>
                </td>
                <td className="py-2 px-2 font-mono tabular-nums text-right whitespace-nowrap">
                  {fmtPrice(opp.buyAsk)}
                </td>
                <td className="py-2 px-2 font-mono tabular-nums text-right whitespace-nowrap">
                  {fmtPrice(opp.sellBid)}
                </td>
                <td className={`py-2 px-2 font-mono tabular-nums text-right whitespace-nowrap font-semibold ${opp.rawSpreadPct >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {fmtPct(opp.rawSpreadPct)}
                </td>
                <td className={`py-2 px-2 font-mono tabular-nums text-right whitespace-nowrap font-bold ${opp.netProfitPct >= 0.0015 ? 'text-profit' : 'text-loss'}`}>
                  {fmtPct(opp.netProfitPct)}
                </td>
                <td className="py-2 px-2 font-mono tabular-nums text-right text-subtle whitespace-nowrap">
                  {fmtBtc(opp.executableBtc)}
                </td>
                <td className="py-2 px-2 pr-0 whitespace-nowrap">
                  <StatusBadge status={opp.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
