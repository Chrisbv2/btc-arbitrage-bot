import Database from 'better-sqlite3';

export function initDb(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS opportunities (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      buy_exchange    TEXT    NOT NULL,
      sell_exchange   TEXT    NOT NULL,
      buy_ask         REAL    NOT NULL,
      sell_bid        REAL    NOT NULL,
      raw_spread      REAL    NOT NULL,
      raw_spread_pct  REAL    NOT NULL,
      net_profit_pct  REAL    NOT NULL,
      net_profit_usd  REAL    NOT NULL,
      trade_size      REAL    NOT NULL,
      is_profitable   INTEGER NOT NULL DEFAULT 0,
      timestamp       INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS price_snapshots (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      exchange   TEXT    NOT NULL,
      bid        REAL    NOT NULL,
      ask        REAL    NOT NULL,
      timestamp  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_opportunities_ts  ON opportunities(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_snapshots_ex_ts   ON price_snapshots(exchange, timestamp DESC);
  `);
}
