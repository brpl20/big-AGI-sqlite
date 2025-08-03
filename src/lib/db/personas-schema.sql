-- SQLite schema for personas store
-- This schema supports both predefined personas (from data.ts) and custom personas

-- Hidden personas store - tracks which predefined personas are hidden
CREATE TABLE IF NOT EXISTS hidden_personas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    persona_id TEXT UNIQUE NOT NULL,
    hidden_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_hidden_personas_id ON hidden_personas(persona_id);

-- Custom personas store - stores user-created personas
CREATE TABLE IF NOT EXISTS custom_personas (
    id TEXT PRIMARY KEY, -- UUID format 'persona-simple-xxx'
    name TEXT,
    system_prompt TEXT NOT NULL,
    picture_url TEXT,
    creation_date TEXT NOT NULL, -- ISO string format
    -- source material
    input_provenance_type TEXT, -- 'youtube' | 'text' | NULL
    input_provenance_data TEXT, -- JSON string with type-specific data
    input_text TEXT, -- Source text (empty for YouTube sources to save space)
    -- llm used
    llm_label TEXT,
    -- metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_custom_personas_creation_date ON custom_personas(creation_date DESC);
CREATE INDEX IF NOT EXISTS idx_custom_personas_name ON custom_personas(name);

-- Store conversation-specific custom prompts (for 'Custom' persona type)
CREATE TABLE IF NOT EXISTS conversation_custom_prompts (
    conversation_id TEXT PRIMARY KEY,
    system_prompt TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for conversation lookups
CREATE INDEX IF NOT EXISTS idx_conversation_custom_prompts_id ON conversation_custom_prompts(conversation_id);