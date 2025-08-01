// Chat-specific SQLite adapter that only runs on server-side
// Uses dynamic imports to avoid bundling SQLite in client-side code

import type { DConversation, DConversationId } from '~/common/stores/chat/chat.conversation';
import type { DMessage, DMessageId, DMessageRole } from '~/common/stores/chat/chat.message';
import type { DMessageFragment, DMessageFragmentId } from '~/common/stores/chat/chat.fragments';

// Types for database operations
export interface ChatDatabaseRow {
  conversations: {
    id: string;
    user_title?: string;
    auto_title?: string;
    is_archived: number;
    is_incognito: number;
    user_symbol?: string;
    system_purpose_id: string;
    created: number;
    updated?: number;
    token_count: number;
    created_at: string;
    updated_at: string;
  };
  messages: {
    id: string;
    conversation_id: string;
    role: DMessageRole;
    purpose_id?: string;
    token_count: number;
    created: number;
    updated?: number;
    created_at: string;
    updated_at: string;
  };
  message_fragments: {
    id: string;
    message_id: string;
    fragment_type: string;
    fragment_order: number;
    title?: string;
    part_type: string;
    part_data: string;
    created_at: string;
    updated_at: string;
  };
}

export interface ConversationWithStats {
  id: string;
  user_title?: string;
  auto_title?: string;
  is_archived: boolean;
  is_incognito: boolean;
  user_symbol?: string;
  system_purpose_id: string;
  created: number;
  updated?: number;
  token_count: number;
  message_count: number;
  last_message_time?: number;
}

class ChatSQLiteAdapter {
  private db: any = null;
  private initialized = false;
  private isServer = typeof window === 'undefined';

  constructor() {
    if (this.isServer) {
      this.initializeDatabase();
    }
  }

  private async initializeDatabase(): Promise<void> {
    if (!this.isServer) {
      console.warn('[Chat SQLite] Skipping initialization on client-side');
      return;
    }

    try {
      // Dynamic import to avoid bundling in client-side
      const sqlite3 = await import('sqlite3');
      const Database = sqlite3.default;

      return new Promise((resolve, reject) => {
        this.db = new Database.Database('./big-agi-chats.db', (err: any) => {
          if (err) {
            console.error('[Chat SQLite] Error opening database:', err);
            reject(err);
            return;
          }

          console.log('[Chat SQLite] Connected to chat database');
          this.createTables()
            .then(() => {
              this.initialized = true;
              resolve();
            })
            .catch(reject);
        });
      });
    } catch (error) {
      console.error('[Chat SQLite] Error importing sqlite3:', error);
      throw error;
    }
  }

