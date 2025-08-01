import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import type { SystemPurposeId } from '../../../data';

import type { DLLMId } from '~/common/stores/llms/llms.types';
import { findLLMOrThrow, getChatLLMId } from '~/common/stores/llms/store-llms';

import { agiUuid } from '~/common/util/idUtils';

import { workspaceActions } from '~/common/stores/workspace/store-client-workspace';
import { workspaceForConversationIdentity } from '~/common/stores/workspace/workspace.types';

import { DMessage, DMessageId, DMessageMetadata, MESSAGE_FLAG_AIX_SKIP, messageHasUserFlag } from './chat.message';
import { DMessageFragment, DMessageFragmentId, isVoidThinkingFragment } from './chat.fragments';
import { conversationTitle, createDConversation, DConversation, DConversationId, duplicateDConversation } from './chat.conversation';
import { estimateTokensForFragments } from './chat.tokens';
import { gcChatImageAssets } from '~/common/stores/chat/chat.gc';
import { chatSqlitePersist } from '../../../lib/db/zustand-chat-sqlite-middleware';

/// Conversations Store

interface ChatState {
  conversations: DConversation[];
}

export interface ChatActions {
  // CRUD conversations
  prependNewConversation: (personaId: SystemPurposeId | undefined, isIncognito: boolean) => DConversationId;
  importConversation: (c: DConversation, preventClash: boolean) => DConversationId;
  branchConversation: (cId: DConversationId, mId: DMessageId | null) => DConversationId | null;
  deleteConversations: (cIds: DConversationId[], newConversationPersonaId?: SystemPurposeId) => DConversationId;

  // within a conversation
  isIncognito: (cId: DConversationId) => boolean | undefined;
  setAbortController: (cId: DConversationId, _abortController: AbortController | null, debugScope: string) => void;
  abortConversationTemp: (cId: DConversationId) => void;
  historyReplace: (cId: DConversationId, messages: DMessage[]) => void;
  historyTruncateToIncluded: (cId: DConversationId, mId: DMessageId, offset: number) => void;
  historyKeepLastThinkingOnly: (cId: DConversationId) => void;
  historyView: (cId: DConversationId) => Readonly<DMessage[]> | undefined;
  appendMessage: (cId: DConversationId, message: DMessage) => void;
  deleteMessage: (cId: DConversationId, mId: DMessageId) => void;
  editMessage: (
    cId: DConversationId,
    mId: DMessageId,
    update: Partial<DMessage> | ((message: DMessage) => Partial<DMessage>),
    removePendingState: boolean,
    touchUpdated: boolean,
  ) => void;
  appendMessageFragment: (cId: DConversationId, mId: DMessageId, fragment: DMessageFragment, removePendingState: boolean, touchUpdated: boolean) => void;
  deleteMessageFragment: (cId: DConversationId, mId: DMessageId, fId: DMessageFragmentId, removePendingState: boolean, touchUpdated: boolean) => void;
  replaceMessageFragment: (
    cId: DConversationId,
    mId: DMessageId,
    fId: DMessageFragmentId,
    newFragment: DMessageFragment,
    removePendingState: boolean,
    touchUpdated: boolean,
  ) => void;
  updateMetadata: (cId: DConversationId, mId: DMessageId, metadataDelta: Partial<DMessageMetadata>, touchUpdated?: boolean) => void;
  setSystemPurposeId: (cId: DConversationId, personaId: SystemPurposeId) => void;
  setAutoTitle: (cId: DConversationId, autoTitle: string) => void;
  setUserTitle: (cId: DConversationId, userTitle: string) => void;
  setUserSymbol: (cId: DConversationId, userSymbol: string | null) => void;
  setArchived: (cId: DConversationId, isArchived: boolean) => void;
  title: (cId: DConversationId) => string | undefined;

  // utility function
  _editConversation: (cId: DConversationId, update: Partial<DConversation> | ((conversation: DConversation) => Partial<DConversation>)) => void;
}

