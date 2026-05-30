import WebSocket from 'ws';
import { EventEmitter } from 'events';
import type { StatusEvent, TickerData } from './binance';

const WS_URL = 'wss://ws.kraken.com';
const RECONNECT_DELAY_MS = 3000;

interface KrakenTickerPayload {
  b: [string, number, string];
  a: [string, number, string];
}

export class KrakenConnector extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private alive = true;

  connect(): void {
    this.alive = true;
    this.ws = new WebSocket(WS_URL);

    this.ws.on('open', () => {
      console.log('[Kraken] connected');
      this.ws!.send(
        JSON.stringify({
          event: 'subscribe',
          pair: ['XBT/USD'],
          subscription: { name: 'ticker' },
        })
      );
      this.emit('status', { exchange: 'kraken', connected: true } satisfies StatusEvent);
    });

    this.ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const msg: unknown = JSON.parse(raw.toString());
        // Ticker update: [channelID, payload, 'ticker', 'XBT/USD']
        if (
          Array.isArray(msg) &&
          msg.length === 4 &&
          msg[2] === 'ticker'
        ) {
          const payload = msg[1] as KrakenTickerPayload;
          this.emit('ticker', {
            exchange: 'kraken',
            bid: parseFloat(payload.b[0]),
            ask: parseFloat(payload.a[0]),
            timestamp: Date.now(),
          } satisfies TickerData);
        }
      } catch {
        // malformed frame — ignore
      }
    });

    this.ws.on('close', () => {
      console.warn('[Kraken] disconnected');
      this.emit('status', { exchange: 'kraken', connected: false } satisfies StatusEvent);
      if (this.alive) this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[Kraken] error:', err.message);
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
