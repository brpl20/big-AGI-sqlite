// SQLite database wrapper that only runs on server-side
// Uses dynamic imports to avoid bundling SQLite in client-side code

export interface StoreRecord {
  id: string;
  name: string;
  data: string; // JSON stringified data
  version: number;
  updated_at: string;
  created_at: string;
}

export interface StoreData {
  name: string;
  data: any;
  version?: number;
}

class SQLiteDatabase {
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
      console.warn('[SQLite] Skipping initialization on client-side');
      return;
    }

    try {
      // Dynamic import to avoid bundling in client-side
      const sqlite3 = await import('sqlite3');
      const Database = sqlite3.default;

      return new Promise((resolve, reject) => {
        // Create database in the project root (for development)
        this.db = new Database.Database('big-agi-data.db', (err: any) => {
          if (err) {
            console.error('Error opening database:', err);
            reject(err);
            return;
          }

          console.log('[SQLite] Connected to SQLite database');
          this.createTables()
            .then(() => {
              this.initialized = true;
              resolve(undefined);
            })
            .catch(reject);
        });
      });
    } catch (error) {
      console.error('[SQLite] Failed to initialize database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.isServer || !this.db) return;

    return new Promise((resolve, reject) => {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS stores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          data TEXT NOT NULL,
          version INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      this.db.run(createTableSQL, (err: any) => {
        if (err) {
          console.error('[SQLite] Error creating table:', err);
          reject(err);
        } else {
          console.log('[SQLite] Tables initialized');
          resolve();
        }
      });
    });
  }

  private async waitForInitialization(): Promise<void> {
    if (!this.isServer) return;

    while (!this.initialized) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async getAllStores(): Promise<StoreRecord[]> {
    if (!this.isServer) {
      console.warn('[SQLite] getAllStores called on client-side, returning empty array');
      return [];
    }

    await this.waitForInitialization();

    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM stores ORDER BY updated_at DESC';
      this.db.all(query, (err: any, rows: StoreRecord[]) => {
        if (err) {
          console.error('[SQLite] Error fetching stores:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  async getStore(name: string): Promise<any | null> {
    if (!this.isServer) {
      console.warn(`[SQLite] getStore(${name}) called on client-side, returning null`);
      return null;
    }

    await this.waitForInitialization();

    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const query = 'SELECT data FROM stores WHERE name = ?';
      this.db.get(query, [name], (err: any, row: any) => {
        if (err) {
          console.error(`[SQLite] Error fetching store '${name}':`, err);
          reject(err);
        } else if (!row) {
          resolve(null);
        } else {
          try {
            const data = JSON.parse(row.data);
            resolve(data);
          } catch (parseErr) {
            console.error(`[SQLite] Error parsing JSON for store '${name}':`, parseErr);
            reject(parseErr);
          }
        }
      });
    });
  }

  async saveStore(name: string, data: any, version: number = 1): Promise<void> {
    if (!this.isServer) {
      console.warn(`[SQLite] saveStore(${name}) called on client-side, skipping`);
      return;
    }

    await this.waitForInitialization();

    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const jsonData = JSON.stringify(data);
      const now = new Date().toISOString();

      const query = `
        INSERT INTO stores (name, data, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
          data = excluded.data,
          version = excluded.version,
          updated_at = excluded.updated_at
      `;

      this.db.run(query, [name, jsonData, version, now, now], function (err: any) {
        if (err) {
          console.error(`[SQLite] Error saving store '${name}':`, err);
          reject(err);
        } else {
          console.log(`[SQLite] Store '${name}' saved successfully`);
          resolve();
        }
      });
    });
  }

  async deleteStore(name: string): Promise<void> {
    if (!this.isServer) {
      console.warn(`[SQLite] deleteStore(${name}) called on client-side, skipping`);
      return;
    }

    await this.waitForInitialization();

    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM stores WHERE name = ?';
      this.db.run(query, [name], function (err: any) {
        if (err) {
          console.error(`[SQLite] Error deleting store '${name}':`, err);
          reject(err);
        } else {
          console.log(`[SQLite] Store '${name}' deleted successfully`);
          resolve();
        }
      });
    });
  }

  async close(): Promise<void> {
    if (!this.isServer || !this.db) return;

    return new Promise((resolve) => {
      this.db.close((err: any) => {
        if (err) {
          console.error('[SQLite] Error closing database:', err);
        } else {
          console.log('[SQLite] Database connection closed');
        }
        this.db = null;
        this.initialized = false;
        resolve();
      });
    });
  }
}

// Singleton instance
let sqliteInstance: SQLiteDatabase | null = null;

export function getSQLiteDatabase(dbName?: string): SQLiteDatabase {
  if (!sqliteInstance) {
    sqliteInstance = new SQLiteDatabase();
  }
  return sqliteInstance;
}

// Export the singleton for direct use
export const sqliteDB = getSQLiteDatabase();
