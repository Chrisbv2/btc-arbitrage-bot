import { useEffect, useRef, useState } from 'react';

const API = import.meta.env.VITE_API_URL ?? '';

// ── Types mirroring backend Zod schemas ──────────────────────────────────────

export interface PriceSummary {
  exchange: string;
  bestBid: number;
  bestAsk: number;
  midPrice: number;
  spread: number;
  spreadPct: number;
  timestamp: number;
}

export interface Opportunity {
  id: number;
  buyExchange: string;
  sellExchange: string;
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

export interface Trade {
  id: number;
  buyExchange: string;
  sellExchange: string;
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

export interface ConnectionStatus {
  binance: boolean;
  kraken: boolean;
}

export interface CircuitBreakerState {
  active: boolean;
  activeUntil?: number;
}

const MAX_OPPORTUNITIES = 200;
const MAX_TRADES        = 200;
const MAX_CHART_POINTS  = 120;

export function useArbitrageData() {
  const [prices, setPrices]         = useState<Record<string, PriceSummary>>({});
  const [opportunities, setOpps]    = useState<Opportunity[]>([]);
  const [trades, setTrades]         = useState<Trade[]>([]);
  const [status, setStatus]         = useState<ConnectionStatus>({ binance: false, kraken: false });
  const [wallets, setWallets]       = useState<Record<string, WalletBalance>>({});
  const [circuitBreaker, setCb]     = useState<CircuitBreakerState>({ active: false });
  const [spreadHistory, setHistory] = useState<{ t: number; spread: number }[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`${API}/api/stream`);
    esRef.current = es;

    // price_update: emitted once per exchange on every order book tick
    es.addEventListener('price_update', (e) => {
      const update = JSON.parse(e.data) as PriceSummary;
      setPrices((prev) => ({ ...prev, [update.exchange]: update }));
    });

    // opportunity_detected: emitted when a profitable cross-exchange spread is found
    es.addEventListener('opportunity_detected', (e) => {
      const opp = JSON.parse(e.data) as Opportunity;
      setOpps((prev) => [opp, ...prev].slice(0, MAX_OPPORTUNITIES));
      setHistory((prev) =>
        [...prev, { t: opp.timestamp, spread: opp.rawSpreadPct * 100 }].slice(-MAX_CHART_POINTS),
      );
    });

    // trade_executed: emitted after a simulated trade is logged to SQLite
    es.addEventListener('trade_executed', (e) => {
      const trade = JSON.parse(e.data) as Trade;
      setTrades((prev) => [trade, ...prev].slice(0, MAX_TRADES));
    });

    // wallet_update: emitted after every trade execution
    es.addEventListener('wallet_update', (e) => {
      setWallets(JSON.parse(e.data) as Record<string, WalletBalance>);
    });

    // status: connection liveness per exchange
    es.addEventListener('status', (e) => {
      setStatus(JSON.parse(e.data) as ConnectionStatus);
    });

    // circuit_breaker: pauses execution after consecutive losses
    es.addEventListener('circuit_breaker', (e) => {
      setCb(JSON.parse(e.data) as CircuitBreakerState);
    });

    return () => {
      es.close();
    };
  }, []);

  return { prices, opportunities, trades, status, wallets, circuitBreaker, spreadHistory };
}
