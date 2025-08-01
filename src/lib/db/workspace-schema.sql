-- SQLite schema for Workspace Store
-- Manages workspace-to-livefile associations

-- Main workspace store table
CREATE TABLE IF NOT EXISTS workspace_store (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_data TEXT NOT NULL, -- JSON serialized workspace state
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Workspace to LiveFile associations (normalized)
CREATE TABLE IF NOT EXISTS workspace_livefiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id TEXT NOT NULL,
    live_file_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workspace_id, live_file_id)
);

-- Index for fast workspace lookups
CREATE INDEX IF NOT EXISTS idx_workspace_livefiles_workspace 
ON workspace_livefiles(workspace_id);

-- Index for fast file lookups (for unassign operations)  
CREATE INDEX IF NOT EXISTS idx_workspace_livefiles_file
ON workspace_livefiles(live_file_id);

-- Store metadata
CREATE TABLE IF NOT EXISTS workspace_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial metadata
INSERT OR IGNORE INTO workspace_metadata (key, value) 
VALUES ('version', '1.0'), ('created', datetime('now'));