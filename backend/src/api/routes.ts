import { Router, type Request, type Response } from 'express';
import { type ZodTypeAny, z, ZodError } from 'zod';
import type Database from 'better-sqlite3';
import type { ArbitrageEngine } from '../engine/ArbitrageEngine';
import type { WalletManager } from '../wallet/WalletManager';
import type { ConnectionStatus, OrderBook } from '../types';
import {
  getRecentOpportunities,
  getRecentTrades,
  getAggregateStats,
  getBestTrade,
  getWorstTrade,
  getPriceHistory,
} from '../db/queries';
import {
  LimitQuerySchema,
  HistoryQuerySchema,
  StatusResponseSchema,
  PricesResponseSchema,
  WalletsResponseSchema,
  OpportunitySchema,
  TradeSchema,
  StatsResponseSchema,
  PriceUpdateEventSchema,
  WalletUpdateEventSchema,
  type PriceUpdateEvent,
} from './schemas';

// ── SSE broadcast ─────────────────────────────────────────────────────────────

const sseClients = new Set<Response>();

export function broadcastSSE(event: string, data: unknown): void {
  if (!sseClients.size) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) res.write(payload);
}

export function handleConnectorStatus(
  status: ConnectionStatus,
  connectionStatus: Record<string, boolean>,
): void {
  connectionStatus[status.exchange] = status.connected;
  broadcastSSE('status', connectionStatus);
}

// ── Response validation helper ────────────────────────────────────────────────

function respond<T extends ZodTypeAny>(
  schema: T,
  res: Response,
  data: unknown,
): void {
  const result = schema.safeParse(data);
  if (!result.success) {
    res.status(500).json({
      error: 'Response schema validation failed',
      details: result.error.flatten(),
    });
    return;
  }
  res.json(result.data);
}

function withErrorBoundary(
  handler: (req: Request, res: Response) => void | Promise<void>,
) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      await handler(req, res);
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Validation error', details: err.flatten() });
      } else {
        const message = err instanceof Error ? err.message : 'Internal server error';
        res.status(500).json({ error: message });
      }
    }
  };
}

// ── Order book → summary (strips raw arrays, adds computed fields) ─────────────

export function toOrderBookSummary(book: OrderBook): PriceUpdateEvent {
  const mid = (book.bestBid + book.bestAsk) / 2;
  return PriceUpdateEventSchema.parse({
    exchange: book.exchange,
    bestBid: book.bestBid,
    bestAsk: book.bestAsk,
    midPrice: mid,
    spread: book.bestAsk - book.bestBid,
    spreadPct: mid > 0 ? (book.bestAsk - book.bestBid) / mid : 0,
    timestamp: book.timestamp,
  });
}

// ── Router ────────────────────────────────────────────────────────────────────

