import { EventEmitter } from 'events';
import type Database from 'better-sqlite3';
import type {
  Exchange,
  OrderBook,
  ArbitrageOpportunity,
  TradeRecord,
  CircuitBreakerEvent,
} from '../types';
import type { WalletManager } from '../wallet/WalletManager';
import { insertTrade, insertOpportunity } from '../db/queries';

// ── Fee constants (hardcoded per spec) ───────────────────────────────────────
const FEES: Record<Exchange, number> = {
  binance: 0.001,   // 0.10% maker
  kraken: 0.0026,   // 0.26% taker
};

// ── Engine constants ─────────────────────────────────────────────────────────
const SLIPPAGE            = 0.0005;   // 0.05% per side
const DEMO_MODE           = process.env['DEMO_MODE'] === 'true';
const MIN_NET_PROFIT_PCT  = DEMO_MODE ? 0.0001 : 0.0015; // 0.01% demo, 0.15% prod
const BASE_TRADE_USD      = 5_000;
const MAX_TRADE_USD       = 10_000;
const SCALE_UP_THRESHOLD  = 0.005;    // 0.50% net → use max trade size
const TRADE_COOLDOWN_MS   = 2_000;    // prevent burst execution on persistent spreads
const MIN_BTC_AMOUNT      = 0.00005;  // ~$5 floor below which we skip

// ── Circuit breaker ──────────────────────────────────────────────────────────
const CB_LOSS_LIMIT    = 3;
const CB_PAUSE_MS      = 30_000;

export class ArbitrageEngine extends EventEmitter {
  private books = new Map<Exchange, OrderBook>();
  private consecutiveLosses = 0;
  private circuitBreakerUntil = 0;
  private lastTradeTime: Partial<Record<string, number>> = {};

  constructor(
    private readonly wallet: WalletManager,
    private readonly db: Database.Database,
  ) {
    super();
  }

  update(book: OrderBook): void {
    this.books.set(book.exchange, book);
    this.evaluate();
  }

  isCircuitBreakerActive(): boolean {
    return Date.now() < this.circuitBreakerUntil;
  }

  circuitBreakerResumeAt(): number {
    return this.circuitBreakerUntil;
  }

  getCurrentBooks(): Record<string, OrderBook> {
    return Object.fromEntries(this.books);
  }

  // ── Evaluation ──────────────────────────────────────────────────────────────

  private evaluate(): void {
    if (this.isCircuitBreakerActive()) return;

    const binance = this.books.get('binance');
    const kraken  = this.books.get('kraken');
    if (!binance || !kraken) return;

    this.checkDirection('binance', binance, 'kraken', kraken);
    this.checkDirection('kraken',  kraken,  'binance', binance);
  }

  private checkDirection(
    buyExchange: Exchange,
    buyBook: OrderBook,
    sellExchange: Exchange,
    sellBook: OrderBook,
  ): void {
    const buyFee  = FEES[buyExchange];
    const sellFee = FEES[sellExchange];

    // Apply per-side slippage to best prices before fee calculation
    const effectiveBuy  = buyBook.bestAsk  * (1 + SLIPPAGE);
    const effectiveSell = sellBook.bestBid * (1 - SLIPPAGE);

    // All-in cost / revenue per BTC
    const costPerBtc    = effectiveBuy  * (1 + buyFee);
    const revenuePerBtc = effectiveSell * (1 - sellFee);

    const netProfitPct  = (revenuePerBtc - costPerBtc) / costPerBtc;
    const rawSpreadPct  = (sellBook.bestBid - buyBook.bestAsk) / buyBook.bestAsk;

    if (netProfitPct < MIN_NET_PROFIT_PCT) return;

    // ── Trade size decision ──────────────────────────────────────────────────
    const buyerBalance  = this.wallet.getBalance(buyExchange);
    const maxTradeUsd   = Math.min(MAX_TRADE_USD, buyerBalance.usdt * 0.5);
    const targetTradeUsd = netProfitPct > SCALE_UP_THRESHOLD
      ? maxTradeUsd
      : Math.min(BASE_TRADE_USD, maxTradeUsd);

    if (targetTradeUsd <= 0) return;

    // ── Order-book depth walk ────────────────────────────────────────────────
    // How many BTC can the ask side supply within targetTradeUsd?
    const btcFromAsks = this.walkAsks(buyBook.asks, targetTradeUsd);
    // Can the bid side absorb that same BTC volume?
    const btcFromBids = this.walkBids(sellBook.bids, btcFromAsks);

    // Wallet hard constraints (partial-fill path)
    const maxByBuyerWallet  = this.wallet.maxBuyableBtc(buyExchange, costPerBtc);
    const maxBySellerWallet = this.wallet.maxSellableBtc(sellExchange);

    const executableBtc = Math.min(
      btcFromAsks,
      btcFromBids,
      maxByBuyerWallet,
      maxBySellerWallet,
    );

    if (executableBtc < MIN_BTC_AMOUNT) return;

    const isPartialFill  = executableBtc < btcFromAsks;
    const usdValue       = executableBtc * costPerBtc;
    const netProfitUsd   = executableBtc * (revenuePerBtc - costPerBtc);

    const opp: ArbitrageOpportunity = {
      buyExchange,
      sellExchange,
      buyAsk:      buyBook.bestAsk,
      sellBid:     sellBook.bestBid,
      rawSpreadPct,
      netProfitPct,
      netProfitUsd,
      executableBtc,
      usdValue,
      isPartialFill,
      timestamp: Date.now(),
    };

    // Always persist & broadcast the opportunity
    // Determine status before persist so DB row reflects actual execution outcome
    const dirKey = `${buyExchange}→${sellExchange}`;
    const now = Date.now();
    const willExecute = (now - (this.lastTradeTime[dirKey] ?? 0)) >= TRADE_COOLDOWN_MS;
    const status: 'executed' | 'skipped' = willExecute ? 'executed' : 'skipped';

    const { id: oppId } = insertOpportunity(this.db, { ...opp, status });
    this.emit('opportunity', { ...opp, id: oppId, status });

    if (willExecute) {
      this.lastTradeTime[dirKey] = now;
      this.execute(opp, costPerBtc, revenuePerBtc, buyFee, sellFee);
    }
  }

