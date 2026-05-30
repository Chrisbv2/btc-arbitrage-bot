import { useEffect, useRef, useState } from 'react';

const API = import.meta.env.VITE_API_URL ?? '';

export interface TickerData {
  exchange: string;
  bid: number;
  ask: number;
  timestamp: number;
}

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

export interface ConnectionStatus {
  binance: boolean;
  kraken: boolean;
}

export interface Balance {
  usd: number;
  btc: number;
}

const MAX_OPPORTUNITIES = 200;
const MAX_CHART_POINTS = 120;

export function useArbitrageData() {
  const [prices, setPrices] = useState<Record<string, TickerData>>({});
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>({ binance: false, kraken: false });
  const [balances, setBalances] = useState<Record<string, Balance>>({});
  const [spreadHistory, setSpreadHistory] = useState<{ t: number; spread: number }[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`${API}/api/events`);
    esRef.current = es;

    es.addEventListener('prices', (e) => {
      const data = JSON.parse(e.data) as Record<string, TickerData>;
      setPrices(data);
    });

    es.addEventListener('opportunity', (e) => {
      const opp = JSON.parse(e.data) as Opportunity;
      setOpportunities((prev) => [opp, ...prev].slice(0, MAX_OPPORTUNITIES));
      setSpreadHistory((prev) =>
        [...prev, { t: opp.timestamp, spread: opp.rawSpreadPct * 100 }].slice(-MAX_CHART_POINTS)
      );
    });

    es.addEventListener('status', (e) => {
      setStatus(JSON.parse(e.data) as ConnectionStatus);
    });

    es.addEventListener('balances', (e) => {
      setBalances(JSON.parse(e.data) as Record<string, Balance>);
    });

    return () => {
      es.close();
    };
  }, []);

  return { prices, opportunities, status, balances, spreadHistory };
}
