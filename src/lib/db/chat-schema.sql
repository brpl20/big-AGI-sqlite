-- SQLite Schema for Big-AGI Chat System
-- This schema supports the complex hierarchical structure of conversations -> messages -> fragments

-- =============================================================================
-- CONVERSATIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_title TEXT,
    auto_title TEXT,
    is_archived INTEGER DEFAULT 0,
    is_incognito INTEGER DEFAULT 0,
    user_symbol TEXT,
    system_purpose_id TEXT NOT NULL,
    created INTEGER NOT NULL,
    updated INTEGER,
    token_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- MESSAGES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    purpose_id TEXT,
    token_count INTEGER DEFAULT 0,
    created INTEGER NOT NULL,
    updated INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- =============================================================================
-- MESSAGE METADATA TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS message_metadata (
    message_id TEXT PRIMARY KEY,
    in_reference_to TEXT, -- JSON array of references
    entangled TEXT, -- JSON object for entangled messages
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- =============================================================================
-- MESSAGE GENERATOR TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS message_generators (
    message_id TEXT PRIMARY KEY,
    llm_id TEXT,
    llm_label TEXT,
    llm_output_tokens INTEGER,
    metrics TEXT, -- JSON object for metrics
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- =============================================================================
-- MESSAGE USER FLAGS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS message_user_flags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT NOT NULL,
    flag_type TEXT NOT NULL,
    flag_value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- =============================================================================
-- MESSAGE FRAGMENTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS message_fragments (
    id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    fragment_type TEXT NOT NULL CHECK (fragment_type IN ('content', 'attachment', 'void')),
    fragment_order INTEGER NOT NULL DEFAULT 0,
    title TEXT,
    part_type TEXT NOT NULL,
    part_data TEXT NOT NULL, -- JSON object containing the part data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, message_id),
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Conversation indexes
CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_archived ON conversations(is_archived);
CREATE INDEX IF NOT EXISTS idx_conversations_system_purpose ON conversations(system_purpose_id);

-- Message indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created ASC);

-- Fragment indexes
CREATE INDEX IF NOT EXISTS idx_fragments_message ON message_fragments(message_id);
CREATE INDEX IF NOT EXISTS idx_fragments_order ON message_fragments(message_id, fragment_order ASC);
CREATE INDEX IF NOT EXISTS idx_fragments_type ON message_fragments(fragment_type);

-- User flags indexes
CREATE INDEX IF NOT EXISTS idx_user_flags_message ON message_user_flags(message_id);
CREATE INDEX IF NOT EXISTS idx_user_flags_type ON message_user_flags(flag_type);

-- =============================================================================
-- TRIGGERS FOR AUTO-UPDATE TIMESTAMPS
-- =============================================================================

-- Update conversations timestamp
CREATE TRIGGER IF NOT EXISTS update_conversations_timestamp
    AFTER UPDATE ON conversations
    BEGIN
        UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Update messages timestamp
CREATE TRIGGER IF NOT EXISTS update_messages_timestamp
    AFTER UPDATE ON messages
    BEGIN
        UPDATE messages SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Update message_fragments timestamp
CREATE TRIGGER IF NOT EXISTS update_fragments_timestamp
    AFTER UPDATE ON message_fragments
    BEGIN
        UPDATE message_fragments SET updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.id AND message_id = NEW.message_id;
    END;

-- Update conversation's updated timestamp when messages change
CREATE TRIGGER IF NOT EXISTS update_conversation_on_message_change
    AFTER INSERT ON messages
    BEGIN
        UPDATE conversations
        SET updated = NEW.created, updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.conversation_id;
    END;

-- Update conversation's updated timestamp when messages are updated
CREATE TRIGGER IF NOT EXISTS update_conversation_on_message_update
    AFTER UPDATE ON messages
    BEGIN
        UPDATE conversations
        SET updated = NEW.updated, updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.conversation_id;
    END;

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- Complete conversation view with message count
CREATE VIEW IF NOT EXISTS conversations_with_stats AS
SELECT
    c.*,
    COUNT(m.id) as message_count,
    MAX(m.created) as last_message_time
FROM conversations c
LEFT JOIN messages m ON c.id = m.conversation_id
GROUP BY c.id;

-- Messages with all related data
CREATE VIEW IF NOT EXISTS messages_complete AS
SELECT
    m.*,
    md.in_reference_to,
    md.entangled,
    mg.llm_id,
    mg.llm_label,
    mg.llm_output_tokens,
    mg.metrics,
    COUNT(mf.id) as fragment_count
FROM messages m
LEFT JOIN message_metadata md ON m.id = md.message_id
LEFT JOIN message_generators mg ON m.id = mg.message_id
LEFT JOIN message_fragments mf ON m.id = mf.message_id
GROUP BY m.id;
