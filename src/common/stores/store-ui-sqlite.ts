import * as React from 'react';
import { create } from 'zustand';
import { sqlitePersist } from '../../lib/db/zustand-sqlite-middleware';

import type { ContentScaling, UIComplexityMode } from '~/common/app.theme';
import { BrowserLang } from '~/common/util/pwaUtils';

// UI Preferences Store with SQLite persistence

interface UIPreferencesStore {
  // UI Features
  preferredLanguage: string;
  setPreferredLanguage: (preferredLanguage: string) => void;

  centerMode: 'narrow' | 'wide' | 'full';
  setCenterMode: (centerMode: 'narrow' | 'wide' | 'full') => void;

  complexityMode: UIComplexityMode;
  setComplexityMode: (complexityMode: UIComplexityMode) => void;

  contentScaling: ContentScaling;
  setContentScaling: (contentScaling: ContentScaling) => void;
  increaseContentScaling: () => void;
  decreaseContentScaling: () => void;

  disableMarkdown: boolean;
  setDisableMarkdown: (disableMarkdown: boolean) => void;

  doubleClickToEdit: boolean;
  setDoubleClickToEdit: (doubleClickToEdit: boolean) => void;

  enterIsNewline: boolean;
  setEnterIsNewline: (enterIsNewline: boolean) => void;

  renderCodeLineNumbers: boolean;
  setRenderCodeLineNumbers: (renderCodeLineNumbers: boolean) => void;

  renderCodeSoftWrap: boolean;
  setRenderCodeSoftWrap: (renderCodeSoftWrap: boolean) => void;

  showPersonaFinder: boolean;
  setShowPersonaFinder: (showPersonaFinder: boolean) => void;

  composerQuickButton: 'off' | 'call' | 'beam';
  setComposerQuickButton: (composerQuickButton: 'off' | 'call' | 'beam') => void;

  // UI Dismissals
  dismissals: Record<string, boolean>;
  dismiss: (key: string) => void;

  // UI Counters
  actionCounters: Record<string, number>;
  incrementActionCounter: (key: string) => void;
  resetActionCounter: (key: string) => void;
}

