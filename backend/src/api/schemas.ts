import { z } from 'zod';

// ── Primitives ────────────────────────────────────────────────────────────────

export const ExchangeSchema = z.enum(['binance', 'kraken']);

// SQLite stores booleans as 0/1 integers; coerce on the way out
const SqliteBool = z.union([z.boolean(), z.number()]).transform((v) => Boolean(v));

// ── REST response schemas ─────────────────────────────────────────────────────

export const OrderBookSummarySchema = z.object({
  exchange: ExchangeSchema,
  bestBid: z.number(),
  bestAsk: z.number(),
  midPrice: z.number(),
  spread: z.number(),       // absolute (USDT)
  spreadPct: z.number(),    // fraction, e.g. 0.0000056
  timestamp: z.number(),
});
export type OrderBookSummary = z.infer<typeof OrderBookSummarySchema>;

export const PricesResponseSchema = z.record(z.string(), OrderBookSummarySchema);
export type PricesResponse = z.infer<typeof PricesResponseSchema>;

export const WalletBalanceSchema = z.object({
  usdt: z.number(),
  btc: z.number(),
});
export type WalletBalance = z.infer<typeof WalletBalanceSchema>;

export const WalletsResponseSchema = z.object({
  binance: WalletBalanceSchema,
  kraken: WalletBalanceSchema,
});
export type WalletsResponse = z.infer<typeof WalletsResponseSchema>;

export const CircuitBreakerStatusSchema = z.object({
  active: z.boolean(),
  resumeAt: z.number().nullable(),
  pauseSeconds: z.number(),
});
export type CircuitBreakerStatus = z.infer<typeof CircuitBreakerStatusSchema>;

export const StatusResponseSchema = z.object({
  running: z.literal(true),
  uptimeSeconds: z.number(),
  connections: z.object({
    binance: z.boolean(),
    kraken: z.boolean(),
  }),
  circuitBreaker: CircuitBreakerStatusSchema,
  demoMode: z.boolean(),
  version: z.string(),
});
export type StatusResponse = z.infer<typeof StatusResponseSchema>;

export const OpportunitySchema = z.object({
  id: z.number(),
  buyExchange: z.string(),
  sellExchange: z.string(),
  buyAsk: z.number(),
  sellBid: z.number(),
  rawSpreadPct: z.number(),
  netProfitPct: z.number(),
  netProfitUsd: z.number(),
  executableBtc: z.number(),
  usdValue: z.number(),
  isPartialFill: SqliteBool,
  status: z.enum(['executed', 'skipped']).default('skipped'),
  timestamp: z.number(),
});
export type Opportunity = z.infer<typeof OpportunitySchema>;

export const TradeSchema = z.object({
  id: z.number(),
  buyExchange: z.string(),
  sellExchange: z.string(),
  buyAsk: z.number(),
  sellBid: z.number(),
  btcAmount: z.number(),
  usdCost: z.number(),
  usdRevenue: z.number(),
  buyFeeUsd: z.number(),
  sellFeeUsd: z.number(),
  slippageCostUsd: z.number(),
  netProfitUsd: z.number(),
  netProfitPct: z.number(),
  isPartialFill: SqliteBool,
  isDemo: SqliteBool,
  timestamp: z.number(),
});
export type Trade = z.infer<typeof TradeSchema>;

export const StatsResponseSchema = z.object({
  totalOpportunities: z.number(),
  totalTrades: z.number(),
  profitableTrades: z.number(),
  winRate: z.number(),              // 0–1
  totalNetProfitUsd: z.number(),
  avgNetProfitPct: z.number(),
  maxNetProfitPct: z.number(),
  totalVolumeUsd: z.number(),
  avgSpreadPct: z.number(),
  bestTrade: TradeSchema.nullable(),
  worstTrade: TradeSchema.nullable(),
});
export type StatsResponse = z.infer<typeof StatsResponseSchema>;

// ── Query string schemas (input validation) ───────────────────────────────────

export const LimitQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const HistoryQuerySchema = z.object({
  minutes: z.coerce.number().int().min(1).max(1440).default(30),
});

// ── SSE event payload schemas ─────────────────────────────────────────────────

export const PriceUpdateEventSchema = OrderBookSummarySchema;
export type PriceUpdateEvent = z.infer<typeof PriceUpdateEventSchema>;

export const OpportunityDetectedEventSchema = OpportunitySchema;
export type OpportunityDetectedEvent = z.infer<typeof OpportunityDetectedEventSchema>;

export const TradeExecutedEventSchema = TradeSchema;
export type TradeExecutedEvent = z.infer<typeof TradeExecutedEventSchema>;

export const WalletUpdateEventSchema = WalletsResponseSchema;
export type WalletUpdateEvent = z.infer<typeof WalletUpdateEventSchema>;

export const ConnectionStatusEventSchema = z.object({
  binance: z.boolean(),
  kraken: z.boolean(),
});

export const CircuitBreakerEventSchema = z.object({
  active: z.boolean(),
  activeUntil: z.number(),
  consecutiveLosses: z.number(),
});
