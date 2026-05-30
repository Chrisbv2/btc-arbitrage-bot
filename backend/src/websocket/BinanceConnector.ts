import WebSocket from 'ws';
import { EventEmitter } from 'events';
import type { ConnectionStatus, OrderBook } from '../types';

// Partial order book snapshot — full top-5 on every tick, no local book needed
const STREAM_URL = 'wss://stream.binance.com:9443/ws/btcusdt@depth5@100ms';
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

interface BinanceDepthFrame {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
}

export class BinanceConnector extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = INITIAL_BACKOFF_MS;
  private reconnectAttempts = 0;
  private alive = true;

  connect(): void {
    this.alive = true;
    this.ws = new WebSocket(STREAM_URL);

    this.ws.on('open', () => {
      console.log('[Binance] connected');
      this.backoffMs = INITIAL_BACKOFF_MS;
      this.reconnectAttempts = 0;
      this.emit('status', {
        exchange: 'binance',
        connected: true,
        reconnectAttempts: 0,
      } satisfies ConnectionStatus);
    });

    this.ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const frame = JSON.parse(raw.toString()) as BinanceDepthFrame;

        // Binance depth5: bids sorted desc, asks sorted asc — already correct order
        const bids: Array<[number, number]> = frame.bids.map(
          ([p, q]) => [parseFloat(p), parseFloat(q)]
        );
        const asks: Array<[number, number]> = frame.asks.map(
          ([p, q]) => [parseFloat(p), parseFloat(q)]
        );

        if (!bids.length || !asks.length) return;

        this.emit('orderBook', {
          exchange: 'binance',
          bestBid: bids[0][0],
          bestAsk: asks[0][0],
          timestamp: Date.now(),
          bids,
          asks,
        } satisfies OrderBook);
      } catch {
        // malformed frame — ignore
      }
    });

    this.ws.on('close', () => {
      console.warn(`[Binance] disconnected — attempt ${this.reconnectAttempts + 1}`);
      this.emit('status', {
        exchange: 'binance',
        connected: false,
        reconnectAttempts: this.reconnectAttempts,
      } satisfies ConnectionStatus);
      if (this.alive) this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[Binance] ws error:', err.message);
    });
  }

  private scheduleReconnect(): void {
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
    this.reconnectAttempts++;
    console.log(`[Binance] reconnecting in ${delay}ms`);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  disconnect(): void {
    this.alive = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}
