import type { SimplePersona, SimplePersonaProvenance } from '../../apps/personas/store-app-personas';

// Types for database operations
export interface PersonasDatabaseRow {
  hiddenPersonas: string[];
  customPersonas: SimplePersona[];
  conversationCustomPrompts: Record<string, string>;
}

class PersonasSQLiteAdapter {
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
      console.warn('[Personas SQLite] Skipping initialization on client-side');
      return;
    }

    try {
      // Dynamic import to avoid bundling in client-side
      const sqlite3 = await import('sqlite3');
      const Database = sqlite3.default;

      return new Promise((resolve, reject) => {
        this.db = new Database.Database('./big-agi-personas.db', (err: any) => {
          if (err) {
            console.error('[Personas SQLite] Error opening database:', err);
            reject(err);
            return;
          }

          console.log('[Personas SQLite] Connected to personas database');
          this.createTables()
            .then(() => {
              this.initialized = true;
              resolve();
            })
            .catch(reject);
        });
      });
    } catch (error) {
      console.error('[Personas SQLite] Error importing sqlite3:', error);
      throw error;
    }
  }

  private async ensureServerSide(): Promise<void> {
    if (!this.isServer) {
      throw new Error('[Personas SQLite] Operations can only be performed server-side');
    }
    if (!this.initialized) {
      await this.initializeDatabase();
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) {
      throw new Error('[Personas SQLite] Database not initialized');
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      // Read and execute the personas schema
      const schema = `
        -- Hidden personas visibility table
        CREATE TABLE IF NOT EXISTS hidden_personas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            persona_id TEXT UNIQUE NOT NULL,
            hidden_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Custom personas storage
        CREATE TABLE IF NOT EXISTS custom_personas (
            id TEXT PRIMARY KEY,
            name TEXT,
            system_prompt TEXT NOT NULL,
            picture_url TEXT,
            creation_date TEXT NOT NULL,
            input_provenance_type TEXT,
            input_provenance_data TEXT,
            input_text TEXT DEFAULT '',
            llm_label TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Conversation-specific custom prompts
        CREATE TABLE IF NOT EXISTS conversation_custom_prompts (
            conversation_id TEXT PRIMARY KEY,
            system_prompt TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_hidden_personas_persona_id ON hidden_personas(persona_id);
        CREATE INDEX IF NOT EXISTS idx_custom_personas_creation_date ON custom_personas(creation_date DESC);
        CREATE INDEX IF NOT EXISTS idx_conversation_custom_prompts_id ON conversation_custom_prompts(conversation_id);
      `;

      this.db.exec(schema, (err) => {
        if (err) {
          console.error('Error creating personas tables:', err);
          reject(err);
          return;
        }
        console.log('Personas tables created successfully');
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
  // HIDDEN PERSONAS OPERATIONS
  // =========================================================================

  async getHiddenPersonas(): Promise<string[]> {
    await this.ensureServerSide();
    await this.waitForInitialization();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const query = 'SELECT persona_id FROM hidden_personas';
      this.db.all(query, [], (err, rows: { persona_id: string }[]) => {
        if (err) {
          console.error('Error fetching hidden personas:', err);
          reject(err);
          return;
        }
        resolve(rows.map(row => row.persona_id));
      });
    });
  }

  async toggleHiddenPersona(personaId: string): Promise<void> {
    await this.ensureServerSide();
    await this.waitForInitialization();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      // Check if persona is already hidden
      this.db.get('SELECT 1 FROM hidden_personas WHERE persona_id = ?', [personaId], (err, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (row) {
          // Remove from hidden
          this.db.run('DELETE FROM hidden_personas WHERE persona_id = ?', [personaId], (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        } else {
          // Add to hidden
          this.db.run('INSERT INTO hidden_personas (persona_id) VALUES (?)', [personaId], (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        }
      });
    });
  }

  async setHiddenPersonas(personaIds: string[]): Promise<void> {
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
          // Clear existing hidden personas
          this.db!.run('DELETE FROM hidden_personas');

          // Insert new hidden personas
          for (const personaId of personaIds) {
            this.db!.run('INSERT INTO hidden_personas (persona_id) VALUES (?)', [personaId]);
          }

          this.db!.run('COMMIT', (err) => {
            if (err) {
              console.error('Error committing hidden personas transaction:', err);
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

  // =========================================================================
  // CUSTOM PERSONAS OPERATIONS
  // =========================================================================

  async getCustomPersonas(limit: number = 100): Promise<SimplePersona[]> {
    await this.ensureServerSide();
    await this.waitForInitialization();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const query = `
        SELECT 
          id,
          name,
          system_prompt,
          picture_url,
          creation_date,
          input_provenance_type,
          input_provenance_data,
          input_text,
          llm_label
        FROM custom_personas
        ORDER BY creation_date DESC
        LIMIT ?
      `;

      this.db.all(query, [limit], (err, rows: any[]) => {
        if (err) {
          console.error('Error fetching custom personas:', err);
          reject(err);
          return;
        }

        const result = rows.map(row => {
          let inputProvenance: SimplePersonaProvenance | undefined;
          
          if (row.input_provenance_type && row.input_provenance_data) {
            try {
              const data = JSON.parse(row.input_provenance_data);
              if (row.input_provenance_type === 'youtube') {
                inputProvenance = {
                  type: 'youtube',
                  url: data.url,
                  title: data.title,
                  thumbnailUrl: data.thumbnailUrl,
                };
              } else if (row.input_provenance_type === 'text') {
                inputProvenance = { type: 'text' };
              }
            } catch (e) {
              console.error('Failed to parse input provenance data:', e);
            }
          }

          return {
            id: row.id,
            name: row.name || undefined,
            systemPrompt: row.system_prompt,
            pictureUrl: row.picture_url || undefined,
            creationDate: row.creation_date,
            inputProvenance,
            inputText: row.input_text || '',
            llmLabel: row.llm_label || undefined,
          };
        });

        resolve(result);
      });
    });
  }

  async getCustomPersona(id: string): Promise<SimplePersona | null> {
    await this.ensureServerSide();
    await this.waitForInitialization();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const query = `
        SELECT 
          id,
          name,
          system_prompt,
          picture_url,
          creation_date,
          input_provenance_type,
          input_provenance_data,
          input_text,
          llm_label
        FROM custom_personas
        WHERE id = ?
      `;

      this.db.get(query, [id], (err, row: any) => {
        if (err) {
          console.error('Error fetching custom persona:', err);
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        let inputProvenance: SimplePersonaProvenance | undefined;
        
        if (row.input_provenance_type && row.input_provenance_data) {
          try {
            const data = JSON.parse(row.input_provenance_data);
            if (row.input_provenance_type === 'youtube') {
              inputProvenance = {
                type: 'youtube',
                url: data.url,
                title: data.title,
                thumbnailUrl: data.thumbnailUrl,
              };
            } else if (row.input_provenance_type === 'text') {
              inputProvenance = { type: 'text' };
            }
          } catch (e) {
            console.error('Failed to parse input provenance data:', e);
          }
        }

        resolve({
          id: row.id,
          name: row.name || undefined,
          systemPrompt: row.system_prompt,
          pictureUrl: row.picture_url || undefined,
          creationDate: row.creation_date,
          inputProvenance,
          inputText: row.input_text || '',
          llmLabel: row.llm_label || undefined,
        });
      });
    });
  }

  async prependCustomPersona(persona: SimplePersona): Promise<void> {
    await this.ensureServerSide();
    await this.waitForInitialization();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      let provenanceData: string | null = null;
      
      if (persona.inputProvenance) {
        if (persona.inputProvenance.type === 'youtube') {
          provenanceData = JSON.stringify({
            url: persona.inputProvenance.url,
            title: persona.inputProvenance.title,
            thumbnailUrl: persona.inputProvenance.thumbnailUrl,
          });
        } else {
          provenanceData = JSON.stringify({});
        }
      }

      this.db.serialize(() => {
        this.db!.run('BEGIN TRANSACTION');

        try {
          // Insert new persona
          this.db!.run(`
            INSERT OR REPLACE INTO custom_personas (
              id,
              name,
              system_prompt,
              picture_url,
              creation_date,
              input_provenance_type,
              input_provenance_data,
              input_text,
              llm_label
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            persona.id,
            persona.name || null,
            persona.systemPrompt,
            persona.pictureUrl || null,
            persona.creationDate,
            persona.inputProvenance?.type || null,
            provenanceData,
            persona.inputText,
            persona.llmLabel || null
          ]);

          // Enforce MAX_SAVED_PROMPTS limit (100)
          this.db!.run(`
            DELETE FROM custom_personas
            WHERE id NOT IN (
              SELECT id FROM custom_personas
              ORDER BY creation_date DESC
              LIMIT 100
            )
          `);

          this.db!.run('COMMIT', (err) => {
            if (err) {
              console.error('Error committing custom persona transaction:', err);
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

  async deleteCustomPersona(id: string): Promise<void> {
    await this.ensureServerSide();
    await this.waitForInitialization();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.run('DELETE FROM custom_personas WHERE id = ?', [id], (err) => {
        if (err) {
          console.error('Error deleting custom persona:', err);
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async deleteCustomPersonas(ids: Set<string>): Promise<void> {
    await this.ensureServerSide();
    await this.waitForInitialization();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const placeholders = Array.from(ids).map(() => '?').join(',');
      this.db.run(`DELETE FROM custom_personas WHERE id IN (${placeholders})`, Array.from(ids), (err) => {
        if (err) {
          console.error('Error deleting custom personas:', err);
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  // =========================================================================
  // CONVERSATION CUSTOM PROMPTS OPERATIONS
  // =========================================================================

  async getConversationCustomPrompt(conversationId: string): Promise<string | null> {
    await this.ensureServerSide();
    await this.waitForInitialization();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.get('SELECT system_prompt FROM conversation_custom_prompts WHERE conversation_id = ?', [conversationId], (err, row: { system_prompt: string } | undefined) => {
        if (err) {
          console.error('Error fetching conversation custom prompt:', err);
          reject(err);
          return;
        }
        resolve(row?.system_prompt || null);
      });
    });
  }

  async setConversationCustomPrompt(conversationId: string, systemPrompt: string): Promise<void> {
    await this.ensureServerSide();
    await this.waitForInitialization();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.run(`
        INSERT OR REPLACE INTO conversation_custom_prompts (conversation_id, system_prompt)
        VALUES (?, ?)
      `, [conversationId, systemPrompt], (err) => {
        if (err) {
          console.error('Error setting conversation custom prompt:', err);
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async deleteConversationCustomPrompt(conversationId: string): Promise<void> {
    await this.ensureServerSide();
    await this.waitForInitialization();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.run('DELETE FROM conversation_custom_prompts WHERE conversation_id = ?', [conversationId], (err) => {
        if (err) {
          console.error('Error deleting conversation custom prompt:', err);
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  // =========================================================================
  // AGGREGATE OPERATIONS
  // =========================================================================

  async getAllData(): Promise<PersonasDatabaseRow> {
    const [hiddenPersonas, customPersonas] = await Promise.all([
      this.getHiddenPersonas(),
      this.getCustomPersonas(),
    ]);

    // For now, we don't load all conversation custom prompts
    // They should be loaded on-demand per conversation
    return {
      hiddenPersonas,
      customPersonas,
      conversationCustomPrompts: {},
    };
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      this.db.close((err) => {
        if (err) {
          console.error('Error closing personas database:', err);
          reject(err);
          return;
        }

        console.log('Personas database connection closed');
        this.db = null;
        this.initialized = false;
        resolve();
      });
    });
  }
}

// Singleton instance
let personasAdapterInstance: PersonasSQLiteAdapter | null = null;

export function getPersonasAdapter(): PersonasSQLiteAdapter {
  // Only create instance on server-side
  if (typeof window === 'undefined') {
    if (!personasAdapterInstance) {
      personasAdapterInstance = new PersonasSQLiteAdapter();
    }
    return personasAdapterInstance;
  } else {
    throw new Error('[Personas SQLite] Personas adapter can only be used server-side');
  }
}

// Helper function to close database connection
export async function closePersonasAdapter(): Promise<void> {
  if (personasAdapterInstance) {
    await personasAdapterInstance.close();
    personasAdapterInstance = null;
  }
}

export { PersonasSQLiteAdapter };