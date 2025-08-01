import { StateCreator, StoreMutatorIdentifier } from 'zustand';

type Write<T, U> = Omit<T, keyof U> & U;
type Cast<T, U> = T extends U ? T : U;

export interface SqlitePersistOptions {
  name: string;
  version?: number;
  onRehydrateStorage?: () => ((state?: any) => void) | void;
  migrate?: (persistedState: any, version: number) => any;
  partialize?: (state: any) => any;
}

export interface SqlitePersistApi {
  rehydrate: () => Promise<void>;
  hasHydrated: () => boolean;
  persist: {
    setOptions: (options: Partial<SqlitePersistOptions>) => void;
    clearStorage: () => Promise<void>;
    getOptions: () => SqlitePersistOptions;
  };
}

type SqlitePersist = <T, Mps extends [StoreMutatorIdentifier, unknown][] = [], Mcs extends [StoreMutatorIdentifier, unknown][] = []>(
  initializer: StateCreator<T, Mps, Mcs>,
  options: SqlitePersistOptions,
) => StateCreator<T & SqlitePersistApi, Mps, [['zustand/sqlite-persist', never], ...Mcs]>;

type SqlitePersistImpl = <T>(storeInitializer: StateCreator<T, [], []>, options: SqlitePersistOptions) => StateCreator<T & SqlitePersistApi, [], []>;

// API client for store operations
class StoreApiClient {
  private getBaseUrl(): string {
    // Handle different environments (SSR, client-side, etc.)
    if (typeof window !== 'undefined') {
      // Client-side: use relative URL
      return '/api/stores';
    } else {
      // Server-side: use absolute URL or skip
      return 'http://localhost:3001/api/stores';
    }
  }

  async getStore(name: string): Promise<any | null> {
    // Skip fetch during SSR to avoid issues
    if (typeof window === 'undefined') {
      console.log('[SQLite] Skipping fetch during SSR');
      return null;
    }

    try {
      const response = await fetch(`${this.getBaseUrl()}/${name}`);

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to fetch store: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error(`Error fetching store '${name}':`, error);
      // Return null instead of throwing to prevent blocking on client-side
      return null;
    }
  }

  async saveStore(name: string, data: any, version: number = 1): Promise<void> {
    // Skip fetch during SSR
    if (typeof window === 'undefined') {
      console.log('[SQLite] Skipping save during SSR');
      return;
    }

    try {
      const response = await fetch(`${this.getBaseUrl()}/${name}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data, version }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to save store: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error(`Error saving store '${name}':`, error);
      // Don't throw to prevent blocking on save errors
    }
  }

  async deleteStore(name: string): Promise<void> {
    // Skip fetch during SSR
    if (typeof window === 'undefined') {
      console.log('[SQLite] Skipping delete during SSR');
      return;
    }

    try {
      const response = await fetch(`${this.getBaseUrl()}/${name}`, {
        method: 'DELETE',
      });

      if (response.status === 404) {
        // Store doesn't exist, consider it a success
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to delete store: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error(`Error deleting store '${name}':`, error);
      // Don't throw to prevent blocking on delete errors
    }
  }
}

const storeApiClient = new StoreApiClient();

const sqlitePersistImpl: SqlitePersistImpl = (storeInitializer, options) => {
  return (set, get, store) => {
    const { name, version = 1, onRehydrateStorage, migrate, partialize } = options;

    let hasHydrated = false;
    let currentOptions = options;

    // Function to save current state to SQLite
    const saveToSqlite = async (state: any) => {
      try {
        const stateToSave = partialize ? partialize(state) : state;
        await storeApiClient.saveStore(name, stateToSave, version);
      } catch (error) {
        console.error(`Failed to persist store '${name}':`, error);
      }
    };

    // Function to load state from SQLite
    const loadFromSqlite = async (): Promise<any | null> => {
      try {
        const persistedState = await storeApiClient.getStore(name);

        if (persistedState === null) {
          return null;
        }

        // Apply migration if needed
        if (migrate && persistedState) {
          return migrate(persistedState, version);
        }

        return persistedState;
      } catch (error) {
        console.error(`Failed to load store '${name}':`, error);
        return null;
      }
    };

    // Enhanced set function that automatically persists changes
    const enhancedSet: typeof set = (...args) => {
      set(...args);

      // Debounce saving to avoid too frequent writes
      if (!hasHydrated || typeof window === 'undefined') return; // Don't save during rehydration or SSR

      setTimeout(() => {
        const currentState = get();
        saveToSqlite(currentState);
      }, 100);
    };

    // Rehydration function
    const rehydrate = async (): Promise<void> => {
      // Skip rehydration during SSR
      if (typeof window === 'undefined') {
        hasHydrated = true;
        return;
      }

      try {
        const persistedState = await loadFromSqlite();

        if (persistedState !== null) {
          // Update the state with persisted data
          set(persistedState, true); // true = replace entire state
        }

        hasHydrated = true;

        // Call onRehydrateStorage callback if provided
        if (onRehydrateStorage) {
          const callback = onRehydrateStorage();
          if (callback) {
            callback(get());
          }
        }
      } catch (error) {
        console.error(`Failed to rehydrate store '${name}':`, error);
        hasHydrated = true; // Mark as hydrated even on error to prevent blocking
      }
    };

    // Initialize the store with the initial state
    const initialState = storeInitializer(enhancedSet, get, store);

    // Create the enhanced state with persistence methods
    const enhancedState = {
      ...initialState,
      rehydrate,
      hasHydrated: () => hasHydrated,
      persist: {
        setOptions: (newOptions: Partial<SqlitePersistOptions>) => {
          currentOptions = { ...currentOptions, ...newOptions };
        },
        clearStorage: async () => {
          try {
            await storeApiClient.deleteStore(name);
          } catch (error) {
            console.error(`Failed to clear storage for store '${name}':`, error);
          }
        },
        getOptions: () => currentOptions,
      },
    };

    // Start rehydration process asynchronously (client-side only)
    if (typeof window !== 'undefined') {
      setTimeout(() => rehydrate(), 0);
    } else {
      // Mark as hydrated immediately on server-side
      hasHydrated = true;
    }

    return enhancedState;
  };
};

export const sqlitePersist = sqlitePersistImpl as unknown as SqlitePersist;

// Helper function to create a store with SQLite persistence
export function createSqlitePersistedStore<T>(storeInitializer: StateCreator<T, [], []>, options: SqlitePersistOptions) {
  return sqlitePersist(storeInitializer, options);
}

// Utility function to manually trigger save (useful for testing)
export async function manualSaveStore(storeName: string, data: any, version: number = 1) {
  return storeApiClient.saveStore(storeName, data, version);
}

// Utility function to manually load store (useful for testing)
export async function manualLoadStore(storeName: string) {
  return storeApiClient.getStore(storeName);
}
