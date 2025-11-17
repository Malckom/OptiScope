CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  strategy TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  opened_at DATE NOT NULL DEFAULT current_date,
  closed_at DATE,
  net_credit NUMERIC(12, 2),
  net_debit NUMERIC(12, 2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS option_legs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  leg_type TEXT NOT NULL CHECK (leg_type IN ('call', 'put')),
  position TEXT NOT NULL CHECK (position IN ('long', 'short')),
  strike NUMERIC(12, 2) NOT NULL,
  expiry DATE NOT NULL,
  quantity INTEGER NOT NULL,
  price NUMERIC(12, 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'portfolio',
  report_date DATE NOT NULL DEFAULT current_date,
  snapshot JSONB NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, label, report_date)
);

CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_option_legs_trade_id ON option_legs(trade_id);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_label_date ON analytics_summaries(label, report_date);