type ConversationsStore = ChatState & ChatActions;

const defaultConversations: DConversation[] = [createDConversation()];

export const useChatStore = create<ConversationsStore>()(
  chatSqlitePersist(
    (_set, _get) => ({
      // default state
      conversations: defaultConversations,

      prependNewConversation: (personaId: SystemPurposeId | undefined, isIncognito: boolean): DConversationId => {
        const newConversation = createDConversation(personaId);
        if (isIncognito) newConversation._isIncognito = true;

        _set((state) => ({
          conversations: [newConversation, ...state.conversations],
        }));

        // [workspace] import messages' LiveFiles
        workspaceActions().importAssignmentsFromMessages(workspaceForConversationIdentity(newConversation.id), newConversation.messages);

        return newConversation.id;
      },

      /** Used by:
       * - openAndLoadConversations (via DataAtRestV1.recreateConversation),
       * - LinkChatViewer(from RestV1),
       * - ImportChats.handleChatGptLoad(H)
       */
      importConversation: (conversation: DConversation, preventClash: boolean): DConversationId => {
        const { conversations } = _get();

        // if there's a clash, abort the former conversation, and optionally change the ID
        const existing = conversations.find((_c) => _c.id === conversation.id);
        if (existing) {
          existing?._abortController?.abort();
          if (preventClash) {
            conversation = { ...conversation, id: agiUuid('conversation-id') };
          }
        }

        _set((state) => ({
          conversations: [conversation, ...state.conversations.filter((_c) => _c.id !== conversation.id)],
        }));

        // [workspace] import messages' LiveFiles
        workspaceActions().importAssignmentsFromMessages(workspaceForConversationIdentity(conversation.id), conversation.messages);

        return conversation.id;
      },

      branchConversation: (conversationId: DConversationId, messageId: DMessageId | null): DConversationId | null => {
        const { conversations } = _get();
        const conversation = conversations.find((_c) => _c.id === conversationId);
        if (!conversation) return null;

        const branchedConversation = duplicateDConversation(conversation, messageId);
        _set((state) => ({
          conversations: [branchedConversation, ...state.conversations],
        }));

        // [workspace] import messages' LiveFiles
        workspaceActions().importAssignmentsFromMessages(workspaceForConversationIdentity(branchedConversation.id), branchedConversation.messages);

        return branchedConversation.id;
      },

      deleteConversations: (cIds: DConversationId[], newConversationPersonaId?: SystemPurposeId): DConversationId => {
        const { conversations } = _get();

        // abort conversations
        cIds.forEach((cId) => {
          const conversation = conversations.find((_c) => _c.id === cId);
          conversation?._abortController?.abort();
        });

        // GC images
        gcChatImageAssets(conversations.filter((_c) => cIds.includes(_c.id)));

        // delete conversations
        _set((state) => ({
          conversations: state.conversations.filter((_c) => !cIds.includes(_c.id)),
        }));

        // if no conversations left, add a new one
        const remainingConversations = conversations.filter((_c) => !cIds.includes(_c.id));
        if (remainingConversations.length === 0) {
          const newConversation = createDConversation(newConversationPersonaId);
          _set((state) => ({
            conversations: [newConversation, ...state.conversations],
          }));
          return newConversation.id;
        }

        return remainingConversations[0].id;
      },

      isIncognito: (cId: DConversationId): boolean | undefined => {
        const { conversations } = _get();
        return conversations.find((_c) => _c.id === cId)?._isIncognito;
      },

      setAbortController: (cId: DConversationId, _abortController: AbortController | null, debugScope: string): void => {
        const { conversations } = _get();
        const conversation = conversations.find((_c) => _c.id === cId);
        if (conversation) {
          // Debug info
          console.log(`setAbortController: ${cId} ${debugScope} ${_abortController ? 'SET' : 'CLEAR'}`);
          conversation._abortController = _abortController;
        }
      },

      abortConversationTemp: (cId: DConversationId): void => {
        const { conversations } = _get();
        const conversation = conversations.find((_c) => _c.id === cId);
        conversation?._abortController?.abort();
      },

      historyReplace: (cId: DConversationId, messages: DMessage[]): void => {
        _set((state) => ({
          conversations: state.conversations.map((_c) => (_c.id === cId ? { ..._c, messages, updated: Date.now() } : _c)),
        }));

        // [workspace] import messages' LiveFiles
        workspaceActions().importAssignmentsFromMessages(workspaceForConversationIdentity(cId), messages);
      },

      historyTruncateToIncluded: (cId: DConversationId, mId: DMessageId, offset: number): void => {
        _set((state) => ({
          conversations: state.conversations.map((_c) => {
            if (_c.id !== cId) return _c;

            const messageIndex = _c.messages.findIndex((m) => m.id === mId);
            if (messageIndex === -1) return _c;

            const newMessages = _c.messages.slice(0, messageIndex + 1 + offset);
            return { ..._c, messages: newMessages, updated: Date.now() };
          }),
        }));
      },

      historyKeepLastThinkingOnly: (cId: DConversationId): void => {
        _set((state) => ({
          conversations: state.conversations.map((_c) => {
            if (_c.id !== cId) return _c;

            // Keep all messages except remove all but the last 'assistant' thinking
            let lastThinkingIndex = -1;
            for (let i = _c.messages.length - 1; i >= 0; i--) {
              const message = _c.messages[i];
              if (message.role === 'assistant' && message.fragments.some(isVoidThinkingFragment)) {
                if (lastThinkingIndex === -1) lastThinkingIndex = i;
                else {
                  // remove this thinking message (keep the last one)
                  _c.messages.splice(i, 1);
                }
              }
            }

            return { ..._c, updated: Date.now() };
          }),
        }));
      },

      historyView: (cId: DConversationId): Readonly<DMessage[]> | undefined => {
        const { conversations } = _get();
        return conversations.find((_c) => _c.id === cId)?.messages;
      },

      appendMessage: (cId: DConversationId, message: DMessage): void => {
        _set((state) => ({
          conversations: state.conversations.map((_c) => (_c.id === cId ? { ..._c, messages: [..._c.messages, message], updated: Date.now() } : _c)),
        }));

        // [workspace] import message's LiveFiles
        workspaceActions().importAssignmentsFromMessages(workspaceForConversationIdentity(cId), [message]);
      },

      deleteMessage: (cId: DConversationId, mId: DMessageId): void => {
        _set((state) => ({
          conversations: state.conversations.map((_c) =>
            _c.id === cId ? { ..._c, messages: _c.messages.filter((m) => m.id !== mId), updated: Date.now() } : _c,
          ),
        }));
      },

      editMessage: (
        cId: DConversationId,
        mId: DMessageId,
        update: Partial<DMessage> | ((message: DMessage) => Partial<DMessage>),
        removePendingState: boolean,
        touchUpdated: boolean,
      ): void => {
        _set((state) => ({
          conversations: state.conversations.map((_c) =>
            _c.id === cId
              ? {
                  ..._c,
                  messages: _c.messages.map((m) =>
                    m.id === mId
                      ? {
                          ...m,
                          ...(typeof update === 'function' ? update(m) : update),
                          ...(removePendingState && { pendingIncomplete: undefined }),
                          ...(touchUpdated && { updated: Date.now() }),
                        }
                      : m,
                  ),
                  updated: Date.now(),
                }
              : _c,
          ),
        }));
      },

      appendMessageFragment: (cId: DConversationId, mId: DMessageId, fragment: DMessageFragment, removePendingState: boolean, touchUpdated: boolean): void => {
        _set((state) => ({
          conversations: state.conversations.map((_c) =>
            _c.id === cId
              ? {
                  ..._c,
                  messages: _c.messages.map((m) =>
                    m.id === mId
                      ? {
                          ...m,
                          fragments: [...m.fragments, fragment],
                          ...(removePendingState && { pendingIncomplete: undefined }),
                          ...(touchUpdated && { updated: Date.now() }),
                        }
                      : m,
                  ),
                  updated: Date.now(),
                }
              : _c,
          ),
        }));
      },

      deleteMessageFragment: (cId: DConversationId, mId: DMessageId, fId: DMessageFragmentId, removePendingState: boolean, touchUpdated: boolean): void => {
        _set((state) => ({
          conversations: state.conversations.map((_c) =>
            _c.id === cId
              ? {
                  ..._c,
                  messages: _c.messages.map((m) =>
                    m.id === mId
                      ? {
                          ...m,
                          fragments: m.fragments.filter((f) => f.fId !== fId),
                          ...(removePendingState && { pendingIncomplete: undefined }),
                          ...(touchUpdated && { updated: Date.now() }),
                        }
                      : m,
                  ),
                  updated: Date.now(),
                }
              : _c,
          ),
        }));
      },

      replaceMessageFragment: (
        cId: DConversationId,
        mId: DMessageId,
        fId: DMessageFragmentId,
        newFragment: DMessageFragment,
        removePendingState: boolean,
        touchUpdated: boolean,
      ): void => {
        _set((state) => ({
          conversations: state.conversations.map((_c) =>
            _c.id === cId
              ? {
                  ..._c,
                  messages: _c.messages.map((m) =>
                    m.id === mId
                      ? {
                          ...m,
                          fragments: m.fragments.map((f) => (f.fId === fId ? newFragment : f)),
                          ...(removePendingState && { pendingIncomplete: undefined }),
                          ...(touchUpdated && { updated: Date.now() }),
                        }
                      : m,
                  ),
                  updated: Date.now(),
                }
              : _c,
          ),
        }));
      },

      updateMetadata: (cId: DConversationId, mId: DMessageId, metadataDelta: Partial<DMessageMetadata>, touchUpdated: boolean = true): void => {
        _set((state) => ({
          conversations: state.conversations.map((_c) =>
            _c.id === cId
              ? {
                  ..._c,
                  messages: _c.messages.map((m) =>
                    m.id === mId
                      ? {
                          ...m,
                          metadata: { ...m.metadata, ...metadataDelta },
                          ...(touchUpdated && { updated: Date.now() }),
                        }
                      : m,
                  ),
                  updated: Date.now(),
                }
              : _c,
          ),
        }));
      },

      setSystemPurposeId: (cId: DConversationId, personaId: SystemPurposeId): void => {
        _set((state) => ({
          conversations: state.conversations.map((_c) => (_c.id === cId ? { ..._c, systemPurposeId: personaId, updated: Date.now() } : _c)),
        }));
      },

      setAutoTitle: (cId: DConversationId, autoTitle: string): void => {
        _set((state) => ({
          conversations: state.conversations.map((_c) => (_c.id === cId ? { ..._c, autoTitle, updated: Date.now() } : _c)),
        }));
      },

      setUserTitle: (cId: DConversationId, userTitle: string): void => {
        _set((state) => ({
          conversations: state.conversations.map((_c) => (_c.id === cId ? { ..._c, userTitle, updated: Date.now() } : _c)),
        }));
      },

      setUserSymbol: (cId: DConversationId, userSymbol: string | null): void => {
        _set((state) => ({
          conversations: state.conversations.map((_c) => (_c.id === cId ? { ..._c, userSymbol, updated: Date.now() } : _c)),
        }));
      },

      setArchived: (cId: DConversationId, isArchived: boolean): void => {
        _set((state) => ({
          conversations: state.conversations.map((_c) => (_c.id === cId ? { ..._c, isArchived, updated: Date.now() } : _c)),
        }));
      },

      title: (cId: DConversationId): string | undefined => {
        const { conversations } = _get();
        const conversation = conversations.find((_c) => _c.id === cId);
        return conversation ? conversationTitle(conversation) : undefined;
      },

      _editConversation: (cId: DConversationId, update: Partial<DConversation> | ((conversation: DConversation) => Partial<DConversation>)): void => {
        _set((state) => ({
          conversations: state.conversations.map((_c) =>
            _c.id === cId ? { ..._c, ...(typeof update === 'function' ? update(_c) : update), updated: Date.now() } : _c,
          ),
        }));
      },
    }),
    {
      name: 'app-chats-sqlite',
      version: 4,
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        console.log(`[SQLite Chat] Rehydrated chat store with ${state.conversations?.length || 0} conversations`);

        // Recalculate token counts on rehydration if needed
        try {
          state.conversations = state.conversations.map((conversation: DConversation) => {
            // Reset abort controllers (not persisted)
            conversation._abortController = null;

            // Recalculate message token counts if necessary
            conversation.messages = conversation.messages.map((message: DMessage) => {
              if (message.tokenCount === 0 && message.fragments?.length > 0) {
                try {
                  const llmId = getChatLLMId();
                  if (llmId) {
                    const llm = findLLMOrThrow(llmId);
                    message.tokenCount = estimateTokensForFragments(message.fragments, llm);
                  }
                } catch (error) {
                  console.warn('Failed to recalculate message token count:', error);
                }
              }
              return message;
            });

            // Recalculate conversation token count
            conversation.tokenCount = conversation.messages.reduce((sum, message) => sum + message.tokenCount, 0);

            return conversation;
          });

          console.log('[SQLite Chat] Token counts recalculated on rehydration');
        } catch (error) {
          console.error('Error during chat store rehydration:', error);
        }
      },
      migrate: (persistedState: any, fromVersion: number) => {
        console.log(`[SQLite Chat] Migrating chat store from version ${fromVersion} to 4`);

        if (!persistedState) return persistedState;

        // Apply any necessary migrations here
        // For now, just return the persisted state as-is
        return persistedState;
      },
      partialize: (state) => ({
        // Only persist conversations, not temporary state
        conversations: state.conversations.map((conversation: DConversation) => ({
          ...conversation,
          // Don't persist abort controllers
          _abortController: undefined,
        })),
      }),
    },
  ),
);

