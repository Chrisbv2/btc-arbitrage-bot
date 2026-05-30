import { Router, type Request, type Response } from 'express';
import type Database from 'better-sqlite3';
import type { ArbitrageDetector } from '../engine/detector';
import type { WalletManager } from '../wallet/manager';
import type { StatusEvent } from '../websocket/binance';
import {
  getRecentOpportunities,
  getStats,
  getPriceHistory,
} from '../db/queries';

// SSE client registry
const sseClients = new Set<Response>();

export function broadcastSSE(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    res.write(payload);
  }
}

export function buildRouter(
  db: Database.Database,
  detector: ArbitrageDetector,
  wallet: WalletManager,
  connectionStatus: Record<string, boolean>,
): Router {
  const router = Router();

  // Server-Sent Events stream — frontend subscribes once, gets all real-time updates
  router.get('/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.add(res);

    // Send current state immediately on connect
    res.write(`event: prices\ndata: ${JSON.stringify(detector.getCurrentPrices())}\n\n`);
    res.write(`event: status\ndata: ${JSON.stringify(connectionStatus)}\n\n`);
    res.write(`event: balances\ndata: ${JSON.stringify(wallet.getAllBalances())}\n\n`);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  router.get('/prices', (_req, res) => {
    res.json(detector.getCurrentPrices());
  });

  router.get('/opportunities', (req, res) => {
    const limit = Math.min(parseInt(req.query['limit'] as string) || 100, 500);
    const profitable = req.query['profitable'] === 'true';
    res.json(getRecentOpportunities(db, limit, profitable));
  });

  router.get('/stats', (_req, res) => {
    res.json(getStats(db));
  });

  router.get('/history/:exchange', (req, res) => {
    const since = Date.now() - (parseInt(req.query['minutes'] as string) || 30) * 60_000;
    res.json(getPriceHistory(db, req.params['exchange'], since));
  });

  router.get('/balances', (_req, res) => {
    res.json(wallet.getAllBalances());
  });

  router.get('/status', (_req, res) => {
    res.json(connectionStatus);
  });

  return router;
}

export function emitStatus(status: StatusEvent, connectionStatus: Record<string, boolean>): void {
  connectionStatus[status.exchange] = status.connected;
  broadcastSSE('status', connectionStatus);
}
