import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Box, Button, Card, Typography, Input, Alert, Divider, IconButton, CircularProgress, Menu, MenuItem, Dropdown, MenuButton, Modal, ModalDialog, ModalClose, Stack } from '@mui/joy';
import SendIcon from '@mui/icons-material/Send';
import ClearIcon from '@mui/icons-material/Clear';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import EditIcon from '@mui/icons-material/Edit';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import MoreVertIcon from '@mui/icons-material/MoreVert';

import { withNextJSPerPageLayout } from '~/common/layout/withLayout';
import { agiId } from '~/common/util/idUtils';
import { createTextContentFragment } from '~/common/stores/chat/chat.fragments';

// Streaming cursor component
const StreamingCursor = () => (
  <Box
    component="span"
    sx={{
      display: 'inline-block',
      width: '2px',
      height: '1.2em',
      backgroundColor: 'primary.main',
      marginLeft: '2px',
      animation: 'blink 1s infinite',
      '@keyframes blink': {
        '0%, 50%': { opacity: 1 },
        '51%, 100%': { opacity: 0 },
      },
    }}
  />
);

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  tokens?: number;
  isStreaming?: boolean;
  cost?: number;
  model?: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  created: number;
  updated: number;
  totalCost?: number;
  totalTokens?: number;
}

interface MetricsData {
  serviceMetrics: Record<string, {
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
  }>;
}

