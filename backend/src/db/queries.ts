import Database from 'better-sqlite3';
import type { Opportunity } from '../engine/detector';
import type { TickerData } from '../websocket/binance';

export function insertOpportunity(db: Database.Database, opp: Opportunity): void {
  db.prepare(`
    INSERT INTO opportunities
      (buy_exchange, sell_exchange, buy_ask, sell_bid,
       raw_spread, raw_spread_pct, net_profit_pct, net_profit_usd,
       trade_size, is_profitable, timestamp)
    VALUES
      (@buyExchange, @sellExchange, @buyAsk, @sellBid,
       @rawSpread, @rawSpreadPct, @netProfitPct, @netProfitUsd,
       @tradeSize, @isProfitable, @timestamp)
  `).run({
    buyExchange: opp.buyExchange,
    sellExchange: opp.sellExchange,
    buyAsk: opp.buyAsk,
    sellBid: opp.sellBid,
    rawSpread: opp.rawSpread,
    rawSpreadPct: opp.rawSpreadPct,
    netProfitPct: opp.netProfitPct,
    netProfitUsd: opp.netProfitUsd,
    tradeSize: opp.tradeSize,
    isProfitable: opp.isProfitable ? 1 : 0,
    timestamp: opp.timestamp,
  });
}

export function insertPriceSnapshot(db: Database.Database, ticker: TickerData): void {
  db.prepare(`
    INSERT INTO price_snapshots (exchange, bid, ask, timestamp)
    VALUES (@exchange, @bid, @ask, @timestamp)
  `).run(ticker);
}

export interface OpportunityRow {
  id: number;
  buy_exchange: string;
  sell_exchange: string;
  buy_ask: number;
  sell_bid: number;
  raw_spread: number;
  raw_spread_pct: number;
  net_profit_pct: number;
  net_profit_usd: number;
  trade_size: number;
  is_profitable: number;
  timestamp: number;
}

export function getRecentOpportunities(
  db: Database.Database,
  limit = 100,
  onlyProfitable = false,
): OpportunityRow[] {
  const where = onlyProfitable ? 'WHERE is_profitable = 1' : '';
  return db
    .prepare(`SELECT * FROM opportunities ${where} ORDER BY timestamp DESC LIMIT ?`)
    .all(limit) as OpportunityRow[];
}

export interface StatsRow {
  total: number;
  profitable: number;
  avgNetProfitPct: number;
  maxNetProfitPct: number;
  totalNetProfitUsd: number;
}

export function getStats(db: Database.Database): StatsRow {
  return db.prepare(`
    SELECT
      COUNT(*)                                AS total,
      SUM(is_profitable)                      AS profitable,
      AVG(net_profit_pct)                     AS avgNetProfitPct,
      MAX(net_profit_pct)                     AS maxNetProfitPct,
      SUM(CASE WHEN is_profitable = 1 THEN net_profit_usd ELSE 0 END) AS totalNetProfitUsd
    FROM opportunities
  `).get() as StatsRow;
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
  since: number,
): PriceHistoryRow[] {
  return db
    .prepare(
      `SELECT exchange, bid, ask, timestamp
       FROM price_snapshots
       WHERE exchange = ? AND timestamp >= ?
       ORDER BY timestamp ASC`,
    )
    .all(exchange, since) as PriceHistoryRow[];
}
