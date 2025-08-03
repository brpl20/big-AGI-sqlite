// Workspace-specific SQLite adapter that only runs on server-side
// Uses dynamic imports to avoid bundling SQLite in client-side code

import type { LiveFileId } from '~/common/livefile/liveFile.types';

export interface WorkspaceState {
  liveFilesByWorkspace: Record<string, LiveFileId[]>;
}

export interface WorkspaceAdapter {
  saveStore(data: WorkspaceState): Promise<void>;
  loadStore(): Promise<WorkspaceState | null>;
  clear(): Promise<void>;
  
  // Individual operations
  removeWorkspace(workspaceId: string): Promise<void>;
  assignLiveFile(workspaceId: string, fileId: LiveFileId): Promise<void>;
  unassignLiveFile(workspaceId: string, fileId: LiveFileId): Promise<void>;
  unassignLiveFileFromAll(fileId: LiveFileId): Promise<void>;
  getWorkspaceFiles(workspaceId: string): Promise<LiveFileId[]>;
  copyAssignments(sourceWorkspaceId: string, targetWorkspaceId: string): Promise<void>;
}

export class SQLiteWorkspaceAdapter implements WorkspaceAdapter {
  private static instance: SQLiteWorkspaceAdapter | null = null;
  private db: any = null;
  private initialized = false;
  private isServer = typeof window === 'undefined';

  private constructor() {}

  static getInstance(): SQLiteWorkspaceAdapter {
    if (!SQLiteWorkspaceAdapter.instance) {
      SQLiteWorkspaceAdapter.instance = new SQLiteWorkspaceAdapter();
    }
    return SQLiteWorkspaceAdapter.instance;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized || !this.isServer) return;

