// Migration utility to transfer data from IndexedDB to SQLite
import { manualSaveStore } from './zustand-sqlite-middleware';

interface IndexedDBStore {
  name: string;
  data: any;
  version?: number;
}

class IndexedDBToSQLiteMigrator {
  private dbNames = ['app-chats', 'app-models', 'app-device', 'app-metrics', 'app-ui-preferences', 'app-ux-labs', 'app-folders', 'app-workspace'];

  /**
   * Get all available IndexedDB databases
   */
  private async getAvailableDatabases(): Promise<string[]> {
    if (!('databases' in indexedDB)) {
      console.warn('IndexedDB.databases() not supported, using default list');
      return this.dbNames;
    }

    try {
      const databases = await indexedDB.databases();
      return databases.map((db) => db.name).filter((name) => name !== undefined) as string[];
    } catch (error) {
      console.warn('Failed to get IndexedDB databases, using default list:', error);
      return this.dbNames;
    }
  }

  /**
   * Extract data from a specific IndexedDB database
   */
  private async extractFromIndexedDB(dbName: string): Promise<IndexedDBStore | null> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName);

      request.onerror = () => {
        console.error(`Failed to open IndexedDB: ${dbName}`);
        resolve(null);
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        try {
          // Most Zustand stores use a single object store
          const objectStoreNames = Array.from(db.objectStoreNames);

          if (objectStoreNames.length === 0) {
            console.warn(`No object stores found in ${dbName}`);
            db.close();
            resolve(null);
            return;
          }

          // Use the first object store (Zustand typically uses one)
          const storeName = objectStoreNames[0];
          const transaction = db.transaction([storeName], 'readonly');
          const objectStore = transaction.objectStore(storeName);

          // Get all data from the store
          const getAllRequest = objectStore.getAll();

          getAllRequest.onsuccess = () => {
            const allData = getAllRequest.result;
            db.close();

            if (allData && allData.length > 0) {
              // For Zustand stores, typically there's one record with the state
              const storeData = allData[0];

              resolve({
                name: dbName,
                data: storeData,
                version: 1, // Default version if not specified
              });
            } else {
              console.warn(`No data found in ${dbName}`);
              resolve(null);
            }
          };

          getAllRequest.onerror = () => {
            console.error(`Failed to read data from ${dbName}`);
            db.close();
            resolve(null);
          };
        } catch (error) {
          console.error(`Error accessing object store in ${dbName}:`, error);
          db.close();
          resolve(null);
        }
      };

      request.onupgradeneeded = () => {
        // Database doesn't exist or needs upgrade
        console.warn(`Database ${dbName} doesn't exist or needs upgrade`);
        resolve(null);
      };
    });
  }

  /**
   * Migrate a single store from IndexedDB to SQLite
   */
  private async migrateStore(store: IndexedDBStore): Promise<boolean> {
    try {
      await manualSaveStore(store.name, store.data, store.version || 1);
      console.log(`✓ Migrated store: ${store.name}`);
      return true;
    } catch (error) {
      console.error(`✗ Failed to migrate store ${store.name}:`, error);
      return false;
    }
  }

  /**
   * Get migration preview - shows what data would be migrated
   */
  async getOrganizationPreview(): Promise<{
    availableDatabases: string[];
    extractedStores: IndexedDBStore[];
    errors: string[];
  }> {
    const errors: string[] = [];
    const extractedStores: IndexedDBStore[] = [];

    try {
      const availableDatabases = await this.getAvailableDatabases();
      console.log('Available IndexedDB databases:', availableDatabases);

      for (const dbName of availableDatabases) {
        try {
          const store = await this.extractFromIndexedDB(dbName);
          if (store) {
            extractedStores.push(store);
          }
        } catch (error) {
          const errorMsg = `Failed to extract ${dbName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      return {
        availableDatabases,
        extractedStores,
        errors,
      };
    } catch (error) {
      const errorMsg = `Failed to get migration preview: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      return {
        availableDatabases: [],
        extractedStores: [],
        errors,
      };
    }
  }

  /**
   * Perform full migration from IndexedDB to SQLite
   */
  async performMigration(
    options: {
      dryRun?: boolean;
      onProgress?: (current: number, total: number, storeName: string) => void;
      onStoreComplete?: (storeName: string, success: boolean) => void;
    } = {},
  ): Promise<{
    success: boolean;
    migratedStores: string[];
    failedStores: string[];
    errors: string[];
  }> {
    const { dryRun = false, onProgress, onStoreComplete } = options;
    const migratedStores: string[] = [];
    const failedStores: string[] = [];
    const errors: string[] = [];

    try {
      console.log(dryRun ? 'Starting migration preview...' : 'Starting migration...');

      const preview = await this.getOrganizationPreview();

      if (preview.errors.length > 0) {
        errors.push(...preview.errors);
      }

      const storesToMigrate = preview.extractedStores;
      console.log(
        `Found ${storesToMigrate.length} stores to migrate:`,
        storesToMigrate.map((s) => s.name),
      );

      for (let i = 0; i < storesToMigrate.length; i++) {
        const store = storesToMigrate[i];

        if (onProgress) {
          onProgress(i + 1, storesToMigrate.length, store.name);
        }

        if (dryRun) {
          console.log(`[DRY RUN] Would migrate: ${store.name} (${JSON.stringify(store.data).length} chars)`);
          migratedStores.push(store.name);
          if (onStoreComplete) {
            onStoreComplete(store.name, true);
          }
        } else {
          const success = await this.migrateStore(store);

          if (success) {
            migratedStores.push(store.name);
          } else {
            failedStores.push(store.name);
            errors.push(`Failed to migrate ${store.name}`);
          }

          if (onStoreComplete) {
            onStoreComplete(store.name, success);
          }
        }
      }

      const success = failedStores.length === 0;

      console.log(dryRun ? 'Migration preview completed' : 'Migration completed');
      console.log(`Successfully processed: ${migratedStores.length}`);
      console.log(`Failed: ${failedStores.length}`);

      return {
        success,
        migratedStores,
        failedStores,
        errors,
      };
    } catch (error) {
      const errorMsg = `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.error(errorMsg);

      return {
        success: false,
        migratedStores,
        failedStores,
        errors,
      };
    }
  }

  /**
   * Clear all IndexedDB data (use with caution!)
   */
  async clearIndexedDB(): Promise<{
    success: boolean;
    clearedDatabases: string[];
    errors: string[];
  }> {
    const clearedDatabases: string[] = [];
    const errors: string[] = [];

    try {
      const availableDatabases = await this.getAvailableDatabases();

      for (const dbName of availableDatabases) {
        try {
          await this.deleteDatabase(dbName);
          clearedDatabases.push(dbName);
          console.log(`✓ Cleared IndexedDB: ${dbName}`);
        } catch (error) {
          const errorMsg = `Failed to clear ${dbName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      return {
        success: errors.length === 0,
        clearedDatabases,
        errors,
      };
    } catch (error) {
      const errorMsg = `Failed to clear IndexedDB: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);

      return {
        success: false,
        clearedDatabases,
        errors,
      };
    }
  }

  /**
   * Delete a specific IndexedDB database
   */
  private async deleteDatabase(dbName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase(dbName);

      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
      deleteRequest.onblocked = () => {
        console.warn(`Deletion of ${dbName} is blocked. Close other tabs/windows using this database.`);
        // Don't reject, as it might still complete
      };
    });
  }

  /**
   * Verify migration by comparing data
   */
  async verifyMigration(): Promise<{
    success: boolean;
    verifiedStores: string[];
    mismatches: string[];
    errors: string[];
  }> {
    const verifiedStores: string[] = [];
    const mismatches: string[] = [];
    const errors: string[] = [];

    try {
      const preview = await this.getOrganizationPreview();

      for (const indexedStore of preview.extractedStores) {
        try {
          // Fetch the corresponding data from SQLite
          const response = await fetch(`/api/stores/${indexedStore.name}`);

          if (response.status === 404) {
            mismatches.push(`${indexedStore.name}: Not found in SQLite`);
            continue;
          }

          if (!response.ok) {
            errors.push(`${indexedStore.name}: Failed to fetch from SQLite`);
            continue;
          }

          const sqliteResult = await response.json();

          // Compare data (basic comparison)
          const indexedDataStr = JSON.stringify(indexedStore.data);
          const sqliteDataStr = JSON.stringify(sqliteResult.data);

          if (indexedDataStr === sqliteDataStr) {
            verifiedStores.push(indexedStore.name);
            console.log(`✓ Verified: ${indexedStore.name}`);
          } else {
            mismatches.push(`${indexedStore.name}: Data mismatch`);
            console.warn(`⚠ Mismatch: ${indexedStore.name}`);
          }
        } catch (error) {
          const errorMsg = `${indexedStore.name}: Verification error - ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
        }
      }

      return {
        success: mismatches.length === 0 && errors.length === 0,
        verifiedStores,
        mismatches,
        errors,
      };
    } catch (error) {
      const errorMsg = `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);

      return {
        success: false,
        verifiedStores,
        mismatches,
        errors,
      };
    }
  }
}

// Export singleton instance
export const migrator = new IndexedDBToSQLiteMigrator();

// Convenience functions
export async function getMigrationPreview() {
  return migrator.getOrganizationPreview();
}

export async function performMigration(options?: Parameters<typeof migrator.performMigration>[0]) {
  return migrator.performMigration(options);
}

export async function verifyMigration() {
  return migrator.verifyMigration();
}

export async function clearIndexedDB() {
  return migrator.clearIndexedDB();
}
