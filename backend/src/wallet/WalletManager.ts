import type { Exchange, WalletBalance } from '../types';

const INITIAL_USDT = 50_000;
const INITIAL_BTC = 0.5;

export class WalletManager {
  // In-memory balances updated synchronously on every trade.
  // better-sqlite3 handles the durable audit log; no async needed.
  private readonly balances: Record<Exchange, WalletBalance> = {
    binance: { usdt: INITIAL_USDT, btc: INITIAL_BTC },
    kraken: { usdt: INITIAL_USDT, btc: INITIAL_BTC },
  };

  getBalance(exchange: Exchange): Readonly<WalletBalance> {
    const b = this.balances[exchange];
    return { usdt: b.usdt, btc: b.btc };
  }

  getAllBalances(): Record<Exchange, WalletBalance> {
    return {
      binance: { ...this.balances.binance },
      kraken: { ...this.balances.kraken },
    };
  }

  // Max BTC buyable with current USDT balance at the given all-in cost per BTC.
  maxBuyableBtc(exchange: Exchange, costPerBtc: number): number {
    return this.balances[exchange].usdt / costPerBtc;
  }

  // BTC available to sell on this exchange.
  maxSellableBtc(exchange: Exchange): number {
    return this.balances[exchange].btc;
  }

  // Deduct USDT, credit BTC. usdCost must include fees + slippage.
  // Returns false if insufficient balance (floating-point guard only —
  // callers should pre-validate with maxBuyableBtc).
  buy(exchange: Exchange, usdCost: number, btcAmount: number): boolean {
    const bal = this.balances[exchange];
    if (bal.usdt < usdCost - 0.001) return false; // $0.001 fp tolerance
    bal.usdt = Math.max(0, bal.usdt - usdCost);
    bal.btc += btcAmount;
    return true;
  }

  // Deduct BTC, credit USDT proceeds. usdRevenue must be net of fees + slippage.
  sell(exchange: Exchange, usdRevenue: number, btcAmount: number): boolean {
    const bal = this.balances[exchange];
    if (bal.btc < btcAmount - 1e-8) return false; // satoshi-level fp tolerance
    bal.btc = Math.max(0, bal.btc - btcAmount);
    bal.usdt += usdRevenue;
    return true;
  }

  totalEquityUsdt(midPrices: Partial<Record<Exchange, number>>): number {
    return (Object.keys(this.balances) as Exchange[]).reduce((sum, ex) => {
      const b = this.balances[ex];
      return sum + b.usdt + b.btc * (midPrices[ex] ?? 0);
    }, 0);
  }
}
