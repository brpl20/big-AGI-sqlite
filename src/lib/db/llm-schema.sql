-- LLM Store SQL Schema
-- This schema stores LLM services, models, and domain assignments

-- Services table - stores vendor services like OpenAI, Anthropic, etc.
CREATE TABLE IF NOT EXISTS llm_services (
    id TEXT PRIMARY KEY,
    vendor_id TEXT NOT NULL,
    label TEXT NOT NULL,
    setup TEXT NOT NULL, -- JSON configuration object
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Models table - stores individual LLM models provided by services
CREATE TABLE IF NOT EXISTS llm_models (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL,
    vendor_id TEXT NOT NULL,
    label TEXT NOT NULL,
    created TEXT NOT NULL, -- ISO date string when model was created
    updated TEXT, -- ISO date string when model was last updated
    description TEXT,
    context_tokens INTEGER,
    max_output_tokens INTEGER,
    training_data_cutoff TEXT, -- ISO date string
    interfaces TEXT NOT NULL, -- JSON array of supported interfaces
    input_types TEXT, -- JSON object of input types
    benchmark TEXT, -- JSON object of benchmark data
    pricing TEXT, -- JSON object of pricing information
    initial_parameters TEXT, -- JSON object of initial parameters
    user_parameters TEXT, -- JSON object of user-customized parameters
    user_label TEXT, -- User-defined custom label
    user_hidden INTEGER DEFAULT 0, -- Boolean: 0 = visible, 1 = hidden
    user_starred INTEGER DEFAULT 0, -- Boolean: 0 = not starred, 1 = starred
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES llm_services(id) ON DELETE CASCADE
);

-- Domain assignments table - maps domains to specific models
CREATE TABLE IF NOT EXISTS llm_assignments (
    domain_id TEXT PRIMARY KEY,
    model_id TEXT NOT NULL,
    temperature REAL,
    max_tokens INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (model_id) REFERENCES llm_models(id) ON DELETE CASCADE
);

-- Store metadata table - tracks the current configuration service
CREATE TABLE IF NOT EXISTS llm_store_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default metadata
INSERT OR IGNORE INTO llm_store_metadata (key, value) VALUES ('conf_service_id', '');

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_llm_models_service_id ON llm_models(service_id);
CREATE INDEX IF NOT EXISTS idx_llm_models_vendor_id ON llm_models(vendor_id);
CREATE INDEX IF NOT EXISTS idx_llm_assignments_model_id ON llm_assignments(model_id);
CREATE INDEX IF NOT EXISTS idx_llm_services_vendor_id ON llm_services(vendor_id);

-- Triggers to automatically update timestamps
CREATE TRIGGER IF NOT EXISTS update_llm_services_timestamp
    AFTER UPDATE ON llm_services
    BEGIN
        UPDATE llm_services SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_llm_models_timestamp
    AFTER UPDATE ON llm_models
    BEGIN
        UPDATE llm_models SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_llm_assignments_timestamp
    AFTER UPDATE ON llm_assignments
    BEGIN
        UPDATE llm_assignments SET updated_at = CURRENT_TIMESTAMP WHERE domain_id = NEW.domain_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_llm_store_metadata_timestamp
    AFTER UPDATE ON llm_store_metadata
    BEGIN
        UPDATE llm_store_metadata SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
    END;