    try {
      // Dynamic import to avoid bundling sqlite3 in client-side code
      const sqlite3 = await import('sqlite3');
      const Database = sqlite3.default;

      if (!Database || typeof Database.Database !== 'function') {
        throw new Error('Failed to load SQLite3 Database constructor');
      }

      const fs = await import('fs');
      const path = await import('path');

      const dbPath = path.join(process.cwd(), 'big-agi-workspace.db');
      this.db = new Database.Database(dbPath);
      
      // Initialize schema
      const schemaPath = path.join(process.cwd(), 'src', 'lib', 'db', 'workspace-schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      await new Promise<void>((resolve, reject) => {
        this.db.exec(schema, (err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      this.initialized = true;
      console.log('[SQLiteWorkspaceAdapter] Initialized successfully');
    } catch (error) {
      console.error('[SQLiteWorkspaceAdapter] Failed to initialize:', error);
      throw error;
    }
  }

  async saveStore(data: WorkspaceState): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        // Clear existing data
        this.db.run('DELETE FROM workspace_livefiles', (err: any) => {
          if (err) {
            this.db.run('ROLLBACK');
            return reject(err);
          }
        });

        // Insert new associations
        const stmt = this.db.prepare(`
          INSERT OR REPLACE INTO workspace_livefiles (workspace_id, live_file_id)
          VALUES (?, ?)
        `);

        let pendingInserts = 0;
        let completed = 0;
        let hasError = false;

        // Count total inserts needed
        for (const [workspaceId, fileIds] of Object.entries(data.liveFilesByWorkspace)) {
          pendingInserts += fileIds.length;
        }

        if (pendingInserts === 0) {
          // No data to insert, just save the store data
          this.db.run(
            'INSERT OR REPLACE INTO workspace_store (id, store_data, updated_at) VALUES (1, ?, datetime("now"))',
            [JSON.stringify(data)],
            (err: any) => {
              if (err) {
                this.db.run('ROLLBACK');
                reject(err);
              } else {
                this.db.run('COMMIT');
                resolve();
              }
            }
          );
          return;
        }

        // Insert all associations
        for (const [workspaceId, fileIds] of Object.entries(data.liveFilesByWorkspace)) {
          for (const fileId of fileIds) {
            stmt.run([workspaceId, fileId], (err: any) => {
              if (err && !hasError) {
                hasError = true;
                this.db.run('ROLLBACK');
                reject(err);
                return;
              }
              
              completed++;
              if (completed === pendingInserts && !hasError) {
                // Save the complete store data
                this.db.run(
                  'INSERT OR REPLACE INTO workspace_store (id, store_data, updated_at) VALUES (1, ?, datetime("now"))',
                  [JSON.stringify(data)],
                  (storeErr: any) => {
                    if (storeErr) {
                      this.db.run('ROLLBACK');
                      reject(storeErr);
                    } else {
                      this.db.run('COMMIT');
                      resolve();
                    }
                  }
                );
              }
            });
          }
        }

        stmt.finalize();
      });
    });
  }

  async loadStore(): Promise<WorkspaceState | null> {
    await this.ensureInitialized();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      // Try to load from store_data first (complete state)
      this.db.get(
        'SELECT store_data FROM workspace_store ORDER BY updated_at DESC LIMIT 1',
        (err: any, row: any) => {
          if (err) {
            reject(err);
            return;
          }

          if (row?.store_data) {
            try {
              const data = JSON.parse(row.store_data);
              resolve(data);
              return;
            } catch (parseErr) {
              console.warn('[SQLiteWorkspaceAdapter] Failed to parse store_data, falling back to associations');
            }
          }

          // Fallback: reconstruct from associations table
          this.db.all(
            'SELECT workspace_id, live_file_id FROM workspace_livefiles ORDER BY workspace_id, created_at',
            (assocErr: any, rows: any[]) => {
              if (assocErr) {
                reject(assocErr);
                return;
              }

              const liveFilesByWorkspace: Record<string, LiveFileId[]> = {};
              
              for (const row of rows || []) {
                if (!liveFilesByWorkspace[row.workspace_id]) {
                  liveFilesByWorkspace[row.workspace_id] = [];
                }
                liveFilesByWorkspace[row.workspace_id].push(row.live_file_id);
              }

              resolve({ liveFilesByWorkspace });
            }
          );
        }
      );
    });
  }

  async clear(): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        this.db.run('DELETE FROM workspace_livefiles', (err1: any) => {
          if (err1) {
            this.db.run('ROLLBACK');
            reject(err1);
            return;
          }
          this.db.run('DELETE FROM workspace_store', (err2: any) => {
            if (err2) {
              this.db.run('ROLLBACK');
              reject(err2);
            } else {
              this.db.run('COMMIT');
              resolve();
            }
          });
        });
      });
    });
  }

  async removeWorkspace(workspaceId: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM workspace_livefiles WHERE workspace_id = ?',
        [workspaceId],
        (err: any) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async assignLiveFile(workspaceId: string, fileId: LiveFileId): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR IGNORE INTO workspace_livefiles (workspace_id, live_file_id) VALUES (?, ?)',
        [workspaceId, fileId],
        (err: any) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async unassignLiveFile(workspaceId: string, fileId: LiveFileId): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM workspace_livefiles WHERE workspace_id = ? AND live_file_id = ?',
        [workspaceId, fileId],
        (err: any) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async unassignLiveFileFromAll(fileId: LiveFileId): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM workspace_livefiles WHERE live_file_id = ?',
        [fileId],
        (err: any) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async getWorkspaceFiles(workspaceId: string): Promise<LiveFileId[]> {
    await this.ensureInitialized();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT live_file_id FROM workspace_livefiles WHERE workspace_id = ? ORDER BY created_at',
        [workspaceId],
        (err: any, rows: any[]) => {
          if (err) reject(err);
          else resolve((rows || []).map(row => row.live_file_id));
        }
      );
    });
  }

  async copyAssignments(sourceWorkspaceId: string, targetWorkspaceId: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT OR IGNORE INTO workspace_livefiles (workspace_id, live_file_id)
        SELECT ?, live_file_id FROM workspace_livefiles WHERE workspace_id = ?
      `, [targetWorkspaceId, sourceWorkspaceId], (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export const sqliteWorkspaceAdapter = SQLiteWorkspaceAdapter.getInstance();