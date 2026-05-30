import Database from 'better-sqlite3';

export function initDb(db: Database.Database): void {
  db.exec(`
    -- Detected profitable opportunities (pre-execution)
    CREATE TABLE IF NOT EXISTS opportunities (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      buy_exchange     TEXT    NOT NULL,
      sell_exchange    TEXT    NOT NULL,
      buy_ask          REAL    NOT NULL,
      sell_bid         REAL    NOT NULL,
      raw_spread_pct   REAL    NOT NULL,
      net_profit_pct   REAL    NOT NULL,
      net_profit_usd   REAL    NOT NULL,
      executable_btc   REAL    NOT NULL,
      usd_value        REAL    NOT NULL,
      is_partial_fill  INTEGER NOT NULL DEFAULT 0,
      timestamp        INTEGER NOT NULL
    );

    -- Executed (simulated) trades with full P&L breakdown
    CREATE TABLE IF NOT EXISTS trades (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      buy_exchange      TEXT    NOT NULL,
      sell_exchange     TEXT    NOT NULL,
      buy_ask           REAL    NOT NULL,
      sell_bid          REAL    NOT NULL,
      btc_amount        REAL    NOT NULL,
      usd_cost          REAL    NOT NULL,
      usd_revenue       REAL    NOT NULL,
      buy_fee_usd       REAL    NOT NULL,
      sell_fee_usd      REAL    NOT NULL,
      slippage_cost_usd REAL    NOT NULL,
      net_profit_usd    REAL    NOT NULL,
      net_profit_pct    REAL    NOT NULL,
      is_partial_fill   INTEGER NOT NULL DEFAULT 0,
      timestamp         INTEGER NOT NULL
    );

    -- Throttled price history (one row per second per exchange)
    CREATE TABLE IF NOT EXISTS price_snapshots (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      exchange   TEXT    NOT NULL,
      bid        REAL    NOT NULL,
      ask        REAL    NOT NULL,
      timestamp  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_opp_ts    ON opportunities(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_trade_ts  ON trades(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_snap_ex   ON price_snapshots(exchange, timestamp DESC);
  `);
}
