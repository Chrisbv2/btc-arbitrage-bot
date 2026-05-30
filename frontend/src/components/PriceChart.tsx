import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface SpreadPoint {
  t: number;
  spread: number;
}

interface Props {
  data: SpreadPoint[];
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false });
}

function formatSpread(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(3)}%`;
}

export function PriceChart({ data }: Props) {
  if (data.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-600 text-sm">
        Waiting for data…
      </div>
    );
  }

  const minY = Math.min(...data.map((d) => d.spread));
  const maxY = Math.max(...data.map((d) => d.spread));
  const padding = Math.max(Math.abs(maxY - minY) * 0.2, 0.005);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
        <XAxis
          dataKey="t"
          tickFormatter={formatTime}
          tick={{ fill: '#6b7280', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          minTickGap={60}
        />
        <YAxis
          tickFormatter={formatSpread}
          tick={{ fill: '#6b7280', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          domain={[minY - padding, maxY + padding]}
          width={64}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 8 }}
          labelFormatter={(v) => formatTime(v as number)}
          formatter={(v: number) => [formatSpread(v), 'Raw Spread']}
          labelStyle={{ color: '#9ca3af', fontSize: 11 }}
          itemStyle={{ color: '#f7931a' }}
        />
        <ReferenceLine y={0} stroke="#374151" strokeDasharray="4 2" />
        <Line
          type="monotone"
          dataKey="spread"
          stroke="#f7931a"
          dot={false}
          strokeWidth={1.5}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