  private async ensureServerSide(): Promise<void> {
    if (!this.isServer) {
      throw new Error('[Chat SQLite] Operations can only be performed server-side');
    }
    if (!this.initialized) {
      await this.initializeDatabase();
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) {
      throw new Error('[Chat SQLite] Database not initialized');
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      // Read and execute the schema
      const schema = `
        -- Conversations table
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

        -- Messages table
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

        -- Message metadata table
        CREATE TABLE IF NOT EXISTS message_metadata (
            message_id TEXT PRIMARY KEY,
            in_reference_to TEXT,
            entangled TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
        );

        -- Message generators table
        CREATE TABLE IF NOT EXISTS message_generators (
            message_id TEXT PRIMARY KEY,
            llm_id TEXT,
            llm_label TEXT,
            llm_output_tokens INTEGER,
            metrics TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
        );

        -- Message user flags table
        CREATE TABLE IF NOT EXISTS message_user_flags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id TEXT NOT NULL,
            flag_type TEXT NOT NULL,
            flag_value TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
        );

        -- Message fragments table
        CREATE TABLE IF NOT EXISTS message_fragments (
            id TEXT NOT NULL,
            message_id TEXT NOT NULL,
            fragment_type TEXT NOT NULL CHECK (fragment_type IN ('content', 'attachment', 'void')),
            fragment_order INTEGER NOT NULL DEFAULT 0,
            title TEXT,
            part_type TEXT NOT NULL,
            part_data TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id, message_id),
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
        );

        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created DESC);
        CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated DESC);
        CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
        CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created ASC);
        CREATE INDEX IF NOT EXISTS idx_fragments_message ON message_fragments(message_id);
        CREATE INDEX IF NOT EXISTS idx_fragments_order ON message_fragments(message_id, fragment_order ASC);
      `;

      this.db.exec(schema, (err) => {
        if (err) {
          console.error('Error creating chat tables:', err);
          reject(err);
          return;
        }
        console.log('Chat tables created successfully');
        resolve();
      });
    });
  }

  private async waitForInitialization(): Promise<void> {
    while (!this.initialized) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // =========================================================================
  // CONVERSATION OPERATIONS
  // =========================================================================

  async getAllConversations(): Promise<DConversation[]> {
    await this.ensureServerSide();
    await this.waitForInitialization();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const query = `
        SELECT * FROM conversations
        ORDER BY updated DESC, created DESC
      `;

      this.db.all(query, [], async (err, rows: ChatDatabaseRow['conversations'][]) => {
        if (err) {
          console.error('Error fetching conversations:', err);
          reject(err);
          return;
        }

        try {
          const conversations = await Promise.all(rows.map((row) => this.convertRowToConversation(row)));
          resolve(conversations);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async getConversation(conversationId: DConversationId): Promise<DConversation | null> {
    await this.ensureServerSide();
    await this.waitForInitialization();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const query = 'SELECT * FROM conversations WHERE id = ?';
      this.db.get(query, [conversationId], async (err, row: ChatDatabaseRow['conversations'] | undefined) => {
        if (err) {
          console.error('Error fetching conversation:', err);
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        try {
          const conversation = await this.convertRowToConversation(row);
          resolve(conversation);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async saveConversation(conversation: DConversation): Promise<void> {
    await this.ensureServerSide();
    await this.waitForInitialization();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.serialize(() => {
        this.db!.run('BEGIN TRANSACTION');

        try {
          // Insert/Update conversation
          const conversationQuery = `
            INSERT OR REPLACE INTO conversations
            (id, user_title, auto_title, is_archived, is_incognito, user_symbol,
             system_purpose_id, created, updated, token_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          this.db!.run(conversationQuery, [
            conversation.id,
            conversation.userTitle || null,
            conversation.autoTitle || null,
            conversation.isArchived ? 1 : 0,
            conversation._isIncognito ? 1 : 0,
            conversation.userSymbol || null,
            conversation.systemPurposeId,
            conversation.created,
            conversation.updated || null,
            conversation.tokenCount,
          ]);

          // Delete existing messages for this conversation
          this.db!.run('DELETE FROM messages WHERE conversation_id = ?', [conversation.id]);

          // Insert messages and their related data
          conversation.messages.forEach((message, index) => {
            this.saveMessageToDb(message, conversation.id);
          });

          this.db!.run('COMMIT', (err) => {
            if (err) {
              console.error('Error committing conversation transaction:', err);
              reject(err);
            } else {
              resolve();
            }
          });
        } catch (error) {
          this.db!.run('ROLLBACK');
          reject(error);
        }
      });
    });
  }

  async deleteConversation(conversationId: DConversationId): Promise<void> {
    await this.ensureServerSide();
    await this.waitForInitialization();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const query = 'DELETE FROM conversations WHERE id = ?';
      this.db.run(query, [conversationId], function (err) {
        if (err) {
          console.error('Error deleting conversation:', err);
          reject(err);
          return;
        }
        console.log(`Deleted conversation ${conversationId}`);
        resolve();
      });
    });
  }

  // =========================================================================
  // MESSAGE OPERATIONS
  // =========================================================================

  async getMessagesForConversation(conversationId: DConversationId): Promise<DMessage[]> {
    await this.ensureServerSide();
    await this.waitForInitialization();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const query = `
        SELECT * FROM messages
        WHERE conversation_id = ?
        ORDER BY created ASC
      `;

      this.db.all(query, [conversationId], async (err, rows: ChatDatabaseRow['messages'][]) => {
        if (err) {
          console.error('Error fetching messages:', err);
          reject(err);
          return;
        }

        try {
          const messages = await Promise.all(rows.map((row) => this.convertRowToMessage(row)));
          resolve(messages);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private saveMessageToDb(message: DMessage, conversationId: DConversationId): void {
    if (!this.db) return;

    // Insert message
    const messageQuery = `
      INSERT OR REPLACE INTO messages
      (id, conversation_id, role, purpose_id, token_count, created, updated)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    this.db.run(messageQuery, [
      message.id,
      conversationId,
      message.role,
      message.purposeId || null,
      message.tokenCount,
      message.created,
      message.updated || null,
    ]);

    // Insert metadata if exists
    if (message.metadata) {
      const metadataQuery = `
        INSERT OR REPLACE INTO message_metadata
        (message_id, in_reference_to, entangled)
        VALUES (?, ?, ?)
      `;

      this.db.run(metadataQuery, [
        message.id,
        message.metadata.inReferenceTo ? JSON.stringify(message.metadata.inReferenceTo) : null,
        message.metadata.entangled ? JSON.stringify(message.metadata.entangled) : null,
      ]);
    }

    // Insert generator info if exists
    if (message.generator) {
      const generatorQuery = `
        INSERT OR REPLACE INTO message_generators
        (message_id, llm_id, llm_label, llm_output_tokens, metrics)
        VALUES (?, ?, ?, ?, ?)
      `;

      this.db.run(generatorQuery, [
        message.id,
        message.generator.llmId || null,
        message.generator.llmLabel || null,
        message.generator.llmOutputTokens || null,
        message.generator.metrics ? JSON.stringify(message.generator.metrics) : null,
      ]);
    }

    // Insert user flags if exist
    if (message.userFlags && message.userFlags.length > 0) {
      // First delete existing flags
      this.db.run('DELETE FROM message_user_flags WHERE message_id = ?', [message.id]);

      // Insert new flags
      const flagQuery = `
        INSERT INTO message_user_flags (message_id, flag_type, flag_value)
        VALUES (?, ?, ?)
      `;

      message.userFlags.forEach((flag) => {
        this.db!.run(flagQuery, [message.id, flag.flag, flag.value || null]);
      });
    }

    // Insert fragments
    this.db.run('DELETE FROM message_fragments WHERE message_id = ?', [message.id]);

    message.fragments.forEach((fragment, index) => {
      const fragmentQuery = `
        INSERT INTO message_fragments
        (id, message_id, fragment_type, fragment_order, title, part_type, part_data)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      this.db!.run(fragmentQuery, [fragment.fId, message.id, fragment.ft, index, fragment.title || null, fragment.part.pt, JSON.stringify(fragment.part)]);
    });
  }

  // =========================================================================
  // CONVERSION HELPERS
  // =========================================================================

  private async convertRowToConversation(row: ChatDatabaseRow['conversations']): Promise<DConversation> {
    const messages = await this.getMessagesForConversation(row.id);

    const conversation: DConversation = {
      id: row.id,
      messages,
      systemPurposeId: row.system_purpose_id,
      created: row.created,
      updated: row.updated || null,
      tokenCount: row.token_count,
      _abortController: null, // Not persisted
    };

    if (row.user_title) conversation.userTitle = row.user_title;
    if (row.auto_title) conversation.autoTitle = row.auto_title;
    if (row.is_archived) conversation.isArchived = Boolean(row.is_archived);
    if (row.is_incognito) conversation._isIncognito = Boolean(row.is_incognito);
    if (row.user_symbol) conversation.userSymbol = row.user_symbol;

    return conversation;
  }

  private async convertRowToMessage(row: ChatDatabaseRow['messages']): Promise<DMessage> {
    const fragments = await this.getFragmentsForMessage(row.id);
    const metadata = await this.getMetadataForMessage(row.id);
    const generator = await this.getGeneratorForMessage(row.id);
    const userFlags = await this.getUserFlagsForMessage(row.id);

    const message: DMessage = {
      id: row.id,
      role: row.role,
      fragments,
      tokenCount: row.token_count,
      created: row.created,
      updated: row.updated || null,
    };

    if (row.purpose_id) message.purposeId = row.purpose_id;
    if (metadata) message.metadata = metadata;
    if (generator) message.generator = generator;
    if (userFlags.length > 0) message.userFlags = userFlags;

    return message;
  }

  private async getFragmentsForMessage(messageId: DMessageId): Promise<DMessageFragment[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const query = `
        SELECT * FROM message_fragments
        WHERE message_id = ?
        ORDER BY fragment_order ASC
      `;

      this.db.all(query, [messageId], (err, rows: ChatDatabaseRow['message_fragments'][]) => {
        if (err) {
          reject(err);
          return;
        }

        const fragments = rows.map((row) => {
          const part = JSON.parse(row.part_data);
          const fragment: DMessageFragment = {
            fId: row.id,
            ft: row.fragment_type as any,
            part,
          };

          if (row.title) fragment.title = row.title;

          return fragment;
        });

        resolve(fragments);
      });
    });
  }

  private async getMetadataForMessage(messageId: DMessageId): Promise<any | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const query = 'SELECT * FROM message_metadata WHERE message_id = ?';
      this.db.get(query, [messageId], (err, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        const metadata: any = {};
        if (row.in_reference_to) {
          metadata.inReferenceTo = JSON.parse(row.in_reference_to);
        }
        if (row.entangled) {
          metadata.entangled = JSON.parse(row.entangled);
        }

        resolve(Object.keys(metadata).length > 0 ? metadata : null);
      });
    });
  }

  private async getGeneratorForMessage(messageId: DMessageId): Promise<any | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const query = 'SELECT * FROM message_generators WHERE message_id = ?';
      this.db.get(query, [messageId], (err, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        const generator: any = {};
        if (row.llm_id) generator.llmId = row.llm_id;
        if (row.llm_label) generator.llmLabel = row.llm_label;
        if (row.llm_output_tokens) generator.llmOutputTokens = row.llm_output_tokens;
        if (row.metrics) generator.metrics = JSON.parse(row.metrics);

        resolve(Object.keys(generator).length > 0 ? generator : null);
      });
    });
  }

  private async getUserFlagsForMessage(messageId: DMessageId): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const query = 'SELECT * FROM message_user_flags WHERE message_id = ?';
      this.db.all(query, [messageId], (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const flags = rows.map((row) => ({
          flag: row.flag_type,
          value: row.flag_value,
        }));

        resolve(flags);
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      this.db.close((err) => {
        if (err) {
          console.error('Error closing chat database:', err);
          reject(err);
          return;
        }

        console.log('Chat database connection closed');
        this.db = null;
        this.initialized = false;
        resolve();
      });
    });
  }
}

// Singleton instance
let chatAdapterInstance: ChatSQLiteAdapter | null = null;

export function getChatAdapter(): ChatSQLiteAdapter {
  // Only create instance on server-side
  if (typeof window === 'undefined') {
    if (!chatAdapterInstance) {
      chatAdapterInstance = new ChatSQLiteAdapter();
    }
    return chatAdapterInstance;
  } else {
    throw new Error('[Chat SQLite] Chat adapter can only be used server-side');
  }
}

// Helper function to close database connection
export async function closeChatAdapter(): Promise<void> {
  if (chatAdapterInstance) {
    await chatAdapterInstance.close();
    chatAdapterInstance = null;
  }
}

export default getChatAdapter;
