// Simulated wallet — tracks paper balances per exchange for backtesting P&L.
// Real trading would replace execute() with signed API calls.

export interface Balance {
  usd: number;
  btc: number;
}

export interface TradeResult {
  exchange: string;
  side: 'buy' | 'sell';
  price: number;
  btcAmount: number;
  usdAmount: number;
  fee: number;
  balanceAfter: Balance;
}

const FEE: Record<string, number> = {
  binance: 0.001,
  kraken: 0.0026,
};

const INITIAL_BALANCE: Balance = { usd: 10_000, btc: 0.1 };

export class WalletManager {
  private balances: Record<string, Balance> = {
    binance: { ...INITIAL_BALANCE },
    kraken: { ...INITIAL_BALANCE },
  };

  getBalance(exchange: string): Balance {
    return { ...this.balances[exchange] };
  }

  getAllBalances(): Record<string, Balance> {
    return { ...this.balances };
  }

  buy(exchange: string, price: number, btcAmount: number): TradeResult | null {
    const bal = this.balances[exchange];
    const fee = FEE[exchange] ?? 0;
    const cost = price * btcAmount * (1 + fee);

    if (bal.usd < cost) return null;

    bal.usd -= cost;
    bal.btc += btcAmount;

    return {
      exchange,
      side: 'buy',
      price,
      btcAmount,
      usdAmount: cost,
      fee: price * btcAmount * fee,
      balanceAfter: { ...bal },
    };
  }

  sell(exchange: string, price: number, btcAmount: number): TradeResult | null {
    const bal = this.balances[exchange];
    const fee = FEE[exchange] ?? 0;
    const proceeds = price * btcAmount * (1 - fee);

    if (bal.btc < btcAmount) return null;

    bal.btc -= btcAmount;
    bal.usd += proceeds;

    return {
      exchange,
      side: 'sell',
      price,
      btcAmount,
      usdAmount: proceeds,
      fee: price * btcAmount * fee,
      balanceAfter: { ...bal },
    };
  }

  totalEquityUsd(prices: Record<string, number>): number {
    return Object.entries(this.balances).reduce((sum, [ex, bal]) => {
      const mid = prices[ex] ?? 0;
      return sum + bal.usd + bal.btc * mid;
    }, 0);
  }
}
