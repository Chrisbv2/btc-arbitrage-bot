export type Exchange = 'okx' | 'kraken';

export interface OrderBook {
  exchange: Exchange;
  bestBid: number;
  bestAsk: number;
  timestamp: number;
  bids: Array<[number, number]>; // [price, qty] — sorted desc
  asks: Array<[number, number]>; // [price, qty] — sorted asc
}

export interface ConnectionStatus {
  exchange: Exchange;
  connected: boolean;
  reconnectAttempts: number;
}

export interface ArbitrageOpportunity {
  id?: number;
  status?: 'executed' | 'skipped';
  buyExchange: Exchange;
  sellExchange: Exchange;
  buyAsk: number;
  sellBid: number;
  rawSpreadPct: number;
  netProfitPct: number;
  netProfitUsd: number;
  executableBtc: number;
  usdValue: number;
  isPartialFill: boolean;
  timestamp: number;
}

export interface TradeRecord {
  id?: number;
  isDemo?: boolean; // true when demo-mode executes a gross-positive but net-negative spread
  buyExchange: Exchange;
  sellExchange: Exchange;
  buyAsk: number;
  sellBid: number;
  btcAmount: number;
  usdCost: number;
  usdRevenue: number;
  buyFeeUsd: number;
  sellFeeUsd: number;
  slippageCostUsd: number;
  netProfitUsd: number;
  netProfitPct: number;
  isPartialFill: boolean;
  timestamp: number;
}

export interface WalletBalance {
  usdt: number;
  btc: number;
}

export interface CircuitBreakerEvent {
  activeUntil: number;
  consecutiveLosses: number;
}
