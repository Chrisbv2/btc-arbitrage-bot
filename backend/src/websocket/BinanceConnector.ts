import WebSocket from 'ws';
import { EventEmitter } from 'events';
import type { ConnectionStatus, OrderBook } from '../types';

// Port 443 instead of 9443 — Railway (and most cloud providers) block non-standard
// outbound ports; 443 is always open for TLS traffic.
const STREAM_URL = 'wss://stream.binance.com:443/ws/btcusdt@depth5@100ms';
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const CONNECT_TIMEOUT_MS = 10_000;

interface BinanceDepthFrame {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
}

export class BinanceConnector extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = INITIAL_BACKOFF_MS;
  private reconnectAttempts = 0;
  private alive = true;

  connect(): void {
    this.alive = true;
    console.log(`[Binance] connecting to ${STREAM_URL}`);
    this.ws = new WebSocket(STREAM_URL);

    // Treat a hung handshake the same as a disconnect so backoff kicks in.
    this.connectTimeoutTimer = setTimeout(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) {
        console.error(`[Binance] connection timeout after ${CONNECT_TIMEOUT_MS}ms — closing`);
        this.ws?.terminate();
      }
    }, CONNECT_TIMEOUT_MS);

    this.ws.on('open', () => {
      if (this.connectTimeoutTimer) {
        clearTimeout(this.connectTimeoutTimer);
        this.connectTimeoutTimer = null;
      }
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

    this.ws.on('error', (err: NodeJS.ErrnoException) => {
      console.error('[Binance] ws error:', err.message, '| code:', err.code ?? 'n/a', '| url:', STREAM_URL);
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
    if (this.connectTimeoutTimer) clearTimeout(this.connectTimeoutTimer);
    this.ws?.close();
  }
}
