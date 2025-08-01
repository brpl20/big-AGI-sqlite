import { StateCreator, StoreMutatorIdentifier } from 'zustand';
import { createLLMStorePersistAdapter } from './sqlite-llm-adapter-client';

type Write<T, U> = Omit<T, keyof U> & U;
type Cast<T, U> = T extends U ? T : U;

export interface LLMSqlitePersistOptions {
  name: string;
  version?: number;
  onRehydrateStorage?: () => ((state?: any) => void) | void;
  migrate?: (persistedState: any, version: number) => any;
  partialize?: (state: any) => any;
}

export interface LLMSqlitePersistApi {
  rehydrate: () => Promise<void>;
  hasHydrated: () => boolean;
  persist: {
    setOptions: (options: Partial<LLMSqlitePersistOptions>) => void;
    clearStorage: () => Promise<void>;
    getOptions: () => LLMSqlitePersistOptions;
  };
}

type LLMSqlitePersist = <T, Mps extends [StoreMutatorIdentifier, unknown][] = [], Mcs extends [StoreMutatorIdentifier, unknown][] = []>(
  initializer: StateCreator<T, Mps, Mcs>,
  options: LLMSqlitePersistOptions,
) => StateCreator<T & LLMSqlitePersistApi, Mps, [['zustand/llm-sqlite-persist', never], ...Mcs]>;

type LLMSqlitePersistImpl = <T>(storeInitializer: StateCreator<T, [], []>, options: LLMSqlitePersistOptions) => StateCreator<T & LLMSqlitePersistApi, [], []>;

const llmSqlitePersistImpl: LLMSqlitePersistImpl = (storeInitializer, options) => {
  return (set, get, store) => {
    const { name, version = 1, onRehydrateStorage, migrate, partialize } = options;
    const storage = createLLMStorePersistAdapter();

    let hasHydrated = false;
    let currentOptions = options;

    // Function to save current state to SQLite
    const saveToSqlite = async (state: any) => {
      try {
        const stateToSave = partialize ? partialize(state) : state;
        await storage.setItem(name, stateToSave);
      } catch (error) {
        console.error(`[LLM SQLite] Failed to persist store '${name}':`, error);
      }
    };

    // Function to load state from SQLite
    const loadFromSqlite = async (): Promise<any | null> => {
      try {
        const persistedState = await storage.getItem(name);

        if (persistedState === null) {
          return null;
        }

        // Apply migration if needed
        if (migrate && persistedState) {
          return migrate(persistedState, version);
        }

        return persistedState;
      } catch (error) {
        console.error(`[LLM SQLite] Failed to load store '${name}':`, error);
        return null;
      }
    };

    // Enhanced set function that automatically persists changes
    const enhancedSet: typeof set = (...args) => {
      set(...args);

      // Debounce saving to avoid too frequent writes
      if (!hasHydrated) return; // Don't save during rehydration

      setTimeout(() => {
        const currentState = get();
        saveToSqlite(currentState);
      }, 100);
    };

    // Rehydration function
    const rehydrate = async (): Promise<void> => {
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

        console.log(`[LLM SQLite] Store '${name}' rehydrated from SQLite`);
      } catch (error) {
        console.error(`[LLM SQLite] Failed to rehydrate store '${name}':`, error);
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
        setOptions: (newOptions: Partial<LLMSqlitePersistOptions>) => {
          currentOptions = { ...currentOptions, ...newOptions };
        },
        clearStorage: async () => {
          try {
            await storage.removeItem(name);
          } catch (error) {
            console.error(`[LLM SQLite] Failed to clear storage for store '${name}':`, error);
          }
        },
        getOptions: () => currentOptions,
      },
    };

    // Start rehydration process asynchronously
    setTimeout(() => rehydrate(), 0);

    return enhancedState;
  };
};

export const llmSqlitePersist = llmSqlitePersistImpl as unknown as LLMSqlitePersist;

// Helper function to create a store with LLM SQLite persistence
export function createLLMSqlitePersistedStore<T>(storeInitializer: StateCreator<T, [], []>, options: LLMSqlitePersistOptions) {
  return llmSqlitePersist(storeInitializer, options);
}