export function buildRouter(
  db: Database.Database,
  engine: ArbitrageEngine,
  wallet: WalletManager,
  connectionStatus: Record<string, boolean>,
  startTime: number,
  demoMode: boolean,
  allowedOrigins: string[],
): Router {
  const router = Router();

  // ── GET /api/stream — Server-Sent Events ────────────────────────────────────
  router.get('/stream', (req: Request, res: Response) => {
    // Set CORS explicitly here — flushHeaders() locks the headers immediately and
    // the global cors() middleware may not have written Access-Control-Allow-Origin
    // before the SSE connection is established in some proxy configurations.
    const origin = req.headers['origin'];
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.add(res);

    // Hydrate client with current state
    const books = engine.getCurrentBooks();
    for (const book of Object.values(books)) {
      const summary = toOrderBookSummary(book);
      res.write(`event: price_update\ndata: ${JSON.stringify(summary)}\n\n`);
    }
    res.write(`event: status\ndata: ${JSON.stringify(connectionStatus)}\n\n`);
    res.write(`event: wallet_update\ndata: ${JSON.stringify(wallet.getAllBalances())}\n\n`);

    if (engine.isCircuitBreakerActive()) {
      res.write(
        `event: circuit_breaker\ndata: ${JSON.stringify({
          active: true,
          activeUntil: engine.circuitBreakerResumeAt(),
        })}\n\n`,
      );
    }

    req.on('close', () => sseClients.delete(res));
  });

  // ── GET /api/status ─────────────────────────────────────────────────────────
  router.get(
    '/status',
    withErrorBoundary((_req, res) => {
      const cbActive = engine.isCircuitBreakerActive();
      const resumeAt = engine.circuitBreakerResumeAt();
      respond(StatusResponseSchema, res, {
        running: true,
        uptimeSeconds: (Date.now() - startTime) / 1000,
        connections: {
          binance: connectionStatus['binance'] ?? false,
          kraken: connectionStatus['kraken'] ?? false,
        },
        circuitBreaker: {
          active: cbActive,
          resumeAt: cbActive ? resumeAt : null,
          pauseSeconds: 30,
        },
        demoMode,
        version: '1.0.0',
      });
    }),
  );

  // ── GET /api/prices ─────────────────────────────────────────────────────────
  router.get(
    '/prices',
    withErrorBoundary((_req, res) => {
      const books = engine.getCurrentBooks();
      const prices: Record<string, unknown> = {};
      for (const [key, book] of Object.entries(books)) {
        prices[key] = toOrderBookSummary(book);
      }
      respond(PricesResponseSchema, res, prices);
    }),
  );

  // ── GET /api/wallets ────────────────────────────────────────────────────────
  router.get(
    '/wallets',
    withErrorBoundary((_req, res) => {
      respond(WalletsResponseSchema, res, wallet.getAllBalances());
    }),
  );

  // ── GET /api/opportunities ──────────────────────────────────────────────────
  router.get(
    '/opportunities',
    withErrorBoundary((req, res) => {
      const { limit } = LimitQuerySchema.parse(req.query);
      const rows = getRecentOpportunities(db, limit);
      respond(z.array(OpportunitySchema), res, rows);
    }),
  );

  // ── GET /api/trades ─────────────────────────────────────────────────────────
  router.get(
    '/trades',
    withErrorBoundary((req, res) => {
      const { limit } = LimitQuerySchema.parse(req.query);
      const rows = getRecentTrades(db, limit);
      respond(z.array(TradeSchema), res, rows);
    }),
  );

  // ── GET /api/stats ──────────────────────────────────────────────────────────
  router.get(
    '/stats',
    withErrorBoundary((_req, res) => {
      const agg = getAggregateStats(db);
      const bestTrade = getBestTrade(db);
      const worstTrade = getWorstTrade(db);

      respond(StatsResponseSchema, res, {
        totalOpportunities: agg.totalOpportunities,
        totalTrades: agg.totalTrades,
        profitableTrades: agg.profitableTrades,
        winRate: agg.totalTrades > 0
          ? agg.profitableTrades / agg.totalTrades
          : 0,
        totalNetProfitUsd: agg.totalNetProfitUsd,
        avgNetProfitPct: agg.avgNetProfitPct,
        maxNetProfitPct: agg.maxNetProfitPct,
        totalVolumeUsd: agg.totalVolumeUsd,
        avgSpreadPct: agg.avgSpreadPct,
        bestTrade,
        worstTrade,
      });
    }),
  );

  // ── GET /api/history/:exchange (price chart data) ───────────────────────────
  router.get(
    '/history/:exchange',
    withErrorBoundary((req, res) => {
      const { minutes } = HistoryQuerySchema.parse(req.query);
      const sinceMs = Date.now() - minutes * 60_000;
      res.json(getPriceHistory(db, req.params['exchange'], sinceMs));
    }),
  );

  // ── POST /api/demo-mode — toggle demo mode at runtime ───────────────────────
  router.post('/demo-mode', (_req, res) => {
    const newMode = !engine.getDemoMode();
    engine.setDemoMode(newMode);
    res.json({ demoMode: newMode });
  });

  return router;
}

// ── SSE event emitters (called from index.ts) ─────────────────────────────────

export function emitPriceUpdate(book: OrderBook): void {
  broadcastSSE('price_update', toOrderBookSummary(book));
}

export function emitOpportunityDetected(opp: unknown): void {
  broadcastSSE('opportunity_detected', opp);
}

export function emitTradeExecuted(trade: unknown): void {
  broadcastSSE('trade_executed', trade);
}

export function emitWalletUpdate(balances: unknown): void {
  const result = WalletUpdateEventSchema.safeParse(balances);
  if (result.success) broadcastSSE('wallet_update', result.data);
}

export function emitCircuitBreaker(evt: unknown): void {
  broadcastSSE('circuit_breaker', evt);
}
