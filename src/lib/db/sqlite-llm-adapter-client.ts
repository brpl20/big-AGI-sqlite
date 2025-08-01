// Client-safe wrapper for LLM SQLite adapter
// Uses API calls exclusively - no SQLite imports whatsoever

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

export class SQLiteLLMAdapterClient {
  async loadLLMStore(): Promise<LLMStoreData> {
    try {
      const response = await fetch('/api/llms');
      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }
      const result = await response.json();
      if (result.success) {
        return {
          llms: result.data.models || [],
          sources: result.data.services || [],
          confServiceId: result.data.confServiceId || null,
          modelAssignments: result.data.assignments || {},
        };
      } else {
        throw new Error(result.error || 'Unknown API error');
      }
    } catch (error) {
      console.error('[LLM Client Adapter] Load error:', error);
      return this.getEmptyStore();
    }
  }

  async saveLLMStore(data: LLMStoreData): Promise<void> {
    try {
      const response = await fetch('/api/llms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          llms: data.llms,
          sources: data.sources,
          confServiceId: data.confServiceId,
          modelAssignments: data.modelAssignments,
        }),
      });

      if (!response.ok) {
        const errorResult = await response.json();
        throw new Error(errorResult.error || `API call failed: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Unknown API error');
      }
    } catch (error) {
      console.error('[LLM Client Adapter] Save error:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    // Client-side doesn't need to close anything
  }

  private getEmptyStore(): LLMStoreData {
    return {
      llms: [],
      sources: [],
      confServiceId: null,
      modelAssignments: {} as Record<DModelDomainId, DModelConfiguration>,
    };
  }
}

// Export singleton instance
export const llmAdapterClient = new SQLiteLLMAdapterClient();

// Bridge adapter to make LLM-specific client adapter work with general SQLite middleware
// This is client-side only and uses the llmAdapterClient (API calls)
class LLMStoreBridge {
  /**
   * Convert LLM store state to format expected by general SQLite middleware
   */
  static serialize(state: LLMStoreData): any {
    return {
      llms: state.llms || [],
      sources: state.sources || [],
      confServiceId: state.confServiceId || null,
      modelAssignments: state.modelAssignments || {},
      _lastSaved: Date.now(),
    };
  }

  /**
   * Convert stored data back to LLM store state format
   */
  static deserialize(data: any): LLMStoreData {
    if (!data) {
      return {
        llms: [],
        sources: [],
        confServiceId: null,
        modelAssignments: {},
      };
    }

    // Note: the client adapter re-adds the typing
    return {
      llms: data.llms || [],
      sources: data.sources || [],
      confServiceId: data.confServiceId || null,
      modelAssignments: data.modelAssignments || {},
    };
  }

  /**
   * Save LLM store using the specialized client adapter
   */
  static async save(storeName: string, data: any): Promise<void> {
    try {
      const llmData = this.deserialize(data);
      await llmAdapterClient.saveLLMStore(llmData);
    } catch (error) {
      console.error('[LLM Bridge] Failed to save LLM store:', error);
      throw error;
    }
  }

  /**
   * Load LLM store using the specialized client adapter
   */
  static async load(storeName: string): Promise<any> {
    try {
      const llmData = await llmAdapterClient.loadLLMStore();
      return this.serialize(llmData);
    } catch (error) {
      console.error('[LLM Bridge] Failed to load LLM store:', error);
      return null;
    }
  }

  /**
   * Delete LLM store using the specialized client adapter
   */
  static async delete(storeName: string): Promise<void> {
    try {
      await llmAdapterClient.deleteAllLLMs();
    } catch (error) {
      console.error('[LLM Bridge] Failed to clear LLM store:', error);
      throw error;
    }
  }
}

/**
 * This is the new persist adapter for the LLM store.
 * It will be used by the zustand-llm-sqlite-middleware.
 * It uses the client-side bridge which in turn uses API calls.
 */
export function createLLMStorePersistAdapter() {
  return {
    getItem: LLMStoreBridge.load,
    setItem: LLMStoreBridge.save,
    removeItem: LLMStoreBridge.delete,
  };
}
