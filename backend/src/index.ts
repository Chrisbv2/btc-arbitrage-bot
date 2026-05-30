import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';

import { BinanceConnector } from './websocket/BinanceConnector';
import { KrakenConnector }  from './websocket/KrakenConnector';
import { ArbitrageEngine }  from './engine/ArbitrageEngine';
import { WalletManager }    from './wallet/WalletManager';
import { initDb }           from './db/schema';
import { insertPriceSnapshot } from './db/queries';
import {
  buildRouter,
  handleConnectorStatus,
  emitPriceUpdate,
  emitOpportunityDetected,
  emitTradeExecuted,
  emitWalletUpdate,
  emitCircuitBreaker,
} from './api/routes';

const PORT      = parseInt(process.env['PORT'] ?? '3001', 10);
const DB_PATH   = process.env['DB_PATH'] ?? path.join(__dirname, '..', 'data', 'arb.db');
const DEMO_MODE = process.env['DEMO_MODE'] === 'true';

// Elapsed since start — exposed to routes for uptime
const startTime = Date.now();

// Price snapshot throttle: write at most once per second per exchange
const SNAPSHOT_INTERVAL_MS = 1_000;
const lastSnapshot: Partial<Record<string, number>> = {};

// ── Database ─────────────────────────────────────────────────────────────────
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
initDb(db);

// ── Core components ───────────────────────────────────────────────────────────
const wallet = new WalletManager();
const engine = new ArbitrageEngine(wallet, db);
const connectionStatus: Record<string, boolean> = { binance: false, kraken: false };

// ── WebSocket connectors ──────────────────────────────────────────────────────
const binance = new BinanceConnector();
const kraken  = new KrakenConnector();

function onOrderBook(book: Parameters<typeof engine.update>[0]): void {
  engine.update(book);

  // SSE: per-exchange price_update event
  emitPriceUpdate(book);

  // Throttled DB snapshot
  const now = Date.now();
  const key = book.exchange;
  if (now - (lastSnapshot[key] ?? 0) >= SNAPSHOT_INTERVAL_MS) {
    lastSnapshot[key] = now;
    insertPriceSnapshot(db, book);
  }
}

binance.on('orderBook', onOrderBook);
kraken.on('orderBook',  onOrderBook);

binance.on('status', (s) => handleConnectorStatus(s, connectionStatus));
kraken.on('status',  (s) => handleConnectorStatus(s, connectionStatus));

// ── Engine → SSE ──────────────────────────────────────────────────────────────
engine.on('opportunity', (opp) => {
  emitOpportunityDetected(opp);
});

engine.on('trade', (trade) => {
  emitTradeExecuted(trade);
  emitWalletUpdate(wallet.getAllBalances());
});

engine.on('circuitBreaker', (evt) => {
  emitCircuitBreaker({ active: true, ...evt });
});

// ── Express ───────────────────────────────────────────────────────────────────

// CORS: local dev + optional Vercel production URL
const allowedOrigins = [
  'http://localhost:5173',
  'https://localhost:5173',
  ...(process.env['FRONTEND_URL'] ? [process.env['FRONTEND_URL']] : []),
  ...(process.env['VERCEL_URL']   ? [`https://${process.env['VERCEL_URL']}`] : []),
];

const app = express();
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow server-to-server / curl requests (no origin header)
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not permitted`));
    },
    methods: ['GET'],
    credentials: false,
  }),
);
app.use(express.json());
app.use('/api', buildRouter(db, engine, wallet, connectionStatus, startTime, DEMO_MODE));

app.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}`);
  binance.connect();
  kraken.connect();
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(): void {
  console.log('\n[server] shutting down…');
  binance.disconnect();
  kraken.disconnect();
  db.close();
  process.exit(0);
}

process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);
