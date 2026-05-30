import Database from 'better-sqlite3';
import type { ArbitrageOpportunity, OrderBook, TradeRecord } from '../types';

// ── Inserts (return assigned row id) ─────────────────────────────────────────

export function insertOpportunity(
  db: Database.Database,
  opp: ArbitrageOpportunity,
): { id: number } {
  const result = db.prepare(`
    INSERT INTO opportunities
      (buy_exchange, sell_exchange, buy_ask, sell_bid,
       raw_spread_pct, net_profit_pct, net_profit_usd,
       executable_btc, usd_value, is_partial_fill, timestamp)
    VALUES
      (@buyExchange, @sellExchange, @buyAsk, @sellBid,
       @rawSpreadPct, @netProfitPct, @netProfitUsd,
       @executableBtc, @usdValue, @isPartialFill, @timestamp)
  `).run({
    buyExchange:   opp.buyExchange,
    sellExchange:  opp.sellExchange,
    buyAsk:        opp.buyAsk,
    sellBid:       opp.sellBid,
    rawSpreadPct:  opp.rawSpreadPct,
    netProfitPct:  opp.netProfitPct,
    netProfitUsd:  opp.netProfitUsd,
    executableBtc: opp.executableBtc,
    usdValue:      opp.usdValue,
    isPartialFill: opp.isPartialFill ? 1 : 0,
    timestamp:     opp.timestamp,
  });
  return { id: Number(result.lastInsertRowid) };
}

export function insertTrade(
  db: Database.Database,
  t: TradeRecord,
): { id: number } {
  const result = db.prepare(`
    INSERT INTO trades
      (buy_exchange, sell_exchange, buy_ask, sell_bid,
       btc_amount, usd_cost, usd_revenue,
       buy_fee_usd, sell_fee_usd, slippage_cost_usd,
       net_profit_usd, net_profit_pct, is_partial_fill, timestamp)
    VALUES
      (@buyExchange, @sellExchange, @buyAsk, @sellBid,
       @btcAmount, @usdCost, @usdRevenue,
       @buyFeeUsd, @sellFeeUsd, @slippageCostUsd,
       @netProfitUsd, @netProfitPct, @isPartialFill, @timestamp)
  `).run({
    buyExchange:     t.buyExchange,
    sellExchange:    t.sellExchange,
    buyAsk:          t.buyAsk,
    sellBid:         t.sellBid,
    btcAmount:       t.btcAmount,
    usdCost:         t.usdCost,
    usdRevenue:      t.usdRevenue,
    buyFeeUsd:       t.buyFeeUsd,
    sellFeeUsd:      t.sellFeeUsd,
    slippageCostUsd: t.slippageCostUsd,
    netProfitUsd:    t.netProfitUsd,
    netProfitPct:    t.netProfitPct,
    isPartialFill:   t.isPartialFill ? 1 : 0,
    timestamp:       t.timestamp,
  });
  return { id: Number(result.lastInsertRowid) };
}

export function insertPriceSnapshot(
  db: Database.Database,
  book: Pick<OrderBook, 'exchange' | 'bestBid' | 'bestAsk' | 'timestamp'>,
): void {
  db.prepare(`
    INSERT INTO price_snapshots (exchange, bid, ask, timestamp)
    VALUES (?, ?, ?, ?)
  `).run(book.exchange, book.bestBid, book.bestAsk, book.timestamp);
}

// ── Row types (camelCase via SQL aliases) ─────────────────────────────────────

export interface OpportunityRow {
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
  isPartialFill: number; // 0 | 1 — Zod coerces to boolean at the API layer
  timestamp: number;
}

export interface TradeRow {
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
  isPartialFill: number;
  timestamp: number;
}

// ── SELECT helpers ────────────────────────────────────────────────────────────

const OPPORTUNITY_COLS = `
  id,
  buy_exchange    AS buyExchange,
  sell_exchange   AS sellExchange,
  buy_ask         AS buyAsk,
  sell_bid        AS sellBid,
  raw_spread_pct  AS rawSpreadPct,
  net_profit_pct  AS netProfitPct,
  net_profit_usd  AS netProfitUsd,
  executable_btc  AS executableBtc,
  usd_value       AS usdValue,
  is_partial_fill AS isPartialFill,
  timestamp
`;

