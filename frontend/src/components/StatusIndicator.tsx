import type { ConnectionStatus } from '../hooks/useArbitrageData';

interface Props {
  status: ConnectionStatus;
}

function Dot({ live }: { live: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${
        live ? 'bg-profit animate-pulse' : 'bg-loss'
      }`}
    />
  );
}

export function StatusIndicator({ status }: Props) {
  return (
    <div className="flex items-center gap-4 text-xs text-gray-400">
      <span className="flex items-center gap-1.5">
        <Dot live={status.okx} />
        OKX
      </span>
      <span className="flex items-center gap-1.5">
        <Dot live={status.kraken} />
        Kraken
      </span>
    </div>
  );
}
