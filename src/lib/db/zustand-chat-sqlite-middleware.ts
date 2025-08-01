import { StateCreator, StoreMutatorIdentifier } from 'zustand';
import type { DConversation, DConversationId } from '~/common/stores/chat/chat.conversation';
import type { DMessage, DMessageId } from '~/common/stores/chat/chat.message';

type Write<T, U> = Omit<T, keyof U> & U;
type Cast<T, U> = T extends U ? T : U;

export interface ChatSqlitePersistOptions {
  name: string;
  version?: number;
  onRehydrateStorage?: () => ((state?: any) => void) | void;
  migrate?: (persistedState: any, version: number) => any;
  partialize?: (state: any) => any;
}

export interface ChatSqlitePersistApi {
  rehydrate: () => Promise<void>;
  hasHydrated: () => boolean;
  persist: {
    setOptions: (options: Partial<ChatSqlitePersistOptions>) => void;
    clearStorage: () => Promise<void>;
    getOptions: () => ChatSqlitePersistOptions;
  };
}

type ChatSqlitePersist = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  initializer: StateCreator<T, Mps, Mcs>,
  options: ChatSqlitePersistOptions
) => StateCreator<T & ChatSqlitePersistApi, Mps, [['zustand/chat-sqlite-persist', never], ...Mcs]>;

type ChatSqlitePersistImpl = <T>(
  storeInitializer: StateCreator<T, [], []>,
  options: ChatSqlitePersistOptions
) => StateCreator<T & ChatSqlitePersistApi, [], []>;

// API client for chat operations
class ChatApiClient {
  private getBaseUrl(): string {
    // Handle different environments (SSR, client-side, etc.)
    if (typeof window !== 'undefined') {
      // Client-side: use relative URL
      return '/api/chats';
    } else {
      // Server-side: use absolute URL or skip
      return 'http://localhost:3001/api/chats';
    }
  }

  async getAllConversations(): Promise<DConversation[]> {
    // Skip fetch during SSR to avoid issues
    if (typeof window === 'undefined') {
      console.log('[Chat SQLite] Skipping fetch during SSR');
      return [];
    }

    try {
      const response = await fetch(this.getBaseUrl());

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to fetch conversations: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      return result.conversations || [];
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }

  async getConversation(conversationId: DConversationId): Promise<DConversation | null> {
    if (typeof window === 'undefined') {
      console.log('[Chat SQLite] Skipping fetch during SSR');
      return null;
    }

    try {
      const response = await fetch(`${this.getBaseUrl()}/${conversationId}`);

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to fetch conversation: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      return result.conversation;
    } catch (error) {
      console.error(`Error fetching conversation '${conversationId}':`, error);
      throw error;
    }
  }

  async saveConversation(conversation: DConversation): Promise<void> {
    // Skip fetch during SSR
    if (typeof window === 'undefined') {
      console.log('[Chat SQLite] Skipping save during SSR');
      return;
    }

    try {
      const response = await fetch(`${this.getBaseUrl()}/${conversation.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conversation }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to save conversation: ${errorData.error || response.statusText}`);
      }

      console.log(`[Chat SQLite] Saved conversation: ${conversation.id}`);
    } catch (error) {
      console.error(`Error saving conversation '${conversation.id}':`, error);
      throw error;
    }
  }

  async saveAllConversations(conversations: DConversation[]): Promise<void> {
    if (typeof window === 'undefined') {
      console.log('[Chat SQLite] Skipping bulk save during SSR');
      return;
    }

    try {
      // Save conversations one by one for now
      // TODO: Implement bulk save API for better performance
      const savePromises = conversations.map(conversation =>
        this.saveConversation(conversation)
      );

      await Promise.all(savePromises);
      console.log(`[Chat SQLite] Saved ${conversations.length} conversations`);
    } catch (error) {
      console.error('Error saving conversations:', error);
      throw error;
    }
  }

