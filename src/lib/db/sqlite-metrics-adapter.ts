// Metrics-specific SQLite adapter that only runs on server-side
// Uses dynamic imports to avoid bundling SQLite in client-side code

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import type { MetricsChatGenerateCost_Md } from '~/common/stores/metrics/metrics.chatgenerate';

interface ServiceMetricsAggregate {
  totalCosts: number;
  totalSavings: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  usageCount: number;
  firstUsageDate: number;
  lastUsageDate: number;
  freeUsages: number;
  noPricingUsages: number;
  noTokenUsages: number;
  partialMessageUsages: number;
  partialPriceUsages: number;
}

interface MetricsStoreData {
  serviceMetrics: Record<DModelsServiceId, ServiceMetricsAggregate>;
}

interface DbMetricsEntry {
  id: number;
  service_id: string;
  costs_cents: number | null;
  savings_cents: number | null;
  cost_code: string | null;
  input_tokens: number;
  output_tokens: number;
  debug_cost_source: string | null;
  created_at: string;
}

interface DbServiceAggregate {
  service_id: string;
  total_costs_cents: number;
  total_savings_cents: number;
  total_input_tokens: number;
  total_output_tokens: number;
  usage_count: number;
  first_usage_date: number;
  last_usage_date: number;
  free_usages: number;
  no_pricing_usages: number;
  no_token_usages: number;
  partial_message_usages: number;
  partial_price_usages: number;
  updated_at: string;
}

const CENTS_TO_DOLLARS = 0.01;
const USD_TO_CENTS = 100;

export class SQLiteMetricsAdapter {
  private static instance: SQLiteMetricsAdapter | null = null;
  private db: any = null;
  private initialized = false;
  private isServer = typeof window === 'undefined';

  private constructor() {
    if (this.isServer) {
      this.initializeDatabase();
    }
  }

  static getInstance(): SQLiteMetricsAdapter {
    if (!SQLiteMetricsAdapter.instance) {
      SQLiteMetricsAdapter.instance = new SQLiteMetricsAdapter();
    }
    return SQLiteMetricsAdapter.instance;
  }

  private async initializeDatabase(): Promise<void> {
    if (!this.isServer) {
      console.warn('[Metrics SQLite] Skipping initialization on client-side');
      return;
    }

    try {
      // Dynamic import to avoid bundling in client-side
      const sqlite3 = await import('sqlite3');
      const Database = sqlite3.default;

      return new Promise((resolve, reject) => {
        this.db = new Database.Database('./big-agi-metrics.db', (err: any) => {
          if (err) {
            console.error('[Metrics SQLite] Error opening database:', err);
            reject(err);
            return;
          }

          console.log('[Metrics SQLite] Connected to metrics database');
          this.createTables()
            .then(() => {
              this.initialized = true;
              resolve();
            })
            .catch(reject);
        });
      });
    } catch (error) {
      console.error('[Metrics SQLite] Error importing sqlite3:', error);
      throw error;
    }
  }

  private waitForInitialization(): Promise<void> {
    return new Promise((resolve) => {
      const checkInitialized = () => {
        if (this.initialized) {
          resolve();
        } else {
          setTimeout(checkInitialized, 10);
        }
      };
      checkInitialized();
    });
  }

