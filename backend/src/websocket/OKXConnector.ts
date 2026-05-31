import WebSocket from 'ws';
import { EventEmitter } from 'events';
import type { ConnectionStatus, OrderBook } from '../types';

const WS_URL           = 'wss://ws.okx.com:8443/ws/v5/public';
const INST_ID          = 'BTC-USDT';
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS     = 30_000;
const CONNECT_TIMEOUT_MS = 10_000;
const PING_INTERVAL_MS   = 20_000; // OKX drops silent connections after 30s

interface OKXBooksData {
  asks: [string, string, string, string][];
  bids: [string, string, string, string][];
  ts:   string;
}

interface OKXMessage {
  event?:  string;
  arg?:    { channel: string; instId: string };
  data?:   OKXBooksData[];
  code?:   string;
  msg?:    string;
}

export class OKXConnector extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private backoffMs = INITIAL_BACKOFF_MS;
  private reconnectAttempts = 0;
  private alive = true;

  connect(): void {
    this.alive = true;
    console.log(`[OKX] connecting to ${WS_URL}`);
    this.ws = new WebSocket(WS_URL);

    this.connectTimeoutTimer = setTimeout(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) {
        console.error(`[OKX] connection timeout after ${CONNECT_TIMEOUT_MS}ms — terminating`);
        this.ws?.terminate();
      }
    }, CONNECT_TIMEOUT_MS);

    this.ws.on('open', () => {
      if (this.connectTimeoutTimer) {
        clearTimeout(this.connectTimeoutTimer);
        this.connectTimeoutTimer = null;
      }

      console.log('[OKX] connected — subscribing to books5');
      this.backoffMs = INITIAL_BACKOFF_MS;
      this.reconnectAttempts = 0;

      this.ws!.send(JSON.stringify({
        op:   'subscribe',
        args: [{ channel: 'books5', instId: INST_ID }],
      }));

      // Keep-alive: OKX closes silent connections after 30s
      this.pingTimer = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ op: 'ping' }));
        }
      }, PING_INTERVAL_MS);

      this.emit('status', {
        exchange: 'okx',
        connected: true,
        reconnectAttempts: 0,
      } satisfies ConnectionStatus);
    });

    this.ws.on('message', (raw: WebSocket.RawData) => {
      const text = raw.toString();

      // OKX heartbeat response
      if (text === 'pong') return;

      try {
        const msg = JSON.parse(text) as OKXMessage;

        // Subscription confirmation or pong event
        if (msg.event === 'subscribe' || msg.event === 'pong') return;

        if (msg.event === 'error') {
          console.error(`[OKX] subscription error code=${msg.code} msg=${msg.msg}`);
          return;
        }

        if (msg.arg?.channel !== 'books5' || !msg.data?.length) return;

        const snap = msg.data[0];
        if (!snap) return;

        // OKX level format: [price, size, deprecated, orderCount]
        const bids: Array<[number, number]> = snap.bids.map(
          ([p, q]) => [parseFloat(p), parseFloat(q)],
        );
        const asks: Array<[number, number]> = snap.asks.map(
          ([p, q]) => [parseFloat(p), parseFloat(q)],
        );

        if (!bids.length || !asks.length) return;

        this.emit('orderBook', {
          exchange: 'okx',
          bestBid:  bids[0][0],
          bestAsk:  asks[0][0],
          timestamp: parseInt(snap.ts, 10),
          bids,
          asks,
        } satisfies OrderBook);
      } catch {
        // malformed frame — ignore
      }
    });

    this.ws.on('close', (code, reason) => {
      this.clearTimers();
      console.warn(`[OKX] disconnected — code=${code} reason=${reason.toString() || '(none)'} attempt=${this.reconnectAttempts + 1}`);
      this.emit('status', {
        exchange: 'okx',
        connected: false,
        reconnectAttempts: this.reconnectAttempts,
      } satisfies ConnectionStatus);
      if (this.alive) this.scheduleReconnect();
    });

    this.ws.on('error', (err: NodeJS.ErrnoException) => {
      console.error('[OKX] ws error:', err.message, '| code:', err.code ?? 'n/a', '| url:', WS_URL);
    });
  }

  private scheduleReconnect(): void {
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
    this.reconnectAttempts++;
    console.log(`[OKX] reconnecting in ${delay}ms`);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private clearTimers(): void {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    if (this.connectTimeoutTimer) { clearTimeout(this.connectTimeoutTimer); this.connectTimeoutTimer = null; }
  }

  disconnect(): void {
    this.alive = false;
    this.clearTimers();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}