  async deleteConversation(conversationId: DConversationId): Promise<void> {
    // Skip fetch during SSR
    if (typeof window === 'undefined') {
      console.log('[Chat SQLite] Skipping delete during SSR');
      return;
    }

    try {
      const response = await fetch(`${this.getBaseUrl()}/${conversationId}`, {
        method: 'DELETE',
      });

      if (response.status === 404) {
        // Conversation doesn't exist, consider it a success
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to delete conversation: ${errorData.error || response.statusText}`);
      }

      console.log(`[Chat SQLite] Deleted conversation: ${conversationId}`);
    } catch (error) {
      console.error(`Error deleting conversation '${conversationId}':`, error);
      throw error;
    }
  }
}

const chatApiClient = new ChatApiClient();

const chatSqlitePersistImpl: ChatSqlitePersistImpl = (storeInitializer, options) => {
  return (set, get, store) => {
    const { name, version = 1, onRehydrateStorage, migrate, partialize } = options;

    let hasHydrated = false;
    let currentOptions = options;

    // Debounced save to avoid too frequent API calls
    let saveTimeout: NodeJS.Timeout | null = null;
    const debouncedSave = (state: any) => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }

      saveTimeout = setTimeout(async () => {
        try {
          const stateToSave = partialize ? partialize(state) : state;

          // For chat store, save all conversations
          if (stateToSave.conversations && Array.isArray(stateToSave.conversations)) {
            await chatApiClient.saveAllConversations(stateToSave.conversations);
          }
        } catch (error) {
          console.error(`Failed to persist chat store '${name}':`, error);
        }
      }, 500); // 500ms debounce
    };

    // Function to load state from SQLite
    const loadFromSqlite = async (): Promise<any | null> => {
      try {
        const conversations = await chatApiClient.getAllConversations();

        if (conversations.length === 0) {
          return null;
        }

        const persistedState = { conversations };

        // Apply migration if needed
        if (migrate && persistedState) {
          return migrate(persistedState, version);
        }

        return persistedState;
      } catch (error) {
        console.error(`Failed to load chat store '${name}':`, error);
        return null;
      }
    };

    // Enhanced set function that automatically persists changes
    const enhancedSet: typeof set = (...args) => {
      set(...args);

      // Debounce saving to avoid too frequent writes
      if (!hasHydrated) return; // Don't save during rehydration

      const currentState = get();
      debouncedSave(currentState);
    };

    // Rehydration function
    const rehydrate = async (): Promise<void> => {
      try {
        const persistedState = await loadFromSqlite();

        if (persistedState !== null) {
          // Update the state with persisted data
          set(persistedState, true); // true = replace entire state
          console.log(`[Chat SQLite] Rehydrated ${persistedState.conversations?.length || 0} conversations`);
        } else {
          console.log('[Chat SQLite] No persisted conversations found, using initial state');
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
        console.error(`Failed to rehydrate chat store '${name}':`, error);
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
        setOptions: (newOptions: Partial<ChatSqlitePersistOptions>) => {
          currentOptions = { ...currentOptions, ...newOptions };
        },
        clearStorage: async () => {
          try {
            const currentState = get();
            if (currentState.conversations && Array.isArray(currentState.conversations)) {
              const deletePromises = currentState.conversations.map((conv: DConversation) =>
                chatApiClient.deleteConversation(conv.id)
              );
              await Promise.all(deletePromises);
            }
          } catch (error) {
            console.error(`Failed to clear storage for chat store '${name}':`, error);
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

export const chatSqlitePersist = chatSqlitePersistImpl as unknown as ChatSqlitePersist;

// Helper function to create a chat store with SQLite persistence
export function createChatSqlitePersistedStore<T>(
  storeInitializer: StateCreator<T, [], []>,
  options: ChatSqlitePersistOptions
) {
  return chatSqlitePersist(storeInitializer, options);
}

// Utility functions for manual operations (useful for testing)
export async function manualSaveConversation(conversation: DConversation) {
  return chatApiClient.saveConversation(conversation);
}

export async function manualLoadConversations() {
  return chatApiClient.getAllConversations();
}

export async function manualDeleteConversation(conversationId: DConversationId) {
  return chatApiClient.deleteConversation(conversationId);
}

// Export the client for direct access if needed
export { chatApiClient };