const TRADE_COLS = `
  id,
  buy_exchange      AS buyExchange,
  sell_exchange     AS sellExchange,
  buy_ask           AS buyAsk,
  sell_bid          AS sellBid,
  btc_amount        AS btcAmount,
  usd_cost          AS usdCost,
  usd_revenue       AS usdRevenue,
  buy_fee_usd       AS buyFeeUsd,
  sell_fee_usd      AS sellFeeUsd,
  slippage_cost_usd AS slippageCostUsd,
  net_profit_usd    AS netProfitUsd,
  net_profit_pct    AS netProfitPct,
  is_partial_fill   AS isPartialFill,
  timestamp
`;

// ── Queries ───────────────────────────────────────────────────────────────────

export function getRecentOpportunities(
  db: Database.Database,
  limit = 100,
): OpportunityRow[] {
  return db
    .prepare(`SELECT ${OPPORTUNITY_COLS} FROM opportunities ORDER BY timestamp DESC LIMIT ?`)
    .all(limit) as OpportunityRow[];
}

export function getRecentTrades(db: Database.Database, limit = 100): TradeRow[] {
  return db
    .prepare(`SELECT ${TRADE_COLS} FROM trades ORDER BY timestamp DESC LIMIT ?`)
    .all(limit) as TradeRow[];
}

export function getBestTrade(db: Database.Database): TradeRow | null {
  return (db
    .prepare(`SELECT ${TRADE_COLS} FROM trades ORDER BY net_profit_usd DESC LIMIT 1`)
    .get() ?? null) as TradeRow | null;
}

export function getWorstTrade(db: Database.Database): TradeRow | null {
  return (db
    .prepare(`SELECT ${TRADE_COLS} FROM trades ORDER BY net_profit_usd ASC LIMIT 1`)
    .get() ?? null) as TradeRow | null;
}

export interface AggregateStats {
  totalOpportunities: number;
  totalTrades: number;
  profitableTrades: number;
  totalNetProfitUsd: number;
  avgNetProfitPct: number;
  maxNetProfitPct: number;
  totalVolumeUsd: number;
  avgSpreadPct: number;
}

export function getAggregateStats(db: Database.Database): AggregateStats {
  const opp = db.prepare(`
    SELECT
      COUNT(*)                          AS totalOpportunities,
      COALESCE(AVG(raw_spread_pct), 0) AS avgSpreadPct
    FROM opportunities
  `).get() as { totalOpportunities: number; avgSpreadPct: number };

  const t = db.prepare(`
    SELECT
      COUNT(*)                                             AS totalTrades,
      SUM(CASE WHEN net_profit_usd > 0 THEN 1 ELSE 0 END) AS profitableTrades,
      COALESCE(SUM(net_profit_usd), 0)                    AS totalNetProfitUsd,
      COALESCE(AVG(net_profit_pct), 0)                    AS avgNetProfitPct,
      COALESCE(MAX(net_profit_pct), 0)                    AS maxNetProfitPct,
      COALESCE(SUM(usd_cost), 0)                          AS totalVolumeUsd
    FROM trades
  `).get() as {
    totalTrades: number;
    profitableTrades: number;
    totalNetProfitUsd: number;
    avgNetProfitPct: number;
    maxNetProfitPct: number;
    totalVolumeUsd: number;
  };

  return {
    totalOpportunities: opp.totalOpportunities,
    avgSpreadPct: opp.avgSpreadPct,
    ...t,
  };
}

export interface PriceHistoryRow {
  exchange: string;
  bid: number;
  ask: number;
  timestamp: number;
}

export function getPriceHistory(
  db: Database.Database,
  exchange: string,
  sinceMs: number,
): PriceHistoryRow[] {
  return db
    .prepare(`
      SELECT exchange, bid, ask, timestamp
      FROM price_snapshots
      WHERE exchange = ? AND timestamp >= ?
      ORDER BY timestamp ASC
    `)
    .all(exchange, sinceMs) as PriceHistoryRow[];
}
