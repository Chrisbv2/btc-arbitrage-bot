import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';

import { BinanceConnector } from './websocket/binance';
import { KrakenConnector } from './websocket/kraken';
import { ArbitrageDetector } from './engine/detector';
import { WalletManager } from './wallet/manager';
import { initDb } from './db/schema';
import { insertOpportunity, insertPriceSnapshot } from './db/queries';
import { buildRouter, broadcastSSE, emitStatus } from './api/routes';

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const DB_PATH = process.env['DB_PATH'] ?? path.join(__dirname, '..', 'data', 'arb.db');
const TRADE_SIZE_BTC = parseFloat(process.env['TRADE_SIZE_BTC'] ?? '0.01');

// Price snapshot throttle: record to DB at most once per second per exchange
const SNAPSHOT_INTERVAL_MS = 1000;
const lastSnapshot: Record<string, number> = {};

// ── Database ────────────────────────────────────────────────────────────────
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
initDb(db);

// ── Core components ─────────────────────────────────────────────────────────
const detector = new ArbitrageDetector(TRADE_SIZE_BTC);
const wallet = new WalletManager();
const connectionStatus: Record<string, boolean> = { binance: false, kraken: false };

// ── WebSocket connectors ─────────────────────────────────────────────────────
const binance = new BinanceConnector();
const kraken = new KrakenConnector();

binance.on('ticker', (ticker) => {
  detector.update(ticker);
  broadcastSSE('prices', detector.getCurrentPrices());

  const now = Date.now();
  if ((now - (lastSnapshot['binance'] ?? 0)) >= SNAPSHOT_INTERVAL_MS) {
    lastSnapshot['binance'] = now;
    insertPriceSnapshot(db, ticker);
  }
});

kraken.on('ticker', (ticker) => {
  detector.update(ticker);
  broadcastSSE('prices', detector.getCurrentPrices());

  const now = Date.now();
  if ((now - (lastSnapshot['kraken'] ?? 0)) >= SNAPSHOT_INTERVAL_MS) {
    lastSnapshot['kraken'] = now;
    insertPriceSnapshot(db, ticker);
  }
});

binance.on('status', (s) => emitStatus(s, connectionStatus));
kraken.on('status', (s) => emitStatus(s, connectionStatus));

// ── Arbitrage engine ─────────────────────────────────────────────────────────
detector.on('opportunity', (opp) => {
  insertOpportunity(db, opp);
  broadcastSSE('opportunity', opp);
});

// ── Express ──────────────────────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: process.env['FRONTEND_URL'] ?? 'http://localhost:5173' }));
app.use(express.json());
app.use('/api', buildRouter(db, detector, wallet, connectionStatus));

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  binance.connect();
  kraken.connect();
});

// ── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown(): void {
  console.log('\n[server] shutting down...');
  binance.disconnect();
  kraken.disconnect();
  db.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