  private async createTables(): Promise<void> {
    try {
      const path = await import('path');
      const fs = await import('fs');
      
      const schemaPath = path.join(process.cwd(), 'src/lib/db/metrics-schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      
      return new Promise((resolve, reject) => {
        this.db.exec(schema, (err: any) => {
          if (err) {
            console.error('[Metrics SQLite] Error creating tables:', err);
            reject(err);
          } else {
            console.log('[Metrics SQLite] Tables created successfully');
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('[Metrics SQLite] Error reading schema file:', error);
      throw error;
    }
  }

  async addChatGenerateCostEntry(
    costs: MetricsChatGenerateCost_Md,
    inputTokens: number,
    outputTokens: number,
    serviceId: DModelsServiceId | null,
    debugCostSource: string
  ): Promise<void> {
    if (!serviceId) return;

    await this.waitForInitialization();

    const costsCents = costs.$c !== undefined ? Math.round(costs.$c * USD_TO_CENTS) : null;
    const savingsCents = costs.$cdCache !== undefined ? Math.round(costs.$cdCache * USD_TO_CENTS) : null;

    try {
      // Insert individual metrics entry (append-only)
      return new Promise((resolve, reject) => {
        this.db.run(
          `INSERT INTO metrics_entries (service_id, costs_cents, savings_cents, cost_code, input_tokens, output_tokens, debug_cost_source)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [serviceId, costsCents, savingsCents, costs.$code || null, inputTokens, outputTokens, debugCostSource],
          async (err: any) => {
            if (err) {
              console.error('[Metrics SQLite] Error adding cost entry:', err);
              reject(err);
              return;
            }

            try {
              // Update or create aggregate
              await this.updateServiceAggregate(serviceId, costs, inputTokens, outputTokens);
              console.log('[Metrics SQLite] Added cost entry for service:', serviceId);
              resolve();
            } catch (aggregateError) {
              reject(aggregateError);
            }
          }
        );
      });
    } catch (error) {
      console.error('[Metrics SQLite] Error adding cost entry:', error);
      throw error;
    }
  }

  private async updateServiceAggregate(
    serviceId: DModelsServiceId,
    costs: MetricsChatGenerateCost_Md,
    inputTokens: number,
    outputTokens: number
  ): Promise<void> {
    const now = Date.now();

    return new Promise((resolve, reject) => {
      // Get current aggregate or create new one
      this.db.get(
        `SELECT * FROM service_metrics_aggregates WHERE service_id = ?`,
        [serviceId],
        (err: any, currentAggregate: DbServiceAggregate | undefined) => {
          if (err) {
            reject(err);
            return;
          }

          if (!currentAggregate) {
            // Create new aggregate first
            this.db.run(
              `INSERT INTO service_metrics_aggregates (
                service_id, total_costs_cents, total_savings_cents, total_input_tokens, total_output_tokens,
                usage_count, first_usage_date, last_usage_date, free_usages, no_pricing_usages,
                no_token_usages, partial_message_usages, partial_price_usages
              ) VALUES (?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)`,
              [serviceId],
              (insertErr: any) => {
                if (insertErr) {
                  reject(insertErr);
                  return;
                }

                // Get the newly created aggregate
                this.db.get(
                  `SELECT * FROM service_metrics_aggregates WHERE service_id = ?`,
                  [serviceId],
                  (getErr: any, newAggregate: DbServiceAggregate) => {
                    if (getErr) {
                      reject(getErr);
                      return;
                    }
                    this.doUpdateAggregate(newAggregate, serviceId, costs, inputTokens, outputTokens, now, resolve, reject);
                  }
                );
              }
            );
          } else {
            this.doUpdateAggregate(currentAggregate, serviceId, costs, inputTokens, outputTokens, now, resolve, reject);
          }
        }
      );
    });
  }

  private doUpdateAggregate(
    currentAggregate: DbServiceAggregate,
    serviceId: DModelsServiceId,
    costs: MetricsChatGenerateCost_Md,
    inputTokens: number,
    outputTokens: number,
    now: number,
    resolve: () => void,
    reject: (error: any) => void
  ): void {
    // Calculate new values
    const newTotalCostsCents = currentAggregate.total_costs_cents +
      (costs.$c !== undefined ? Math.round(costs.$c * USD_TO_CENTS) : 0);
    const newTotalSavingsCents = currentAggregate.total_savings_cents +
      (costs.$cdCache !== undefined ? Math.round(costs.$cdCache * USD_TO_CENTS) : 0);
    const newTotalInputTokens = currentAggregate.total_input_tokens + inputTokens;
    const newTotalOutputTokens = currentAggregate.total_output_tokens + outputTokens;
    const newUsageCount = currentAggregate.usage_count + 1;
    const newFirstUsageDate = currentAggregate.first_usage_date || now;
    const newLastUsageDate = now;

    // Calculate counter increments
    const counters = {
      freeUsages: currentAggregate.free_usages + (costs.$code === 'free' ? 1 : 0),
      noPricingUsages: currentAggregate.no_pricing_usages + (costs.$code === 'no-pricing' ? 1 : 0),
      noTokenUsages: currentAggregate.no_token_usages + (costs.$code === 'no-tokens' ? 1 : 0),
      partialMessageUsages: currentAggregate.partial_message_usages + (costs.$code === 'partial-msg' ? 1 : 0),
      partialPriceUsages: currentAggregate.partial_price_usages + (costs.$code === 'partial-price' ? 1 : 0),
    };

    // Update aggregate
    this.db.run(
      `UPDATE service_metrics_aggregates 
       SET total_costs_cents = ?, total_savings_cents = ?, total_input_tokens = ?, total_output_tokens = ?,
           usage_count = ?, first_usage_date = ?, last_usage_date = ?,
           free_usages = ?, no_pricing_usages = ?, no_token_usages = ?,
           partial_message_usages = ?, partial_price_usages = ?
       WHERE service_id = ?`,
      [
        newTotalCostsCents, newTotalSavingsCents, newTotalInputTokens, newTotalOutputTokens,
        newUsageCount, newFirstUsageDate, newLastUsageDate,
        counters.freeUsages, counters.noPricingUsages, counters.noTokenUsages,
        counters.partialMessageUsages, counters.partialPriceUsages,
        serviceId
      ],
      (updateErr: any) => {
        if (updateErr) {
          reject(updateErr);
        } else {
          resolve();
        }
      }
    );
  }

  async getAggregateMetricsForService(serviceId: DModelsServiceId): Promise<ServiceMetricsAggregate | undefined> {
    await this.waitForInitialization();

    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM service_metrics_aggregates WHERE service_id = ?`,
        [serviceId],
        (err: any, dbAggregate: DbServiceAggregate | undefined) => {
          if (err) {
            console.error('[Metrics SQLite] Error getting aggregate metrics:', err);
            resolve(undefined);
            return;
          }

          if (!dbAggregate) {
            resolve(undefined);
            return;
          }

          resolve({
            totalCosts: dbAggregate.total_costs_cents * CENTS_TO_DOLLARS,
            totalSavings: dbAggregate.total_savings_cents * CENTS_TO_DOLLARS,
            totalInputTokens: dbAggregate.total_input_tokens,
            totalOutputTokens: dbAggregate.total_output_tokens,
            usageCount: dbAggregate.usage_count,
            firstUsageDate: dbAggregate.first_usage_date,
            lastUsageDate: dbAggregate.last_usage_date,
            freeUsages: dbAggregate.free_usages,
            noPricingUsages: dbAggregate.no_pricing_usages,
            noTokenUsages: dbAggregate.no_token_usages,
            partialMessageUsages: dbAggregate.partial_message_usages,
            partialPriceUsages: dbAggregate.partial_price_usages,
          });
        }
      );
    });
  }

  async getAllServiceMetrics(): Promise<Record<DModelsServiceId, ServiceMetricsAggregate>> {
    await this.waitForInitialization();

    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM service_metrics_aggregates`,
        [],
        (err: any, dbAggregates: DbServiceAggregate[]) => {
          if (err) {
            console.error('[Metrics SQLite] Error getting all service metrics:', err);
            resolve({});
            return;
          }

          const result: Record<DModelsServiceId, ServiceMetricsAggregate> = {};

          for (const dbAggregate of dbAggregates || []) {
            result[dbAggregate.service_id as DModelsServiceId] = {
              totalCosts: dbAggregate.total_costs_cents * CENTS_TO_DOLLARS,
              totalSavings: dbAggregate.total_savings_cents * CENTS_TO_DOLLARS,
              totalInputTokens: dbAggregate.total_input_tokens,
              totalOutputTokens: dbAggregate.total_output_tokens,
              usageCount: dbAggregate.usage_count,
              firstUsageDate: dbAggregate.first_usage_date,
              lastUsageDate: dbAggregate.last_usage_date,
              freeUsages: dbAggregate.free_usages,
              noPricingUsages: dbAggregate.no_pricing_usages,
              noTokenUsages: dbAggregate.no_token_usages,
              partialMessageUsages: dbAggregate.partial_message_usages,
              partialPriceUsages: dbAggregate.partial_price_usages,
            };
          }

          resolve(result);
        }
      );
    });
  }

  async saveStoreData(data: MetricsStoreData): Promise<void> {
    await this.waitForInitialization();

    return new Promise((resolve, reject) => {
      const jsonData = JSON.stringify(data);
      
      this.db.run(
        `INSERT OR REPLACE INTO metrics_store (key, data) VALUES ('metrics', ?)`,
        [jsonData],
        (err: any) => {
          if (err) {
            console.error('[Metrics SQLite] Error saving store data:', err);
            reject(err);
          } else {
            console.log('[Metrics SQLite] Store data saved');
            resolve();
          }
        }
      );
    });
  }

  async getStoreData(): Promise<MetricsStoreData | null> {
    await this.initializeDb();

    try {
      const getStore = this.db.prepare(`
        SELECT data FROM metrics_store WHERE key = 'metrics'
      `);

      const result = getStore.get();
      if (!result) return null;

      return JSON.parse(result.data);
    } catch (error) {
      console.error('[Metrics SQLite] Error getting store data:', error);
      return null;
    }
  }

  async clearAllData(): Promise<void> {
    await this.waitForInitialization();

    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM metrics_entries', (err1: any) => {
        if (err1) {
          reject(err1);
          return;
        }
        
        this.db.run('DELETE FROM service_metrics_aggregates', (err2: any) => {
          if (err2) {
            reject(err2);
            return;
          }
          
          this.db.run('DELETE FROM metrics_store', (err3: any) => {
            if (err3) {
              reject(err3);
            } else {
              console.log('[Metrics SQLite] All data cleared');
              resolve();
            }
          });
        });
      });
    });
  }

  async getMetricsEntries(serviceId?: DModelsServiceId, limit: number = 100): Promise<DbMetricsEntry[]> {
    await this.initializeDb();

    try {
      let query = 'SELECT * FROM metrics_entries';
      let params: any[] = [];

      if (serviceId) {
        query += ' WHERE service_id = ?';
        params.push(serviceId);
      }

      query += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);

      const getEntries = this.db.prepare(query);
      return getEntries.all(...params) as DbMetricsEntry[];
    } catch (error) {
      console.error('[Metrics SQLite] Error getting metrics entries:', error);
      return [];
    }
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('[Metrics SQLite] Database connection closed');
    }
  }
}