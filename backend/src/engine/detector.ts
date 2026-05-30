import { EventEmitter } from 'events';
import type { TickerData } from '../websocket/binance';

// Fee rates (taker)
const FEE: Record<string, number> = {
  binance: 0.001,  // 0.10%
  kraken: 0.0026,  // 0.26%
};

export interface Opportunity {
  buyExchange: string;
  sellExchange: string;
  buyAsk: number;
  sellBid: number;
  rawSpread: number;
  rawSpreadPct: number;
  netProfitPct: number;
  netProfitUsd: number;
  tradeSize: number;
  isProfitable: boolean;
  timestamp: number;
}

export class ArbitrageDetector extends EventEmitter {
  private prices = new Map<string, TickerData>();
  private readonly tradeSize: number;

  constructor(tradeSize = 0.01) {
    super();
    this.tradeSize = tradeSize;
  }

  update(ticker: TickerData): void {
    this.prices.set(ticker.exchange, ticker);
    this.detect();
  }

  private detect(): void {
    const binance = this.prices.get('binance');
    const kraken = this.prices.get('kraken');
    if (!binance || !kraken) return;

    for (const [buyEx, buyPrice, sellEx, sellPrice] of [
      ['binance', binance.ask, 'kraken', kraken.bid],
      ['kraken', kraken.ask, 'binance', binance.bid],
    ] as const) {
      const opp = this.calcOpportunity(buyEx, buyPrice, sellEx, sellPrice);
      this.emit('opportunity', opp);
    }
  }

  private calcOpportunity(
    buyExchange: string,
    buyAsk: number,
    sellExchange: string,
    sellBid: number,
  ): Opportunity {
    const rawSpread = sellBid - buyAsk;
    const rawSpreadPct = rawSpread / buyAsk;

    // After fees: effective cost to buy, effective proceeds from sell
    const effectiveCost = buyAsk * (1 + FEE[buyExchange]);
    const effectiveRevenue = sellBid * (1 - FEE[sellExchange]);

    const netProfitPct = (effectiveRevenue - effectiveCost) / effectiveCost;
    const netProfitUsd = netProfitPct * buyAsk * this.tradeSize;

    return {
      buyExchange,
      sellExchange,
      buyAsk,
      sellBid,
      rawSpread,
      rawSpreadPct,
      netProfitPct,
      netProfitUsd,
      tradeSize: this.tradeSize,
      isProfitable: netProfitPct > 0,
      timestamp: Date.now(),
    };
  }

  getCurrentPrices(): Record<string, TickerData> {
    return Object.fromEntries(this.prices);
  }
}