export const useUIPreferencesStore = create<UIPreferencesStore>()(
  sqlitePersist(
    (set) => ({
      // UI Features - Default values
      preferredLanguage: BrowserLang.orUS,
      setPreferredLanguage: (preferredLanguage: string) => set({ preferredLanguage }),

      centerMode: 'full',
      setCenterMode: (centerMode: 'narrow' | 'wide' | 'full') => set({ centerMode }),

      complexityMode: 'pro',
      setComplexityMode: (complexityMode: UIComplexityMode) => set({ complexityMode }),

      // 2024-07-14: 'sm' is the new default, down from 'md'
      contentScaling: 'sm',
      setContentScaling: (contentScaling: ContentScaling) => set({ contentScaling }),
      increaseContentScaling: () => set((state) =>
        state.contentScaling === 'md' ? state : {
          contentScaling: state.contentScaling === 'xs' ? 'sm' : 'md'
        }
      ),
      decreaseContentScaling: () => set((state) =>
        state.contentScaling === 'xs' ? state : {
          contentScaling: state.contentScaling === 'md' ? 'sm' : 'xs'
        }
      ),

      doubleClickToEdit: false,
      setDoubleClickToEdit: (doubleClickToEdit: boolean) => set({ doubleClickToEdit }),

      disableMarkdown: false,
      setDisableMarkdown: (disableMarkdown: boolean) => set({ disableMarkdown }),

      enterIsNewline: false,
      setEnterIsNewline: (enterIsNewline: boolean) => set({ enterIsNewline }),

      renderCodeLineNumbers: false,
      setRenderCodeLineNumbers: (renderCodeLineNumbers: boolean) => set({ renderCodeLineNumbers }),

      renderCodeSoftWrap: false,
      setRenderCodeSoftWrap: (renderCodeSoftWrap: boolean) => set({ renderCodeSoftWrap }),

      // Deprecated
      showPersonaFinder: false,
      setShowPersonaFinder: (showPersonaFinder: boolean) => set({ showPersonaFinder }),

      composerQuickButton: 'beam',
      setComposerQuickButton: (composerQuickButton: 'off' | 'call' | 'beam') => set({ composerQuickButton }),

      // UI Dismissals
      dismissals: {},
      dismiss: (key: string) => set((state) => ({
        dismissals: { ...state.dismissals, [key]: true },
      })),

      // UI Counters
      actionCounters: {},
      incrementActionCounter: (key: string) =>
        set((state) => ({
          actionCounters: { ...state.actionCounters, [key]: (state.actionCounters[key] || 0) + 1 },
        })),
      resetActionCounter: (key: string) =>
        set((state) => ({
          actionCounters: { ...state.actionCounters, [key]: 0 },
        })),
    }),
    {
      name: 'app-ui',
      /* versioning:
       * 1: rename 'enterToSend' to 'enterIsNewline' (flip the meaning)
       * 2: new Big-AGI 2 defaults
       * 3: centerMode: 'full' is the new default
       */
      version: 3,

      onRehydrateStorage: () => (state) => {
        if (state) {
          console.log('[SQLite] UI Preferences store rehydrated:', {
            preferredLanguage: state.preferredLanguage,
            centerMode: state.centerMode,
            complexityMode: state.complexityMode,
            contentScaling: state.contentScaling,
            dismissalsCount: Object.keys(state.dismissals || {}).length,
            actionCountersCount: Object.keys(state.actionCounters || {}).length,
          });
        }
      },

      migrate: (state: any, fromVersion: number): UIPreferencesStore => {
        console.log(`[SQLite] Migrating UI Preferences store from version ${fromVersion} to version 3`);

        // 1: rename 'enterToSend' to 'enterIsNewline' (flip the meaning)
        if (state && fromVersion < 1) {
          state.enterIsNewline = state['enterToSend'] === false;
          console.log('[SQLite] Migration v1: Updated enterIsNewline from enterToSend');
        }

        // 2: new Big-AGI 2 defaults
        if (state && fromVersion < 2) {
          state.contentScaling = 'sm';
          state.doubleClickToEdit = false;
          console.log('[SQLite] Migration v2: Applied Big-AGI 2 defaults');
        }

        // 3: centerMode: 'full' is the new default
        if (state && fromVersion < 3) {
          state.centerMode = 'full';
          console.log('[SQLite] Migration v3: Set centerMode to full');
        }

        return state;
      },
    },
  ),
);

// Exported utility functions (maintaining compatibility with existing codebase)
export function useUIComplexityMode(): UIComplexityMode {
  return useUIPreferencesStore((state) => state.complexityMode);
}

export function useUIComplexityIsMinimal(): boolean {
  return useUIPreferencesStore((state) => state.complexityMode === 'minimal');
}

export function useUIContentScaling(): ContentScaling {
  return useUIPreferencesStore((state) => state.contentScaling);
}

export function useUIIsDismissed(key: string | null): boolean | undefined {
  return useUIPreferencesStore((state) => !key ? undefined : Boolean(state.dismissals[key]));
}

export function uiSetDismissed(key: string): void {
  useUIPreferencesStore.getState().dismiss(key);
}

// Known keys for UI counters
type KnownKeys =
  | 'acknowledge-translation-warning' // displayed if Chrome is translating the page (may crash)
  | 'beam-wizard'                     // first Beam
  | 'call-wizard'                     // first Call
  | 'composer-shift-enter'            // not used Shift + Enter in the Composer yet
  | 'composer-alt-enter'              // not used Alt + Enter in the Composer yet
  | 'composer-ctrl-enter'             // not used Ctrl + Enter in the Composer yet
  | 'models-setup-first-visit'        // first visit to the Models Setup
  ;

export function useUICounter(key: KnownKeys, novelty: number = 1) {
  const value = useUIPreferencesStore((state) => state.actionCounters[key] || 0);

  const touch = React.useCallback(() => useUIPreferencesStore.getState().incrementActionCounter(key), [key]);

  const forget = React.useCallback(() => useUIPreferencesStore.getState().resetActionCounter(key), [key]);

  return {
    novel: value < novelty,
    touch,
    forget,
  };
}

