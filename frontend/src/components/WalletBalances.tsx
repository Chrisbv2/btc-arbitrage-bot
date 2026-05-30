import { fmtBtc } from '../lib/format';
import type { WalletBalance } from '../hooks/useArbitrageData';

interface Props {
  wallets: Record<string, WalletBalance>;
}

const PRICE_FMT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function BalanceCard({
  exchange,
  currency,
  value,
  label,
}: {
  exchange: string;
  currency: 'USDT' | 'BTC';
  value: number;
  label: string;
}) {
  const isUsdt = currency === 'USDT';

  return (
    <div className="bg-card border border-border rounded-xl p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted">
          {exchange}
        </span>
        <span
          className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
            isUsdt ? 'bg-blue-500/10 text-blue-400' : 'bg-accent/10 text-accent'
          }`}
        >
          {currency}
        </span>
      </div>
      <div
        key={value}
        className="font-mono font-semibold tabular-nums text-white animate-flash leading-tight"
      >
        {isUsdt ? (
          <span className="text-base">${PRICE_FMT.format(value)}</span>
        ) : (
          <span className="text-base">{fmtBtc(value)}</span>
        )}
      </div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  );
}

export function WalletBalances({ wallets }: Props) {
  const binance = wallets['binance'];
  const kraken  = wallets['kraken'];

  if (!binance && !kraken) {
    return (
      <div className="grid grid-cols-2 gap-2 text-center text-muted text-xs py-4">
        Awaiting wallet data…
      </div>
    );
  }

  const totalUsdt = (binance?.usdt ?? 0) + (kraken?.usdt ?? 0);
  const totalBtc  = (binance?.btc  ?? 0) + (kraken?.btc  ?? 0);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {binance && (
          <>
            <BalanceCard exchange="Binance" currency="USDT" value={binance.usdt} label="tether balance" />
            <BalanceCard exchange="Binance" currency="BTC"  value={binance.btc}  label="bitcoin balance" />
          </>
        )}
        {kraken && (
          <>
            <BalanceCard exchange="Kraken"  currency="USDT" value={kraken.usdt}  label="tether balance" />
            <BalanceCard exchange="Kraken"  currency="BTC"  value={kraken.btc}   label="bitcoin balance" />
          </>
        )}
      </div>
      {/* Portfolio total row */}
      <div className="flex items-center justify-between bg-card border border-border rounded-xl px-3 py-2">
        <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">Total Portfolio</span>
        <div className="text-right font-mono text-xs">
          <div className="text-white font-semibold">${PRICE_FMT.format(totalUsdt)}</div>
          <div className="text-muted text-[10px]">{fmtBtc(totalBtc)} BTC</div>
        </div>
      </div>
    </div>
  );
}
