// LLM-specific SQLite adapter that only runs on server-side
// Uses dynamic imports to avoid bundling SQLite in client-side code

import type { DModelsService, DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import type { DLLM, DLLMId } from '~/common/stores/llms/llms.types';
import type { DModelDomainId } from '~/common/stores/llms/model.domains.types';
import type { DModelConfiguration } from '~/common/stores/llms/modelconfiguration.types';

interface LLMStoreData {
  llms: DLLM[];
  sources: DModelsService<any>[];
  confServiceId: DModelsServiceId | null;
  modelAssignments: Record<DModelDomainId, DModelConfiguration>;
}

interface DbService {
  id: string;
  vendor_id: string;
  label: string;
  setup: string;
  created_at: string;
  updated_at: string;
}

interface DbModel {
  id: string;
  service_id: string;
  vendor_id: string;
  label: string;
  created: string;
  updated?: string;
  description?: string;
  context_tokens?: number;
  max_output_tokens?: number;
  training_data_cutoff?: string;
  interfaces: string;
  input_types?: string;
  benchmark?: string;
  pricing?: string;
  initial_parameters?: string;
  user_parameters?: string;
  user_label?: string;
  user_hidden: number;
  user_starred: number;
  created_at: string;
  updated_at: string;
}

interface DbAssignment {
  domain_id: string;
  model_id: string;
  temperature?: number;
  max_tokens?: number;
  created_at: string;
  updated_at: string;
}

interface DbMetadata {
  key: string;
  value: string;
  updated_at: string;
}

export class SQLiteLLMAdapter {
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
      console.warn('[LLM SQLite] Skipping initialization on client-side');
      return;
    }

    try {
      // Dynamic import to avoid bundling in client-side
      const sqlite3 = await import('sqlite3');
      const Database = sqlite3.default;

      return new Promise((resolve, reject) => {
        // Create separate database for LLM data
        this.db = new Database.Database('big-agi-llms.db', (err: any) => {
          if (err) {
            console.error('[LLM SQLite] Error opening database:', err);
            reject(err);
            return;
          }

          console.log('[LLM SQLite] Connected to LLM SQLite database');
          this.createTables()
            .then(() => {
              this.initialized = true;
              resolve(undefined);
            })
            .catch(reject);
        });
      });
    } catch (error) {
      console.error('[LLM SQLite] Failed to initialize database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.isServer || !this.db) return;

    return new Promise((resolve, reject) => {
      const schema = `
        -- Services table - stores vendor services like OpenAI, Anthropic, etc.
        CREATE TABLE IF NOT EXISTS llm_services (
            id TEXT PRIMARY KEY,
            vendor_id TEXT NOT NULL,
            label TEXT NOT NULL,
            setup TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Models table - stores individual LLM models provided by services
        CREATE TABLE IF NOT EXISTS llm_models (
            id TEXT PRIMARY KEY,
            service_id TEXT NOT NULL,
            vendor_id TEXT NOT NULL,
            label TEXT NOT NULL,
            created TEXT NOT NULL,
            updated TEXT,
            description TEXT,
            context_tokens INTEGER,
            max_output_tokens INTEGER,
            training_data_cutoff TEXT,
            interfaces TEXT NOT NULL,
            input_types TEXT,
            benchmark TEXT,
            pricing TEXT,
            initial_parameters TEXT,
            user_parameters TEXT,
            user_label TEXT,
            user_hidden INTEGER DEFAULT 0,
            user_starred INTEGER DEFAULT 0,
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
      `;

      this.db.exec(schema, (err: any) => {
        if (err) {
          console.error('[LLM SQLite] Error creating tables:', err);
          reject(err);
        } else {
          console.log('[LLM SQLite] Tables initialized');
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

  private serviceToDb(service: DModelsService<any>): Omit<DbService, 'created_at' | 'updated_at'> {
    return {
      id: service.id,
      vendor_id: service.vId,
      label: service.label,
      setup: JSON.stringify(service.setup),
    };
  }

  private dbToService(dbService: DbService): DModelsService<any> {
    return {
      id: dbService.id as DModelsServiceId,
      vId: dbService.vendor_id as any,
      label: dbService.label,
      setup: JSON.parse(dbService.setup),
    };
  }

  private modelToDb(model: DLLM): Omit<DbModel, 'created_at' | 'updated_at'> {
    return {
      id: model.id,
      service_id: model.sId,
      vendor_id: model.vId,
      label: model.label,
      created: model.created,
      updated: model.updated,
      description: model.description,
      context_tokens: model.contextTokens,
      max_output_tokens: model.maxOutputTokens,
      training_data_cutoff: model.trainingDataCutoff,
      interfaces: JSON.stringify(model.interfaces),
      input_types: model.inputTypes ? JSON.stringify(model.inputTypes) : undefined,
      benchmark: model.benchmark ? JSON.stringify(model.benchmark) : undefined,
      pricing: model.pricing ? JSON.stringify(model.pricing) : undefined,
      initial_parameters: model.initialParameters ? JSON.stringify(model.initialParameters) : undefined,
      user_parameters: model.userParameters ? JSON.stringify(model.userParameters) : undefined,
      user_label: model.userLabel,
      user_hidden: model.userHidden ? 1 : 0,
      user_starred: model.userStarred ? 1 : 0,
    };
  }

  private dbToModel(dbModel: DbModel): DLLM {
    return {
      id: dbModel.id as DLLMId,
      sId: dbModel.service_id as DModelsServiceId,
      vId: dbModel.vendor_id as any,
      label: dbModel.label,
      created: dbModel.created,
      updated: dbModel.updated,
      description: dbModel.description,
      contextTokens: dbModel.context_tokens,
      maxOutputTokens: dbModel.max_output_tokens,
      trainingDataCutoff: dbModel.training_data_cutoff,
      interfaces: JSON.parse(dbModel.interfaces),
      inputTypes: dbModel.input_types ? JSON.parse(dbModel.input_types) : undefined,
      benchmark: dbModel.benchmark ? JSON.parse(dbModel.benchmark) : undefined,
      pricing: dbModel.pricing ? JSON.parse(dbModel.pricing) : undefined,
      initialParameters: dbModel.initial_parameters ? JSON.parse(dbModel.initial_parameters) : undefined,
      userParameters: dbModel.user_parameters ? JSON.parse(dbModel.user_parameters) : undefined,
      userLabel: dbModel.user_label,
      userHidden: dbModel.user_hidden === 1,
      userStarred: dbModel.user_starred === 1,
    };
  }

  async loadLLMStore(): Promise<LLMStoreData> {
    if (!this.isServer) {
      console.warn('[LLM SQLite] loadLLMStore called on client-side, returning empty data');
      return {
        llms: [],
        sources: [],
        confServiceId: null,
        modelAssignments: {},
      };
    }

    await this.waitForInitialization();

    if (!this.db) throw new Error('[LLM SQLite] Database not initialized');

    try {
      // Load services
      const servicesRows = await new Promise<DbService[]>((resolve, reject) => {
        this.db.all('SELECT * FROM llm_services ORDER BY created_at', (err: any, rows: DbService[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
      const sources = servicesRows.map((row) => this.dbToService(row));

      // Load models
      const modelsRows = await new Promise<DbModel[]>((resolve, reject) => {
        this.db.all('SELECT * FROM llm_models ORDER BY created_at', (err: any, rows: DbModel[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
      const llms = modelsRows.map((row) => this.dbToModel(row));

      // Load metadata
      const confServiceRow = await new Promise<DbMetadata | undefined>((resolve, reject) => {
        this.db.get('SELECT value FROM llm_store_metadata WHERE key = ?', ['conf_service_id'], (err: any, row: DbMetadata) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      const confServiceId = confServiceRow?.value || null;

      // Load assignments
      const assignmentsRows = await new Promise<DbAssignment[]>((resolve, reject) => {
        this.db.all('SELECT * FROM llm_assignments', (err: any, rows: DbAssignment[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      const modelAssignments: Record<DModelDomainId, DModelConfiguration> = {};
      for (const row of assignmentsRows) {
        modelAssignments[row.domain_id as DModelDomainId] = {
          domainId: row.domain_id as DModelDomainId,
          modelId: row.model_id as DLLMId,
          temperature: row.temperature,
          maxTokens: row.max_tokens,
        };
      }

      console.log(`[LLM SQLite] Loaded ${sources.length} services, ${llms.length} models, ${Object.keys(modelAssignments).length} assignments`);

      return {
        llms,
        sources,
        confServiceId: confServiceId as DModelsServiceId | null,
        modelAssignments,
      };
    } catch (error) {
      console.error('[LLM SQLite] Error loading LLM store:', error);
      return {
        llms: [],
        sources: [],
        confServiceId: null,
        modelAssignments: {},
      };
    }
  }

  async saveLLMStore(data: LLMStoreData): Promise<void> {
    if (!this.isServer) {
      console.warn('[LLM SQLite] saveLLMStore called on client-side, skipping');
      return;
    }

    await this.waitForInitialization();

    if (!this.db) throw new Error('[LLM SQLite] Database not initialized');

    return new Promise((resolve, reject) => {
      this.db.run('BEGIN TRANSACTION', (err: any) => {
        if (err) {
          reject(err);
          return;
        }

        const saveOperations = async () => {
          try {
            // Save services
            await new Promise<void>((resolveServices, rejectServices) => {
              this.db.run('DELETE FROM llm_services', (err: any) => {
                if (err) rejectServices(err);
                else resolveServices();
              });
            });

            for (const service of data.sources) {
              const dbService = this.serviceToDb(service);
              await new Promise<void>((resolveService, rejectService) => {
                this.db.run(
                  'INSERT INTO llm_services (id, vendor_id, label, setup) VALUES (?, ?, ?, ?)',
                  [dbService.id, dbService.vendor_id, dbService.label, dbService.setup],
                  (err: any) => {
                    if (err) rejectService(err);
                    else resolveService();
                  },
                );
              });
            }

            // Save models
            await new Promise<void>((resolveModels, rejectModels) => {
              this.db.run('DELETE FROM llm_models', (err: any) => {
                if (err) rejectModels(err);
                else resolveModels();
              });
            });

            for (const model of data.llms) {
              const dbModel = this.modelToDb(model);
              await new Promise<void>((resolveModel, rejectModel) => {
                this.db.run(
                  `INSERT INTO llm_models (
                    id, service_id, vendor_id, label, created, updated, description,
                    context_tokens, max_output_tokens, training_data_cutoff, interfaces,
                    input_types, benchmark, pricing, initial_parameters, user_parameters,
                    user_label, user_hidden, user_starred
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    dbModel.id,
                    dbModel.service_id,
                    dbModel.vendor_id,
                    dbModel.label,
                    dbModel.created,
                    dbModel.updated,
                    dbModel.description,
                    dbModel.context_tokens,
                    dbModel.max_output_tokens,
                    dbModel.training_data_cutoff,
                    dbModel.interfaces,
                    dbModel.input_types,
                    dbModel.benchmark,
                    dbModel.pricing,
                    dbModel.initial_parameters,
                    dbModel.user_parameters,
                    dbModel.user_label,
                    dbModel.user_hidden,
                    dbModel.user_starred,
                  ],
                  (err: any) => {
                    if (err) rejectModel(err);
                    else resolveModel();
                  },
                );
              });
            }

            // Save metadata
            await new Promise<void>((resolveMeta, rejectMeta) => {
              this.db.run('INSERT OR REPLACE INTO llm_store_metadata (key, value) VALUES (?, ?)', ['conf_service_id', data.confServiceId || ''], (err: any) => {
                if (err) rejectMeta(err);
                else resolveMeta();
              });
            });

            // Save assignments
            await new Promise<void>((resolveAssignments, rejectAssignments) => {
              this.db.run('DELETE FROM llm_assignments', (err: any) => {
                if (err) rejectAssignments(err);
                else resolveAssignments();
              });
            });

            for (const [domainId, config] of Object.entries(data.modelAssignments)) {
              await new Promise<void>((resolveAssignment, rejectAssignment) => {
                this.db.run(
                  'INSERT INTO llm_assignments (domain_id, model_id, temperature, max_tokens) VALUES (?, ?, ?, ?)',
                  [domainId, config.modelId, config.temperature, config.maxTokens],
                  (err: any) => {
                    if (err) rejectAssignment(err);
                    else resolveAssignment();
                  },
                );
              });
            }

            // Commit transaction
            this.db.run('COMMIT', (err: any) => {
              if (err) {
                reject(err);
              } else {
                console.log(
                  `[LLM SQLite] Saved ${data.sources.length} services, ${data.llms.length} models, ${Object.keys(data.modelAssignments).length} assignments`,
                );
                resolve();
              }
            });
          } catch (error) {
            this.db.run('ROLLBACK', () => {
              reject(error);
            });
          }
        };

        saveOperations();
      });
    });
  }

  async close(): Promise<void> {
    if (!this.isServer || !this.db) return;

    return new Promise((resolve) => {
      this.db.close((err: any) => {
        if (err) {
          console.error('[LLM SQLite] Error closing database:', err);
        } else {
          console.log('[LLM SQLite] Database connection closed');
        }
        this.db = null;
        this.initialized = false;
        resolve();
      });
    });
  }
}

// Singleton instance
let llmAdapterInstance: SQLiteLLMAdapter | null = null;

export function getLLMSQLiteAdapter(): SQLiteLLMAdapter {
  if (!llmAdapterInstance) {
    llmAdapterInstance = new SQLiteLLMAdapter();
  }
  return llmAdapterInstance;
}

// Export singleton instance
export const llmAdapter = getLLMSQLiteAdapter();