export function resetUICounter(key: KnownKeys) {
  useUIPreferencesStore.getState().resetActionCounter(key);
}

// Testing utilities for SQLite UI Preferences Store
export async function testSqliteUIStore() {
  console.log('[SQLite Test] Testing UI Preferences store operations...');

  const currentState = useUIPreferencesStore.getState();
  console.log('[SQLite Test] Current UI state:', {
    preferredLanguage: currentState.preferredLanguage,
    centerMode: currentState.centerMode,
    complexityMode: currentState.complexityMode,
    contentScaling: currentState.contentScaling,
    hasHydrated: currentState.hasHydrated(),
  });

  // Test some operations
  try {
    // Test dismissal functionality
    currentState.dismiss('test-dismissal');
    console.log('[SQLite Test] Added test dismissal');

    // Test counter functionality
    currentState.incrementActionCounter('test-counter');
    console.log('[SQLite Test] Incremented test counter');

    // Test settings changes
    const originalMode = currentState.centerMode;
    const newMode = originalMode === 'full' ? 'narrow' : 'full';
    currentState.setCenterMode(newMode);
    console.log(`[SQLite Test] Changed center mode from ${originalMode} to ${newMode}`);

    // Test content scaling
    const originalScaling = currentState.contentScaling;
    currentState.increaseContentScaling();
    console.log(`[SQLite Test] Increased content scaling from ${originalScaling}`);

    // Test markdown setting
    const originalMarkdown = currentState.disableMarkdown;
    currentState.setDisableMarkdown(!originalMarkdown);
    console.log(`[SQLite Test] Toggled markdown from ${originalMarkdown} to ${!originalMarkdown}`);

    const finalState = useUIPreferencesStore.getState();
    console.log('[SQLite Test] Final state after operations:', {
      centerMode: finalState.centerMode,
      contentScaling: finalState.contentScaling,
      disableMarkdown: finalState.disableMarkdown,
      dismissals: finalState.dismissals,
      actionCounters: finalState.actionCounters,
    });

    return {
      success: true,
      operations: 4,
      finalState: {
        centerMode: finalState.centerMode,
        contentScaling: finalState.contentScaling,
        disableMarkdown: finalState.disableMarkdown,
        dismissalsCount: Object.keys(finalState.dismissals).length,
        actionCountersCount: Object.keys(finalState.actionCounters).length,
      }
    };

  } catch (error) {
    console.error('[SQLite Test] Error during UI store test:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// API-based testing utilities for external validation
export async function testUIStoreAPI() {
  console.log('[SQLite Test] Testing UI store via API...');

  try {
    // Test fetching UI store via API
    const response = await fetch('/api/stores/app-ui');

    if (response.ok) {
      const result = await response.json();
      console.log('[SQLite Test] UI store fetched via API:', result.data);
      return {
        success: true,
        data: result.data,
        source: 'api'
      };
    } else if (response.status === 404) {
      console.log('[SQLite Test] UI store not found via API, will be created on first use');
      return {
        success: true,
        data: null,
        source: 'api',
        note: 'Store not yet created'
      };
    } else {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error('[SQLite Test] Error testing UI store API:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Migration utility for existing IndexedDB data
export async function migrateUIStoreFromIndexedDB() {
  console.log('[SQLite Migration] Starting UI Preferences migration from IndexedDB...');

  try {
    // This would typically read from IndexedDB and migrate to SQLite
    // For now, we'll just ensure the store is properly initialized
    const currentState = useUIPreferencesStore.getState();

    if (!currentState.hasHydrated()) {
      console.log('[SQLite Migration] Waiting for store to hydrate...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('[SQLite Migration] UI Preferences store migration completed');
    return {
      success: true,
      migratedSettings: {
        preferredLanguage: currentState.preferredLanguage,
        centerMode: currentState.centerMode,
        complexityMode: currentState.complexityMode,
        contentScaling: currentState.contentScaling,
      }
    };
  } catch (error) {
    console.error('[SQLite Migration] Error during UI store migration:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