// Export selectors for optimized re-renders
export const chatStoreSelectors = {
  conversations: (state: ConversationsStore) => state.conversations,
  conversationCount: (state: ConversationsStore) => state.conversations.length,
  getConversation: (cId: DConversationId) => (state: ConversationsStore) => state.conversations.find((c) => c.id === cId),
  getMessages: (cId: DConversationId) => (state: ConversationsStore) => state.conversations.find((c) => c.id === cId)?.messages || [],
  getNonArchivedConversations: (state: ConversationsStore) => state.conversations.filter((c) => !c.isArchived),
  getArchivedConversations: (state: ConversationsStore) => state.conversations.filter((c) => c.isArchived),
};

// Hooks for common operations
export const useChatStoreShallow = <T>(selector: (state: ConversationsStore) => T): T => useChatStore(useShallow(selector));

export const useConversation = (cId: DConversationId | null) => useChatStoreShallow((state) => (cId ? state.conversations.find((c) => c.id === cId) : null));

export const useConversationMessages = (cId: DConversationId | null) =>
  useChatStoreShallow((state) => (cId ? state.conversations.find((c) => c.id === cId)?.messages || [] : []));

// Helper functions
export function findConversation(conversations: DConversation[], cId: DConversationId): DConversation | undefined {
  return conversations.find((c) => c.id === cId);
}

export function findMessage(conversation: DConversation, mId: DMessageId): DMessage | undefined {
  return conversation.messages.find((m) => m.id === mId);
}

// Export actions for direct access
export const chatStoreActions = () => useChatStore.getState();
export const chatStoreState = () => useChatStore.getState();
