import { useEffect, useMemo, useState } from 'react';
import { useSSE } from './useSSE';
import { API_BASE } from '../lib/config';

// ── Types ─────────────────────────────────────────────────────────────────────

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
  status: 'executed' | 'skipped';
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
  isDemo: boolean;
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

const MAX_ITEMS = 200;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useArbitrageData() {
  // es is React state — dependent effects re-run reactively when it changes
  const { es, connected } = useSSE();

  const [prices,     setPrices]  = useState<Record<string, PriceSummary>>({});
  const [opps,       setOpps]    = useState<Opportunity[]>([]);
  const [trades,     setTrades]  = useState<Trade[]>([]);
  const [wallets,    setWallets] = useState<Record<string, WalletBalance>>({});
  const [connStatus, setConn]    = useState<ConnectionStatus>({ binance: false, kraken: false });
  const [cb,         setCb]      = useState<CircuitBreakerState>({ active: false });
  const [demoMode,   setDemoMode] = useState(false);
  const [uptimeBaseMs, setUptimeBase] = useState(() => Date.now());

  // ── Historical hydration from REST (runs once on mount) ───────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [tradesRes, oppsRes, statusRes] = await Promise.all([
          fetch(`${API_BASE}/api/trades?limit=100`),
          fetch(`${API_BASE}/api/opportunities?limit=100`),
          fetch(`${API_BASE}/api/status`),
        ]);
        if (!tradesRes.ok || !oppsRes.ok || !statusRes.ok) return;

        const [tradesData, oppsData, statusData] = await Promise.all([
          tradesRes.json() as Promise<Trade[]>,
          oppsRes.json()   as Promise<Opportunity[]>,
          statusRes.json() as Promise<{ uptimeSeconds: number; demoMode: boolean }>,
        ]);

        setTrades(tradesData);
        setOpps(oppsData);
        setDemoMode(statusData.demoMode);
        // Anchor frontend uptime to server uptime
        setUptimeBase(Date.now() - statusData.uptimeSeconds * 1_000);
      } catch {
        // Backend may not be reachable on first render — SSE will recover
      }
    };
    load();
  }, []);

  // ── SSE subscriptions ─────────────────────────────────────────────────────
  // Depends on `es` so this re-runs when the EventSource goes from null →
  // live, and cleanup removes all listeners before the ES is closed.
  useEffect(() => {
    if (!es) return;

    type H = (e: MessageEvent) => void;

    const onPrice: H = (e) => {
      const d = JSON.parse(e.data) as PriceSummary;
      setPrices((prev) => ({ ...prev, [d.exchange]: d }));
    };

    const onOpp: H = (e) => {
      const opp = JSON.parse(e.data) as Opportunity;
      setOpps((prev) => [opp, ...prev].slice(0, MAX_ITEMS));
    };

    const onTrade: H = (e) => {
      const t = JSON.parse(e.data) as Trade;
      setTrades((prev) => [t, ...prev].slice(0, MAX_ITEMS));
    };

    const onWallets: H = (e) => {
      setWallets(JSON.parse(e.data) as Record<string, WalletBalance>);
    };

    const onStatus: H = (e) => {
      setConn(JSON.parse(e.data) as ConnectionStatus);
    };

    const onCb: H = (e) => {
      setCb(JSON.parse(e.data) as CircuitBreakerState);
    };

    es.addEventListener('price_update',          onPrice   as EventListener);
    es.addEventListener('opportunity_detected',   onOpp     as EventListener);
    es.addEventListener('trade_executed',         onTrade   as EventListener);
    es.addEventListener('wallet_update',          onWallets as EventListener);
    es.addEventListener('status',                 onStatus  as EventListener);
    es.addEventListener('circuit_breaker',        onCb      as EventListener);

    return () => {
      es.removeEventListener('price_update',        onPrice   as EventListener);
      es.removeEventListener('opportunity_detected', onOpp     as EventListener);
      es.removeEventListener('trade_executed',       onTrade   as EventListener);
      es.removeEventListener('wallet_update',        onWallets as EventListener);
      es.removeEventListener('status',               onStatus  as EventListener);
      es.removeEventListener('circuit_breaker',      onCb      as EventListener);
    };
  }, [es]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalPnl  = trades.reduce((s, t) => s + t.netProfitUsd, 0);
    const winCount  = trades.filter((t) => t.netProfitUsd > 0).length;
    const winRate   = trades.length > 0 ? winCount / trades.length : 0;
    const lastOppTs = opps[0]?.timestamp ?? null;

    // Cumulative P&L series — oldest first, last 100 trades
    const pnlSeries = [...trades]
      .reverse()
      .slice(0, 100)
      .reduce<{ t: number; cumPnl: number; tradePnl: number }[]>((acc, t) => {
        const prev = acc[acc.length - 1]?.cumPnl ?? 0;
        acc.push({ t: t.timestamp, cumPnl: prev + t.netProfitUsd, tradePnl: t.netProfitUsd });
        return acc;
      }, []);

    return { totalPnl, winCount, winRate, lastOppTs, pnlSeries };
  }, [trades, opps]);

  const toggleDemoMode = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/demo-mode`, { method: 'POST' });
      const data = await res.json() as { demoMode: boolean };
      setDemoMode(data.demoMode);
    } catch {
      // backend unreachable — ignore, UI keeps showing current state
    }
  };

  return {
    prices,
    opportunities: opps,
    trades,
    wallets,
    connStatus,
    circuitBreaker: cb,
    demoMode,
    toggleDemoMode,
    uptimeBaseMs,
    connected,
    stats,
  };
}
