import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface TickerData {
  exchange: 'binance' | 'kraken';
  bid: number;
  ask: number;
  timestamp: number;
}

export interface StatusEvent {
  exchange: 'binance' | 'kraken';
  connected: boolean;
}

// Best bid/ask stream — lowest latency Binance feed
const STREAM_URL = 'wss://stream.binance.com:9443/ws/btcusdt@bookTicker';
const RECONNECT_DELAY_MS = 3000;

export class BinanceConnector extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private alive = true;

  connect(): void {
    this.alive = true;
    this.ws = new WebSocket(STREAM_URL);

    this.ws.on('open', () => {
      console.log('[Binance] connected');
      this.emit('status', { exchange: 'binance', connected: true } satisfies StatusEvent);
    });

    this.ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString()) as { b: string; a: string };
        this.emit('ticker', {
          exchange: 'binance',
          bid: parseFloat(msg.b),
          ask: parseFloat(msg.a),
          timestamp: Date.now(),
        } satisfies TickerData);
      } catch {
        // malformed frame — ignore
      }
    });

    this.ws.on('close', () => {
      console.warn('[Binance] disconnected');
      this.emit('status', { exchange: 'binance', connected: false } satisfies StatusEvent);
      if (this.alive) this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[Binance] error:', err.message);
    });
  }

  private scheduleReconnect(): void {
    this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
  }

  disconnect(): void {
    this.alive = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}
