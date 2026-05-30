import WebSocket from 'ws';
import { EventEmitter } from 'events';
import type { ConnectionStatus, OrderBook } from '../types';

// Kraken V2 WebSocket API supports BTC/USDT symbol naming
const WS_URL = 'wss://ws.kraken.com/v2';
const BOOK_SYMBOL = 'BTC/USDT';
const BOOK_DEPTH = 10;
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

interface KrakenLevel {
  price: number;
  qty: number;
}

interface KrakenBookData {
  symbol: string;
  bids: KrakenLevel[];
  asks: KrakenLevel[];
  checksum?: number;
  timestamp?: string;
}

export class KrakenConnector extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = INITIAL_BACKOFF_MS;
  private reconnectAttempts = 0;
  private alive = true;

  // Incremental local order book (price → qty)
  private localBids = new Map<number, number>();
  private localAsks = new Map<number, number>();
  private hasSnapshot = false;

  connect(): void {
    this.alive = true;
    this.hasSnapshot = false;
    this.ws = new WebSocket(WS_URL);

    this.ws.on('open', () => {
      console.log('[Kraken] connected');
      this.backoffMs = INITIAL_BACKOFF_MS;
      this.reconnectAttempts = 0;

      this.ws!.send(JSON.stringify({
        method: 'subscribe',
        params: {
          channel: 'book',
          symbol: [BOOK_SYMBOL],
          depth: BOOK_DEPTH,
        },
      }));

      this.emit('status', {
        exchange: 'kraken',
        connected: true,
        reconnectAttempts: 0,
      } satisfies ConnectionStatus);
    });

    this.ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;

        if (msg['channel'] !== 'book') return;

        const type = msg['type'] as string;
        const dataArr = msg['data'] as KrakenBookData[] | undefined;
        const data = dataArr?.[0];
        if (!data) return;

        if (type === 'snapshot') {
          this.localBids.clear();
          this.localAsks.clear();
          for (const { price, qty } of data.bids) this.localBids.set(price, qty);
          for (const { price, qty } of data.asks) this.localAsks.set(price, qty);
          this.hasSnapshot = true;
        } else if (type === 'update' && this.hasSnapshot) {
          for (const { price, qty } of data.bids) {
            if (qty === 0) this.localBids.delete(price);
            else this.localBids.set(price, qty);
          }
          for (const { price, qty } of data.asks) {
            if (qty === 0) this.localAsks.delete(price);
            else this.localAsks.set(price, qty);
          }
        } else {
          return;
        }

        this.emitOrderBook();
      } catch {
        // malformed frame — ignore
      }
    });

    this.ws.on('close', () => {
      console.warn(`[Kraken] disconnected — attempt ${this.reconnectAttempts + 1}`);
      this.hasSnapshot = false;
      this.localBids.clear();
      this.localAsks.clear();
      this.emit('status', {
        exchange: 'kraken',
        connected: false,
        reconnectAttempts: this.reconnectAttempts,
      } satisfies ConnectionStatus);
      if (this.alive) this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[Kraken] ws error:', err.message);
    });
  }

  private emitOrderBook(): void {
    // Sort in-place each time — Maps are small (depth=10)
    const bids: Array<[number, number]> = [...this.localBids.entries()]
      .sort((a, b) => b[0] - a[0])
      .slice(0, BOOK_DEPTH);
    const asks: Array<[number, number]> = [...this.localAsks.entries()]
      .sort((a, b) => a[0] - b[0])
      .slice(0, BOOK_DEPTH);

    if (!bids.length || !asks.length) return;

    this.emit('orderBook', {
      exchange: 'kraken',
      bestBid: bids[0][0],
      bestAsk: asks[0][0],
      timestamp: Date.now(),
      bids,
      asks,
    } satisfies OrderBook);
  }

  private scheduleReconnect(): void {
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
    this.reconnectAttempts++;
    console.log(`[Kraken] reconnecting in ${delay}ms`);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  disconnect(): void {
    this.alive = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}
