import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
  type TooltipProps,
} from 'recharts';
import { fmtTime, fmtPnl } from '../lib/format';

interface ChartPoint {
  t: number;
  cumPnl: number;
  tradePnl: number;
}

interface Props {
  data: ChartPoint[];
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const cum   = payload[0]?.value ?? 0;
  const trade = payload[0]?.payload?.tradePnl as number;
  return (
    <div className="bg-panel border border-border rounded-lg px-3 py-2 text-[11px] font-mono shadow-lg">
      <div className="text-muted mb-1">{fmtTime(label as number)}</div>
      <div className={`font-bold ${cum >= 0 ? 'text-profit' : 'text-loss'}`}>
        Cumulative: {fmtPnl(cum)}
      </div>
      <div className={`${trade >= 0 ? 'text-profit/80' : 'text-loss/80'}`}>
        This trade: {fmtPnl(trade)}
      </div>
    </div>
  );
}

export function PnLChart({ data }: Props) {
  const lastVal = data[data.length - 1]?.cumPnl ?? 0;
  const isPositive = lastVal >= 0;

  const strokeColor = isPositive ? '#10b981' : '#f43f5e';
  const gradId = 'pnlGrad';

  if (data.length < 2) {
    return (
      <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted">
        <div className="text-3xl opacity-20">📈</div>
        <div className="text-xs">Waiting for first trades…</div>
      </div>
    );
  }

  const minY = Math.min(...data.map((d) => d.cumPnl));
  const maxY = Math.max(...data.map((d) => d.cumPnl));
  const pad  = Math.max(Math.abs(maxY - minY) * 0.12, 2);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={strokeColor} stopOpacity={0.22} />
            <stop offset="95%" stopColor={strokeColor} stopOpacity={0.01} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" vertical={false} />

        <XAxis
          dataKey="t"
          tickFormatter={fmtTime}
          tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'monospace' }}
          tickLine={false}
          axisLine={false}
          minTickGap={60}
        />
        <YAxis
          tickFormatter={(v: number) => (v >= 0 ? `+$${v.toFixed(0)}` : `-$${Math.abs(v).toFixed(0)}`)}
          tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'monospace' }}
          tickLine={false}
          axisLine={false}
          width={54}
          domain={[minY - pad, maxY + pad]}
        />

        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="#334155" strokeDasharray="5 3" />

        <Area
          type="monotone"
          dataKey="cumPnl"
          stroke={strokeColor}
          strokeWidth={2}
          fill={`url(#${gradId})`}
          dot={false}
          activeDot={{ r: 4, fill: strokeColor, strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