  // ── Order-book walkers ───────────────────────────────────────────────────────

  // Returns max BTC purchasable from ask levels within a USD budget.
  private walkAsks(asks: Array<[number, number]>, budgetUsd: number): number {
    let remaining = budgetUsd;
    let totalBtc  = 0;
    for (const [price, qty] of asks) {
      const levelCost = price * qty;
      if (levelCost <= remaining) {
        totalBtc  += qty;
        remaining -= levelCost;
      } else {
        totalBtc += remaining / price;
        break;
      }
    }
    return totalBtc;
  }

  // Returns how many BTC the bid side can absorb (matched against target volume).
  private walkBids(bids: Array<[number, number]>, targetBtc: number): number {
    let remaining = targetBtc;
    let filled    = 0;
    for (const [, qty] of bids) {
      const take = Math.min(qty, remaining);
      filled    += take;
      remaining -= take;
      if (remaining <= 0) break;
    }
    return filled;
  }

  // ── Trade execution ──────────────────────────────────────────────────────────

  private execute(
    opp: ArbitrageOpportunity,
    costPerBtc: number,
    revenuePerBtc: number,
    buyFee: number,
    sellFee: number,
  ): void {
    const { buyExchange, sellExchange, executableBtc, buyAsk, sellBid, isPartialFill } = opp;

    const usdCost    = executableBtc * costPerBtc;
    const usdRevenue = executableBtc * revenuePerBtc;

    // Deduct costs atomically — both sides synchronous (Node.js single-threaded)
    const bought = this.wallet.buy(buyExchange, usdCost, executableBtc);
    if (!bought) {
      console.warn('[Engine] buy rejected (balance race) — skipping trade');
      return;
    }

    const sold = this.wallet.sell(sellExchange, usdRevenue, executableBtc);
    if (!sold) {
      // Roll back the buy to keep wallet consistent
      this.wallet.sell(buyExchange, usdCost, executableBtc);
      console.warn('[Engine] sell rejected (balance race) — rolled back buy');
      return;
    }

    // ── P&L breakdown ─────────────────────────────────────────────────────────
    const midBuy      = buyAsk  * (1 + SLIPPAGE);
    const midSell     = sellBid * (1 - SLIPPAGE);
    const buyFeeUsd   = executableBtc * midBuy  * buyFee;
    const sellFeeUsd  = executableBtc * midSell * sellFee;
    const slippageCostUsd = executableBtc * (buyAsk * SLIPPAGE + sellBid * SLIPPAGE);
    const netProfitUsd    = usdRevenue - usdCost;
    const netProfitPct    = netProfitUsd / usdCost;

    // ── Circuit breaker ────────────────────────────────────────────────────────
    if (netProfitUsd < 0) {
      this.consecutiveLosses++;
      if (this.consecutiveLosses >= CB_LOSS_LIMIT) {
        this.circuitBreakerUntil = Date.now() + CB_PAUSE_MS;
        const evt: CircuitBreakerEvent = {
          activeUntil: this.circuitBreakerUntil,
          consecutiveLosses: this.consecutiveLosses,
        };
        console.warn(`[Engine] Circuit breaker active for ${CB_PAUSE_MS / 1000}s after ${this.consecutiveLosses} consecutive losses`);
        this.consecutiveLosses = 0;
        this.emit('circuitBreaker', evt);
      }
    } else {
      this.consecutiveLosses = 0;
    }

    const trade: TradeRecord = {
      buyExchange,
      sellExchange,
      buyAsk,
      sellBid,
      btcAmount: executableBtc,
      usdCost,
      usdRevenue,
      buyFeeUsd,
      sellFeeUsd,
      slippageCostUsd,
      netProfitUsd,
      netProfitPct,
      isPartialFill,
      timestamp: Date.now(),
    };

    const { id: tradeId } = insertTrade(this.db, trade);
    this.emit('trade', { ...trade, id: tradeId });
  }
}
