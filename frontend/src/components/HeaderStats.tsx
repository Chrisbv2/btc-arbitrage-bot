import { useEffect, useState } from 'react';
import { fmtPnl, fmtUptime, fmtAgo, fmtTime } from '../lib/format';

interface Props {
  totalPnl:      number;
  totalTrades:   number;
  winRate:       number;
  uptimeBaseMs:  number;
  lastOppTs:     number | null;
}

function KPI({
  label,
  value,
  sub,
  valueClass = 'text-white',
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-panel border border-border rounded-2xl px-5 py-4 flex flex-col gap-1 min-w-0">
      <span className="text-[10px] font-semibold text-muted uppercase tracking-widest truncate">
        {label}
      </span>
      <span className={`text-2xl font-bold font-mono tabular-nums leading-tight ${valueClass}`}>
        {value}
      </span>
      {sub && (
        <span className="text-[11px] text-muted truncate">{sub}</span>
      )}
    </div>
  );
}

export function HeaderStats({ totalPnl, totalTrades, winRate, uptimeBaseMs, lastOppTs }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  // suppress lint — tick forces re-render for live timers
  void tick;

  const uptimeMs = Date.now() - uptimeBaseMs;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <KPI
        label="Total P&L"
        value={fmtPnl(totalPnl)}
        sub={`${totalTrades} trades total`}
        valueClass={totalPnl > 0 ? 'text-profit' : totalPnl < 0 ? 'text-loss' : 'text-white'}
      />
      <KPI
        label="Total Trades"
        value={String(totalTrades)}
        sub="simulated executions"
      />
      <KPI
        label="Win Rate"
        value={totalTrades > 0 ? `${(winRate * 100).toFixed(1)}%` : '—'}
        sub={`${Math.round(winRate * totalTrades)} / ${totalTrades} profitable`}
        valueClass={winRate >= 0.7 ? 'text-profit' : winRate < 0.5 ? 'text-loss' : 'text-white'}
      />
      <KPI
        label="Session Uptime"
        value={fmtUptime(uptimeMs)}
        sub="since server start"
      />
      <KPI
        label="Last Opportunity"
        value={lastOppTs ? fmtAgo(lastOppTs) : '—'}
        sub={lastOppTs ? fmtTime(lastOppTs) : 'waiting…'}
        valueClass={lastOppTs && Date.now() - lastOppTs < 3000 ? 'text-profit animate-flash' : 'text-white'}
      />
    </div>
  );
}