export default withNextJSPerPageLayout({ type: 'noop' }, () => {
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingCharCount, setStreamingCharCount] = useState(0);
  const [streamingWordCount, setStreamingWordCount] = useState(0);
  const [streamingStartTime, setStreamingStartTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [uiPreferences, setUiPreferences] = useState<any>(null);
  const [uxLabsSettings, setUxLabsSettings] = useState<any>(null);
  const [metricsData, setMetricsData] = useState<MetricsData | null>(null);
  const [currentMessageCost, setCurrentMessageCost] = useState<number>(0);
  const [currentMessageTokens, setCurrentMessageTokens] = useState<{ input: number; output: number }>({ input: 0, output: 0 });
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('gpt-3.5-turbo');
  const [modelPricing, setModelPricing] = useState<any>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingMessageRef = useRef<string>('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages]);

  useEffect(() => {
    const initializeStores = async () => {
      try {
        // Initialize stores first to prevent 404 errors
        const initResponse = await fetch('/api/stores/init', { method: 'POST' });
        if (initResponse.ok) {
          const initResult = await initResponse.json();
          console.log('[SQLite Init] Stores initialized:', initResult);
        }
      } catch (error) {
        console.warn('[SQLite Init] Failed to initialize stores:', error);
      }

      // Then load all data
      checkSystemStatus();
      loadUiPreferences();
      loadUxLabsSettings();
      loadChatSessions();
      loadMetricsData();
      loadAvailableModels();
    };

    initializeStores();
  }, []);

  const checkSystemStatus = async () => {
    try {
      const response = await fetch('/api/test-ai');
      if (response.ok) {
        const data = await response.json();
        setSystemStatus(data);
      }
    } catch (err) {
      console.error('Failed to check system status:', err);
    }
  };

  const loadUiPreferences = async () => {
    try {
      const response = await fetch('/api/stores/app-ui');
      if (response.ok) {
        const data = await response.json();
        setUiPreferences(data.data);
      }
    } catch (err) {
      console.error('Failed to load UI preferences:', err);
    }
  };

  const loadUxLabsSettings = async () => {
    try {
      const response = await fetch('/api/stores/app-ux-labs');
      if (response.ok) {
        const data = await response.json();
        setUxLabsSettings(data.data);
      }
    } catch (err) {
      console.error('Failed to load UX Labs settings:', err);
    }
  };

  const loadMetricsData = async () => {
    try {
      const response = await fetch('/api/metrics');
      if (response.ok) {
        const data = await response.json();
        setMetricsData(data.data);
        console.log('[Chat Test] Metrics data loaded:', data.data);
      }
    } catch (err) {
      console.error('Failed to load metrics data:', err);
    }
  };

  const loadAvailableModels = async () => {
    try {
      const response = await fetch('/api/openai-models');
      if (response.ok) {
        const data = await response.json();
        setAvailableModels(data.models || []);
        
        // Set pricing for default model
        const defaultModel = data.models?.find((m: any) => m.id === selectedModel);
        if (defaultModel) {
          setModelPricing(defaultModel.pricing);
        }
        
        console.log('[Chat Test] Available models loaded:', data.models?.length || 0);
      }
    } catch (err) {
      console.error('Failed to load available models:', err);
      // Fallback models if API fails
      setAvailableModels([
        { id: 'gpt-3.5-turbo', name: 'gpt-3.5-turbo', pricing: { input: 0.5, output: 1.5, description: 'GPT-3.5 Turbo' } },
        { id: 'gpt-4o-mini', name: 'gpt-4o-mini', pricing: { input: 0.15, output: 0.60, description: 'GPT-4o Mini' } },
        { id: 'gpt-4o', name: 'gpt-4o', pricing: { input: 2.50, output: 10.00, description: 'GPT-4o' } }
      ]);
    }
  };

  const handleModelChange = (newModel: string) => {
    setSelectedModel(newModel);
    const model = availableModels.find(m => m.id === newModel);
    if (model) {
      setModelPricing(model.pricing);
      console.log('[Chat Test] Model changed to:', newModel, 'Pricing:', model.pricing);
    }
  };

  const loadChatSessions = async () => {
    try {
      const response = await fetch('/api/chats');
      if (response.ok) {
        const data = await response.json();
        const chatSessions =
          data.conversations?.map((conv: any) => ({
            id: conv.id,
            title: conv.userTitle || conv.title || conv.autoTitle || 'Untitled Chat',
            messages:
              conv.messages?.map((msg: any) => ({
                id: msg.id,
                role: msg.role,
                content: msg.fragments?.[0]?.part?.text || msg.fragments?.[0]?.fText || msg.text || '',
                timestamp: msg.created || Date.now(),
                tokens: msg.tokenCount,
              })) || [],
            created: conv.created || Date.now(),
            updated: conv.updated || Date.now(),
          })) || [];
        setSessions(chatSessions);
      }
    } catch (err) {
      console.error('Failed to load chat sessions:', err);
    }
  };

  const createNewSession = () => {
    const sessionNumber = sessions.length + 1;
    const newSession: ChatSession = {
      id: `chat-test-${Date.now()}`,
      title: `New Chat ${sessionNumber}`,
      messages: [],
      created: Date.now(),
      updated: Date.now(),
    };
    setCurrentSession(newSession);
    setError(null);
  };

  const saveSessionToSQLite = async (session: ChatSession) => {
    try {
      const conversationData = {
        id: session.id,
        userTitle: session.title,
        autoTitle: null,
        isArchived: false,
        _isIncognito: false,
        userSymbol: undefined,
        systemPurposeId: 'Generic',
        messages: session.messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          created: msg.timestamp,
          updated: msg.timestamp,
          fragments: [createTextContentFragment(msg.content)],
          tokenCount: msg.tokens || Math.ceil(msg.content.length / 4),
        })),
        created: session.created,
        updated: session.updated,
        tokenCount: session.messages.reduce((sum, msg) => sum + (msg.tokens || Math.ceil(msg.content.length / 4)), 0),
        _abortController: null,
      };

      // Validate conversation data structure before sending
      console.log('[Chat Test] Sending conversation data:', {
        id: conversationData.id,
        userTitle: conversationData.userTitle,
        systemPurposeId: conversationData.systemPurposeId,
        messagesCount: conversationData.messages.length,
        messageStructure: conversationData.messages[0]
          ? {
              id: conversationData.messages[0].id,
              role: conversationData.messages[0].role,
              hasFragments: !!conversationData.messages[0].fragments,
              fragmentsCount: conversationData.messages[0].fragments?.length,
              created: conversationData.messages[0].created,
              tokenCount: conversationData.messages[0].tokenCount,
            }
          : 'No messages',
      });

      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation: conversationData }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Chat Test] API Error Response:', errorText);
        console.error('[Chat Test] Response Status:', response.status);
        console.error('[Chat Test] Conversation Data:', conversationData);
        throw new Error(`Failed to save conversation to SQLite: ${response.status} - ${errorText}`);
      }

      const responseData = await response.json();
      console.log('[Chat Test] Session saved to SQLite:', session.id);
      console.log('[Chat Test] Save Response:', responseData);
    } catch (err) {
      console.error('[Chat Test] Failed to save session:', err);
      throw err;
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !currentSession || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputMessage.trim(),
      timestamp: Date.now(),
    };

    // Create placeholder assistant message for streaming
    const assistantMessage: ChatMessage = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };

    const updatedSession = {
      ...currentSession,
      messages: [...currentSession.messages, userMessage, assistantMessage],
      updated: Date.now(),
    };

    setCurrentSession(updatedSession);
    setInputMessage('');
    setIsLoading(true);
    setIsStreaming(true);
    setStreamingCharCount(0);
    setStreamingWordCount(0);
    setStreamingStartTime(Date.now());
    setError(null);
    setCurrentMessageCost(0);
    setCurrentMessageTokens({ input: 0, output: 0 });
    streamingMessageRef.current = '';

    // Estimate input tokens (rough approximation: 1 token ≈ 4 characters)
    const estimatedInputTokens = Math.ceil(userMessage.content.length / 4);
    setCurrentMessageTokens(prev => ({ ...prev, input: estimatedInputTokens }));

    try {
      // Build system message with SQLite context
      const systemMessage = `You are an AI assistant integrated with SQLite-backed big-AGI.
Current session: ${updatedSession.id}
UI Preferences: ${
        uiPreferences
          ? JSON.stringify({
              language: uiPreferences.preferredLanguage,
              complexity: uiPreferences.complexityMode,
              scaling: uiPreferences.contentScaling,
              centerMode: uiPreferences.centerMode,
            })
          : 'Not loaded'
      }
UX Labs Settings: ${
        uxLabsSettings
          ? JSON.stringify({
              screenCapture: uxLabsSettings.labsAttachScreenCapture,
              enhanceCodeBlocks: uxLabsSettings.labsEnhanceCodeBlocks,
              showCost: uxLabsSettings.labsShowCost,
              highPerformance: uxLabsSettings.labsHighPerformance,
              devMode: uxLabsSettings.labsDevMode,
            })
          : 'Not loaded'
      }
Chat history: ${updatedSession.messages.length} messages
SQLite integration: Active

Please respond naturally to the user while acknowledging this SQLite integration context.`;

      // Send to AI via our streaming test endpoint
      const aiResponse = await fetch('/api/test-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMessage.content,
          model: selectedModel,
          uiPreferences: uiPreferences,
          uxLabsSettings: uxLabsSettings,
          systemContext: systemMessage,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        throw new Error(`AI request failed: ${aiResponse.status} - ${errorText}`);
      }

      // Handle streaming response
      const reader = aiResponse.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response stream available');
      }

      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.trim() === '' || !line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'content' && data.content) {
              accumulatedContent += data.content;
              streamingMessageRef.current = accumulatedContent;
              setStreamingCharCount(accumulatedContent.length);
              setStreamingWordCount(
                accumulatedContent
                  .trim()
                  .split(/\s+/)
                  .filter((word) => word.length > 0).length,
              );

              // Update the streaming message in real-time
              setCurrentSession((prevSession) => {
                if (!prevSession) return prevSession;

                const updatedMessages = [...prevSession.messages];
                const lastMessageIndex = updatedMessages.length - 1;

                if (lastMessageIndex >= 0 && updatedMessages[lastMessageIndex].isStreaming) {
                  updatedMessages[lastMessageIndex] = {
                    ...updatedMessages[lastMessageIndex],
                    content: accumulatedContent,
                    timestamp: Date.now(),
                  };
                }

                return {
                  ...prevSession,
                  messages: updatedMessages,
                  updated: Date.now(),
                };
              });
            }
          } catch (e) {
            console.error('Error parsing streaming data:', e);
          }
        }
      }

      // Finalize the streaming message
      setCurrentSession((prevSession) => {
        if (!prevSession) return prevSession;

        const updatedMessages = [...prevSession.messages];
        const lastMessageIndex = updatedMessages.length - 1;

        if (lastMessageIndex >= 0 && updatedMessages[lastMessageIndex].isStreaming) {
          updatedMessages[lastMessageIndex] = {
            ...updatedMessages[lastMessageIndex],
            content: accumulatedContent,
            isStreaming: false,
            tokens: Math.ceil(accumulatedContent.length / 4), // Rough estimate
            timestamp: Date.now(),
          };
        }

        return {
          ...prevSession,
          messages: updatedMessages,
          updated: Date.now(),
        };
      });

      // Calculate final tokens and cost
      const outputTokens = Math.ceil(accumulatedContent.length / 4);
      const totalTokens = estimatedInputTokens + outputTokens;
      
      // Use model-specific pricing or fallback to GPT-3.5-turbo pricing
      const inputCostPer1k = (modelPricing?.input || 0.5) / 1000; // Convert $/1M to $/1K
      const outputCostPer1k = (modelPricing?.output || 1.5) / 1000; // Convert $/1M to $/1K
      const estimatedCost = (estimatedInputTokens * inputCostPer1k) + (outputTokens * outputCostPer1k);
      
      setCurrentMessageCost(estimatedCost);
      setCurrentMessageTokens({ input: estimatedInputTokens, output: outputTokens });

      // Track metrics in SQLite
      try {
        await fetch('/api/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation: 'addCostEntry',
            serviceId: `${selectedModel}-chat-test`,
            costs: {
              $c: estimatedCost * 100, // Convert to cents
              $code: 'partial-msg' // Mark as estimated
            },
            inputTokens: estimatedInputTokens,
            outputTokens: outputTokens,
            debugCostSource: 'Chat Test Interface'
          }),
        });
        
        // Refresh metrics data
        await loadMetricsData();
      } catch (metricsError) {
        console.error('[Chat Test] Failed to track metrics:', metricsError);
      }

      const finalSession = {
        ...updatedSession,
        messages: [
          ...updatedSession.messages.slice(0, -1), // Remove placeholder
          {
            ...assistantMessage,
            content: accumulatedContent,
            isStreaming: false,
            tokens: outputTokens,
            cost: estimatedCost,
            model: selectedModel,
          },
        ],
        updated: Date.now(),
        totalCost: (updatedSession.totalCost || 0) + estimatedCost,
        totalTokens: (updatedSession.totalTokens || 0) + totalTokens,
      };

      // Save to SQLite
      await saveSessionToSQLite(finalSession);

      // Update sessions list
      setSessions((prev) => {
        const existing = prev.find((s) => s.id === finalSession.id);
        if (existing) {
          return prev.map((s) => (s.id === finalSession.id ? finalSession : s));
        } else {
          return [...prev, finalSession];
        }
      });
    } catch (err) {
      console.error('[Chat Test] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');

      // Remove the streaming message on error
      setCurrentSession((prevSession) => {
        if (!prevSession) return prevSession;

        const messages = prevSession.messages;
        const lastMessage = messages[messages.length - 1];

        if (lastMessage?.isStreaming) {
          return {
            ...prevSession,
            messages: messages.slice(0, -1), // Remove streaming message
          };
        }

        return prevSession;
      });
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      setStreamingCharCount(0);
      setStreamingWordCount(0);
      setStreamingStartTime(null);
    }
  };

  const selectSession = (session: ChatSession) => {
    setCurrentSession(session);
    setError(null);
  };

  const clearCurrentSession = () => {
    setCurrentSession(null);
    setError(null);
  };

  // Chat Management Functions

  const startEditingTitle = (session: ChatSession) => {
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const saveEditedTitle = async () => {
    if (!editingSessionId || !editingTitle.trim()) {
      setEditingSessionId(null);
      return;
    }

    const sessionToUpdate = sessions.find(s => s.id === editingSessionId);
    if (!sessionToUpdate) {
      setEditingSessionId(null);
      return;
    }

    const updatedSession = {
      ...sessionToUpdate,
      title: editingTitle.trim(),
      updated: Date.now(),
    };

    try {
      await saveSessionToSQLite(updatedSession);
      
      // Update sessions list
      setSessions(prev => prev.map(s => s.id === editingSessionId ? updatedSession : s));
      
      // Update current session if it's the one being edited
      if (currentSession?.id === editingSessionId) {
        setCurrentSession(updatedSession);
      }
      
      setEditingSessionId(null);
      setEditingTitle('');
    } catch (error) {
      console.error('Failed to update title:', error);
      setError('Failed to update chat title');
    }
  };

  const cancelEditingTitle = () => {
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const generateAutoTitle = async (session: ChatSession) => {
    if (session.messages.length === 0) return;

    try {
      // Take first user message for title generation
      const firstUserMessage = session.messages.find(m => m.role === 'user');
      if (!firstUserMessage) return;

      const prompt = `Based on this conversation starter, generate a concise title (max 5 words): "${firstUserMessage.content.slice(0, 100)}"`;
      
      const response = await fetch('/api/test-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt,
          model: 'gpt-3.5-turbo', // Use fast model for titles
          systemContext: 'You are a title generator. Generate short, descriptive titles only. No quotes or extra text.',
        }),
      });

      if (!response.ok) throw new Error('Failed to generate title');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let generatedTitle = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.trim() === '' || !line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'content' && data.content) {
                generatedTitle += data.content;
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
        }
      }

      if (generatedTitle.trim()) {
        const updatedSession = {
          ...session,
          title: generatedTitle.trim().replace(/['"]/g, ''), // Remove quotes
          updated: Date.now(),
        };

        await saveSessionToSQLite(updatedSession);
        setSessions(prev => prev.map(s => s.id === session.id ? updatedSession : s));
        
        if (currentSession?.id === session.id) {
          setCurrentSession(updatedSession);
        }
      }
    } catch (error) {
      console.error('Failed to generate auto title:', error);
      setError('Failed to generate automatic title');
    }
  };

  const duplicateSession = async (session: ChatSession) => {
    const duplicatedSession: ChatSession = {
      id: `chat-test-${Date.now()}`,
      title: `${session.title} (Copy)`,
      messages: [...session.messages.map(msg => ({ ...msg, id: `msg-${Date.now()}-${Math.random()}` }))],
      created: Date.now(),
      updated: Date.now(),
      totalCost: session.totalCost,
      totalTokens: session.totalTokens,
    };

    try {
      await saveSessionToSQLite(duplicatedSession);
      setSessions(prev => [duplicatedSession, ...prev]);
      setCurrentSession(duplicatedSession);
    } catch (error) {
      console.error('Failed to duplicate session:', error);
      setError('Failed to duplicate chat');
    }
  };

  const exportSession = (session: ChatSession, format: 'json' | 'markdown') => {
    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'json') {
      content = JSON.stringify(session, null, 2);
      filename = `chat-${session.id}-${new Date().toISOString().split('T')[0]}.json`;
      mimeType = 'application/json';
    } else {
      // Markdown format
      content = `# ${session.title}\n\n`;
      content += `**Created:** ${new Date(session.created).toLocaleString()}\n`;
      content += `**Updated:** ${new Date(session.updated).toLocaleString()}\n`;
      content += `**Messages:** ${session.messages.length}\n`;
      if (session.totalCost) content += `**Total Cost:** $${session.totalCost.toFixed(6)}\n`;
      if (session.totalTokens) content += `**Total Tokens:** ${session.totalTokens.toLocaleString()}\n`;
      content += '\n---\n\n';

      session.messages.forEach((msg, index) => {
        const role = msg.role === 'user' ? '**You**' : '**Assistant**';
        const timestamp = new Date(msg.timestamp).toLocaleTimeString();
        content += `## ${role} (${timestamp})\n\n${msg.content}\n\n`;
        if (msg.tokens || msg.cost) {
          content += `*${msg.tokens ? `${msg.tokens} tokens` : ''}${msg.tokens && msg.cost ? ', ' : ''}${msg.cost ? `$${msg.cost.toFixed(6)}` : ''}*\n\n`;
        }
      });

      filename = `chat-${session.id}-${new Date().toISOString().split('T')[0]}.md`;
      mimeType = 'text/markdown';
    }

    // Create and download file
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setShowExportModal(null);
  };

  const deleteSession = async (sessionId: string) => {
    try {
      // Delete from API
      const response = await fetch(`/api/chats/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete from database');
      }

      // Update local state
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      
      // Clear current session if it was deleted
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
      }

      setShowDeleteConfirmation(null);
    } catch (error) {
      console.error('Failed to delete session:', error);
      setError('Failed to delete chat');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isStreaming) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.surface',
        py: 2,
      }}
    >
      <Box sx={{ maxWidth: '1400px', mx: 'auto', px: 2 }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography level="h1" sx={{ mb: 1 }}>
            Chat Test - SQLite + AI Integration
          </Typography>
          <Typography level="body-md" sx={{ color: 'text.secondary' }}>
            Real chat interface testing SQLite persistence and AI responses
          </Typography>
        </Box>

        {/* Navigation Section */}
        <Card sx={{ mb: 3, p: 2, bgcolor: 'success.softBg' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography level="h4" sx={{ mb: 1 }}>
                🚀 Live Chat Testing
              </Typography>
              <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                Testing real conversations with SQLite persistence and AI integration
              </Typography>
            </Box>
            <Button variant="outlined" startDecorator={<SettingsIcon />} onClick={() => window.open('/sqlite-test', '_blank')}>
              📊 SQLite Tests
            </Button>
          </Box>
        </Card>

        {/* System Status */}
        <Card sx={{ mb: 3, p: 2 }}>
          <Typography level="h4" sx={{ mb: 2 }}>
            System Status
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Box>
              <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                AI API: {systemStatus?.openaiConfigured ? '✅ Connected' : '❌ Not Configured'}
              </Typography>
            </Box>
            <Box>
              <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                UI Preferences: {uiPreferences ? '✅ Loaded' : '❌ Not Loaded'}
              </Typography>
            </Box>
            <Box>
              <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                UX Labs: {uxLabsSettings ? '✅ Loaded' : '❌ Not Loaded'}
              </Typography>
            </Box>
            <Box>
              <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                Chat Sessions: {sessions.length} found
              </Typography>
            </Box>
            {isStreaming && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, bgcolor: 'primary.softBg', borderRadius: 'sm' }}>
                <CircularProgress size="sm" />
                <Typography level="body-sm" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                  🔄 Streaming: {streamingWordCount} palavras ({streamingCharCount} chars)
                </Typography>
                {streamingStartTime && (
                  <Typography level="body-xs" sx={{ color: 'primary.main', opacity: 0.8 }}>
                    {Math.round((Date.now() - streamingStartTime) / 1000)}s
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </Card>

        {/* Model Selection */}
        <Card sx={{ mb: 3, p: 2 }}>
          <Typography level="h4" sx={{ mb: 2 }}>
            🤖 Model Selection & Pricing
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
            <Box sx={{ minWidth: '200px' }}>
              <Typography level="body-sm" sx={{ mb: 1, fontWeight: 'bold' }}>
                Selected Model:
              </Typography>
              <select 
                value={selectedModel} 
                onChange={(e) => handleModelChange(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #ccc',
                  fontSize: '14px',
                  minWidth: '200px'
                }}
              >
                {availableModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.pricing?.description || model.name}
                  </option>
                ))}
              </select>
            </Box>

            {modelPricing && (
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Box sx={{ px: 2, py: 1, bgcolor: 'success.softBg', borderRadius: 'sm' }}>
                  <Typography level="body-xs" sx={{ fontWeight: 'bold' }}>
                    Input: ${(modelPricing.input / 1000).toFixed(6)}/1K tokens
                  </Typography>
                </Box>
                <Box sx={{ px: 2, py: 1, bgcolor: 'warning.softBg', borderRadius: 'sm' }}>
                  <Typography level="body-xs" sx={{ fontWeight: 'bold' }}>
                    Output: ${(modelPricing.output / 1000).toFixed(6)}/1K tokens
                  </Typography>
                </Box>
              </Box>
            )}

            <Button size="sm" variant="outlined" onClick={loadAvailableModels}>
              🔄 Refresh Models
            </Button>
          </Box>

          <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
            Available Models: {availableModels.length} • Current: {selectedModel}
            {modelPricing && ` • Est. cost per 1K tokens: $${((modelPricing.input + modelPricing.output) / 1000).toFixed(6)}`}
          </Typography>
        </Card>

        {/* Comprehensive Metrics Dashboard */}
        <Card sx={{ mb: 3, p: 2 }}>
          <Typography level="h4" sx={{ mb: 2 }}>
            📊 Live Metrics & Analytics Dashboard
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
            {/* Current Message Metrics */}
            {(currentMessageCost > 0 || currentMessageTokens.input > 0) && (
              <Card variant="outlined" sx={{ p: 2, bgcolor: 'primary.softBg' }}>
                <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                  🔄 Current Message
                </Typography>
                <Typography level="body-xs">Cost: ${currentMessageCost.toFixed(6)}</Typography>
                <Typography level="body-xs">Input: {currentMessageTokens.input} tokens</Typography>
                <Typography level="body-xs">Output: {currentMessageTokens.output} tokens</Typography>
              </Card>
            )}

            {/* Session Totals */}
            {currentSession && (
              <Card variant="outlined" sx={{ p: 2, bgcolor: 'success.softBg' }}>
                <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                  💬 Current Session
                </Typography>
                <Typography level="body-xs">Messages: {currentSession.messages.length}</Typography>
                <Typography level="body-xs">Cost: ${(currentSession.totalCost || 0).toFixed(6)}</Typography>
                <Typography level="body-xs">Tokens: {currentSession.totalTokens || 0}</Typography>
              </Card>
            )}

            {/* Global Metrics */}
            {metricsData?.serviceMetrics && Object.keys(metricsData.serviceMetrics).length > 0 && (
              <Card variant="outlined" sx={{ p: 2, bgcolor: 'warning.softBg' }}>
                <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                  🌍 Global Usage
                </Typography>
                <Typography level="body-xs">
                  Services: {Object.keys(metricsData.serviceMetrics).length}
                </Typography>
                <Typography level="body-xs">
                  Total Cost: ${Object.values(metricsData.serviceMetrics).reduce((sum, m) => sum + m.totalCosts, 0).toFixed(4)}
                </Typography>
                <Typography level="body-xs">
                  Total Calls: {Object.values(metricsData.serviceMetrics).reduce((sum, m) => sum + m.usageCount, 0)}
                </Typography>
              </Card>
            )}

            {/* Token Statistics */}
            {metricsData?.serviceMetrics && Object.keys(metricsData.serviceMetrics).length > 0 && (
              <Card variant="outlined" sx={{ p: 2, bgcolor: 'neutral.softBg' }}>
                <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                  🎯 Token Stats
                </Typography>
                <Typography level="body-xs">
                  Input: {Object.values(metricsData.serviceMetrics).reduce((sum, m) => sum + m.totalInputTokens, 0).toLocaleString()}
                </Typography>
                <Typography level="body-xs">
                  Output: {Object.values(metricsData.serviceMetrics).reduce((sum, m) => sum + m.totalOutputTokens, 0).toLocaleString()}
                </Typography>
                <Typography level="body-xs">
                  Savings: ${Object.values(metricsData.serviceMetrics).reduce((sum, m) => sum + m.totalSavings, 0).toFixed(4)}
                </Typography>
              </Card>
            )}
          </Box>

          {/* Detailed Service Metrics */}
          {metricsData?.serviceMetrics && Object.keys(metricsData.serviceMetrics).length > 0 && (
            <Box>
              <Typography level="title-sm" sx={{ mb: 2 }}>
                📈 Service-by-Service Breakdown
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {Object.entries(metricsData.serviceMetrics).map(([serviceId, metrics]) => (
                  <Card key={serviceId} variant="outlined" sx={{ p: 2 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 2, alignItems: 'center' }}>
                      <Box>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                          {serviceId}
                        </Typography>
                        <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                          {metrics.usageCount} calls
                        </Typography>
                      </Box>
                      <Box>
                        <Typography level="body-xs" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                          ${metrics.totalCosts.toFixed(6)}
                        </Typography>
                        <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                          Total Cost
                        </Typography>
                      </Box>
                      <Box>
                        <Typography level="body-xs" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                          {(metrics.totalInputTokens + metrics.totalOutputTokens).toLocaleString()}
                        </Typography>
                        <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                          Total Tokens
                        </Typography>
                      </Box>
                      <Box>
                        <Typography level="body-xs" sx={{ color: 'warning.main', fontWeight: 'bold' }}>
                          {metrics.totalSavings > 0 ? `$${metrics.totalSavings.toFixed(6)}` : 'N/A'}
                        </Typography>
                        <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                          Savings
                        </Typography>  
                      </Box>
                      <Box>
                        <Typography level="body-xs" sx={{ color: 'text.primary' }}>
                          {new Date(metrics.lastUsageDate).toLocaleString()}
                        </Typography>
                        <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                          Last Used
                        </Typography>
                      </Box>
                    </Box>
                    
                    <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Typography level="body-xs" sx={{ px: 1, py: 0.5, bgcolor: 'success.softBg', borderRadius: 'xs' }}>
                        Free: {metrics.freeUsages}
                      </Typography>
                      <Typography level="body-xs" sx={{ px: 1, py: 0.5, bgcolor: 'warning.softBg', borderRadius: 'xs' }}>
                        No Pricing: {metrics.noPricingUsages}
                      </Typography>
                      <Typography level="body-xs" sx={{ px: 1, py: 0.5, bgcolor: 'danger.softBg', borderRadius: 'xs' }}>
                        Partial: {metrics.partialMessageUsages}
                      </Typography>
                    </Box>
                  </Card>
                ))}
              </Box>
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Button size="sm" variant="outlined" onClick={loadMetricsData}>
              🔄 Refresh Metrics
            </Button>
            <Button 
              size="sm" 
              variant="outlined" 
              color="danger" 
              onClick={async () => {
                if (confirm('Tem certeza que deseja limpar todas as métricas? Esta ação não pode ser desfeita.')) {
                  try {
                    const response = await fetch('/api/metrics', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ operation: 'clear' }),
                    });
                    if (response.ok) {
                      await loadMetricsData();
                      alert('Métricas limpas com sucesso!');
                    }
                  } catch (err) {
                    alert('Erro ao limpar métricas');
                  }
                }
              }}
            >
              🗑️ Clear Metrics
            </Button>
            <Button size="sm" variant="outlined" color="neutral" onClick={() => window.open('/sqlite-test', '_blank')}>
              📊 Full SQLite Tests
            </Button>
          </Box>
        </Card>

        <Box sx={{ display: 'flex', gap: 2, height: '70vh' }}>
          {/* Sessions Sidebar */}
          <Card sx={{ width: '300px', p: 2, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography level="h4">Chat Sessions</Typography>
              <Button size="sm" onClick={createNewSession}>
                New Chat
              </Button>
            </Box>

            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {sessions.map((session) => (
                <Card
                  key={session.id}
                  variant={currentSession?.id === session.id ? 'solid' : 'outlined'}
                  sx={{
                    mb: 1,
                    p: 2,
                    position: 'relative',
                    '&:hover .chat-actions': { 
                      opacity: 1 
                    },
                  }}
                >
                  {/* Chat Title - Editable */}
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, gap: 1 }}>
                    {editingSessionId === session.id ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
                        <Input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') saveEditedTitle();
                            if (e.key === 'Escape') cancelEditingTitle();
                          }}
                          size="sm"
                          sx={{ flex: 1 }}
                          autoFocus
                        />
                        <IconButton size="sm" onClick={saveEditedTitle}>
                          <CheckIcon />
                        </IconButton>
                        <IconButton size="sm" onClick={cancelEditingTitle}>
                          <CloseIcon />
                        </IconButton>
                      </Box>
                    ) : (
                      <>
                        <Typography 
                          level="body-sm" 
                          sx={{ 
                            fontWeight: 'bold', 
                            flex: 1, 
                            cursor: 'pointer',
                            '&:hover': { textDecoration: 'underline' }
                          }}
                          onClick={() => selectSession(session)}
                        >
                          {session.title}
                        </Typography>
                        
                        {/* Chat Actions - Hover Menu */}
                        <Box 
                          className="chat-actions"
                          sx={{ 
                            opacity: 0, 
                            transition: 'opacity 0.2s',
                            display: 'flex',
                            gap: 0.5
                          }}
                        >
                          <Dropdown>
                            <MenuButton
                              slots={{ root: IconButton }}
                              slotProps={{ root: { size: 'sm', variant: 'plain' } }}
                            >
                              <MoreVertIcon />
                            </MenuButton>
                            <Menu placement="bottom-end">
                              <MenuItem onClick={() => startEditingTitle(session)}>
                                <EditIcon sx={{ mr: 1 }} />
                                Rename
                              </MenuItem>
                              <MenuItem onClick={() => generateAutoTitle(session)}>
                                <AutoFixHighIcon sx={{ mr: 1 }} />
                                Auto-name
                              </MenuItem>
                              <MenuItem onClick={() => duplicateSession(session)}>
                                <ContentCopyIcon sx={{ mr: 1 }} />
                                Duplicate
                              </MenuItem>
                              <MenuItem onClick={() => setShowExportModal(session.id)}>
                                <FileDownloadIcon sx={{ mr: 1 }} />
                                Export
                              </MenuItem>
                              <Divider />
                              <MenuItem 
                                onClick={() => setShowDeleteConfirmation(session.id)}
                                color="danger"
                              >
                                <DeleteIcon sx={{ mr: 1 }} />
                                Delete
                              </MenuItem>
                            </Menu>
                          </Dropdown>
                        </Box>
                      </>
                    )}
                  </Box>

                  {/* Chat Info */}
                  <Box onClick={() => selectSession(session)} sx={{ cursor: 'pointer' }}>
                    <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                      {session.messages.length} messages
                    </Typography>
                    {session.totalCost && (
                      <Typography level="body-xs" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                        ${session.totalCost.toFixed(6)}
                      </Typography>
                    )}
                    {session.totalTokens && (
                      <Typography level="body-xs" sx={{ color: 'primary.main' }}>
                        {session.totalTokens.toLocaleString()} tokens
                      </Typography>
                    )}
                    <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                      {new Date(session.updated).toLocaleString()}
                    </Typography>
                  </Box>
                </Card>
              ))}
            </Box>

            <Button variant="outlined" size="sm" onClick={loadChatSessions} sx={{ mt: 2 }}>
              Refresh Sessions
            </Button>
          </Card>

          {/* Chat Interface */}
          <Card sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column' }}>
            {!currentSession ? (
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <SmartToyIcon sx={{ fontSize: '3rem', color: 'text.secondary' }} />
                <Typography level="h4" sx={{ color: 'text.secondary' }}>
                  Select a session or create a new chat to get started
                </Typography>
                <Button onClick={createNewSession}>Start New Chat</Button>
              </Box>
            ) : (
              <>
                {/* Chat Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                    <Typography level="h4" sx={{ flex: 1 }}>{currentSession.title}</Typography>
                    
                    {/* Current Chat Actions */}
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton 
                        size="sm" 
                        title="Rename chat"
                        onClick={() => startEditingTitle(currentSession)}
                      >
                        <EditIcon />
                      </IconButton>
                      
                      <IconButton 
                        size="sm" 
                        title="Generate automatic title"
                        onClick={() => generateAutoTitle(currentSession)}
                        disabled={currentSession.messages.length === 0}
                      >
                        <AutoFixHighIcon />
                      </IconButton>
                      
                      <IconButton 
                        size="sm" 
                        title="Duplicate chat"
                        onClick={() => duplicateSession(currentSession)}
                      >
                        <ContentCopyIcon />
                      </IconButton>
                      
                      <IconButton 
                        size="sm" 
                        title="Export chat"
                        onClick={() => setShowExportModal(currentSession.id)}
                      >
                        <FileDownloadIcon />
                      </IconButton>
                      
                      <IconButton 
                        size="sm" 
                        title="Close chat"
                        onClick={clearCurrentSession}
                      >
                        <ClearIcon />
                      </IconButton>
                    </Box>
                  </Box>
                </Box>

                {/* Messages */}
                <Box
                  sx={{
                    flex: 1,
                    overflow: 'auto',
                    mb: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 'sm',
                    p: 2,
                  }}
                >
                  {currentSession.messages.map((message) => (
                    <Box
                      key={message.id}
                      sx={{
                        display: 'flex',
                        mb: 2,
                        alignItems: 'flex-start',
                        gap: 1,
                      }}
                    >
                      <Box
                        sx={{
                          minWidth: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          bgcolor: message.role === 'user' ? 'primary.softBg' : 'success.softBg',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {message.role === 'user' ? <PersonIcon /> : <SmartToyIcon />}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                            {message.role === 'user' ? 'You' : 'Assistant'}
                          </Typography>
                          <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </Typography>
                          {message.isStreaming && (
                            <Typography level="body-xs" sx={{ color: 'primary.main', fontStyle: 'italic' }}>
                              ✍️ digitando... {streamingWordCount} palavras
                            </Typography>
                          )}
                          {message.tokens && !message.isStreaming && (
                            <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                              ({message.tokens} tokens{message.cost ? `, $${message.cost.toFixed(6)}` : ''})
                            </Typography>
                          )}
                          {message.model && (
                            <Typography level="body-xs" sx={{ color: 'primary.main', fontStyle: 'italic' }}>
                              {message.model}
                            </Typography>
                          )}
                        </Box>
                        <Typography
                          level="body-sm"
                          sx={{
                            whiteSpace: 'pre-wrap',
                            display: 'flex',
                            alignItems: 'baseline',
                          }}
                        >
                          <span>{message.content}</span>
                          {message.isStreaming && <StreamingCursor />}
                        </Typography>
                      </Box>
                    </Box>
                  ))}

                  {isLoading && !isStreaming && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                      <CircularProgress size="sm" />
                      <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                        AI está pensando...
                      </Typography>
                    </Box>
                  )}

                  <div ref={messagesEndRef} />
                </Box>

                {/* Error Display */}
                {error && (
                  <Alert color="danger" sx={{ mb: 2 }}>
                    <Typography level="body-sm">{error}</Typography>
                  </Alert>
                )}

                {/* Input */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isLoading || isStreaming}
                    placeholder={isStreaming ? `Aguarde... (${streamingWordCount} palavras recebidas)` : 'Digite sua mensagem...'}
                    sx={{ flex: 1 }}
                    endDecorator={
                      <IconButton onClick={sendMessage} disabled={!inputMessage.trim() || isLoading || isStreaming} size="sm">
                        <SendIcon />
                      </IconButton>
                    }
                  />
                </Box>

                {/* Session Info */}
                <Box sx={{ mt: 2, p: 1, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                  <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                    Session ID: {currentSession.id} • Messages: {currentSession.messages.length}
                    {currentSession.totalCost && ` • Cost: $${currentSession.totalCost.toFixed(6)}`}
                    {currentSession.totalTokens && ` • Tokens: ${currentSession.totalTokens.toLocaleString()}`}
                    {isStreaming ? ' • 🔄 Streaming' : ' • SQLite: ✅ Active'} • Last
                    Updated: {new Date(currentSession.updated).toLocaleTimeString()}
                  </Typography>
                </Box>
              </>
            )}
          </Card>
        </Box>

        {/* Delete Confirmation Modal */}
        <Modal open={!!showDeleteConfirmation} onClose={() => setShowDeleteConfirmation(null)}>
          <ModalDialog>
            <ModalClose />
            <Typography level="h4" sx={{ mb: 2 }}>
              Delete Chat?
            </Typography>
            <Typography level="body-sm" sx={{ mb: 3 }}>
              Are you sure you want to delete this conversation? This action cannot be undone.
            </Typography>
            <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={() => setShowDeleteConfirmation(null)}
              >
                Cancel
              </Button>
              <Button
                color="danger"
                onClick={() => showDeleteConfirmation && deleteSession(showDeleteConfirmation)}
              >
                Delete
              </Button>
            </Stack>
          </ModalDialog>
        </Modal>

        {/* Export Modal */}
        <Modal open={!!showExportModal} onClose={() => setShowExportModal(null)}>
          <ModalDialog>
            <ModalClose />
            <Typography level="h4" sx={{ mb: 2 }}>
              Export Chat
            </Typography>
            <Typography level="body-sm" sx={{ mb: 3 }}>
              Choose export format:
            </Typography>
            <Stack direction="row" spacing={2} sx={{ justifyContent: 'center' }}>
              <Button
                variant="outlined"
                startDecorator={<FileDownloadIcon />}
                onClick={() => {
                  const session = sessions.find(s => s.id === showExportModal);
                  if (session) exportSession(session, 'json');
                }}
              >
                JSON
              </Button>
              <Button
                variant="outlined"
                startDecorator={<FileDownloadIcon />}
                onClick={() => {
                  const session = sessions.find(s => s.id === showExportModal);
                  if (session) exportSession(session, 'markdown');
                }}
              >
                Markdown
              </Button>
            </Stack>
          </ModalDialog>
        </Modal>
      </Box>
    </Box>
  );
});
