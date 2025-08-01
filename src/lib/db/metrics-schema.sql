-- Metrics Store SQLite Schema
-- This schema supports append-only metrics collection for LLM services
-- Based on the ServiceMetricsAggregate structure from metrics.modelservice.ts

CREATE TABLE IF NOT EXISTS metrics_store (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    data TEXT NOT NULL, -- JSON stringified ServiceMetricsSlice
    version INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Individual metrics entries for detailed tracking (append-only)
CREATE TABLE IF NOT EXISTS metrics_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id TEXT NOT NULL,
    costs_cents INTEGER, -- $c in cents
    savings_cents INTEGER, -- $cdCache in cents  
    cost_code TEXT, -- 'free', 'no-pricing', 'no-tokens', 'partial-msg', 'partial-price'
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    debug_cost_source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Service metrics aggregates (cached calculations)
CREATE TABLE IF NOT EXISTS service_metrics_aggregates (
    service_id TEXT PRIMARY KEY,
    total_costs_cents INTEGER DEFAULT 0,
    total_savings_cents INTEGER DEFAULT 0,
    total_input_tokens INTEGER DEFAULT 0,
    total_output_tokens INTEGER DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    first_usage_date INTEGER DEFAULT 0, -- Date.now() timestamp
    last_usage_date INTEGER DEFAULT 0, -- Date.now() timestamp
    free_usages INTEGER DEFAULT 0,
    no_pricing_usages INTEGER DEFAULT 0,
    no_token_usages INTEGER DEFAULT 0,
    partial_message_usages INTEGER DEFAULT 0,
    partial_price_usages INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_metrics_entries_service_id ON metrics_entries(service_id);
CREATE INDEX IF NOT EXISTS idx_metrics_entries_created_at ON metrics_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_service_metrics_aggregates_last_usage ON service_metrics_aggregates(last_usage_date);

-- Trigger to automatically update the updated_at column
CREATE TRIGGER IF NOT EXISTS update_metrics_store_updated_at
    AFTER UPDATE ON metrics_store
    FOR EACH ROW
BEGIN
    UPDATE metrics_store SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_service_metrics_aggregates_updated_at
    AFTER UPDATE ON service_metrics_aggregates
    FOR EACH ROW
BEGIN
    UPDATE service_metrics_aggregates SET updated_at = CURRENT_TIMESTAMP WHERE service_id = NEW.service_id;
END;