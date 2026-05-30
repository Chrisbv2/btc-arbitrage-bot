interface Props {
  label: string;
  value: string;
  sub?: string;
  highlight?: 'profit' | 'loss' | 'neutral';
}

const highlightClass = {
  profit: 'text-profit',
  loss: 'text-loss',
  neutral: 'text-accent',
};

export function StatsCard({ label, value, sub, highlight = 'neutral' }: Props) {
  return (
    <div className="bg-panel border border-border rounded-xl p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-500 uppercase tracking-widest">{label}</span>
      <span className={`text-2xl font-semibold ${highlightClass[highlight]}`}>{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  );
}
