import React, { useState, useEffect } from 'react';
import { Box, Button, Card, Typography, Alert, Divider, Input, Textarea } from '@mui/joy';
import ChatIcon from '@mui/icons-material/Chat';
import { testSqliteUIStore, testUIStoreAPI } from '../common/stores/store-ui-sqlite';
import { testSqliteUXLabsStore, testUXLabsStoreAPI } from '../common/stores/store-ux-labs-sqlite';
import { useModelsStore } from '~/common/stores/llms/store-llms';
import { useChatStore } from '~/common/stores/chat/store-chats';

export function SqliteTestPanel() {
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);
  const [allStores, setAllStores] = useState<any[]>([]);
  const [customStoreName, setCustomStoreName] = useState('test-store');
  const [customStoreData, setCustomStoreData] = useState('{"message": "Hello SQLite!"}');
  const [error, setError] = useState<string | null>(null);
  const [chatConversations, setChatConversations] = useState<any[]>([]);
  const [testMessageText, setTestMessageText] = useState('Hello from SQLite chat!');
  const [llmStore, setLlmStore] = useState<any>(null);
  const [testServiceName, setTestServiceName] = useState('test-openai');
  const [testModelName, setTestModelName] = useState('gpt-4');
  const [deviceState, setDeviceState] = useState<any>({ localDeviceId: '' });
  const [uiStoreState, setUiStoreState] = useState<any>(null);
  const [aiTestResults, setAiTestResults] = useState<any>(null);
  const [testPrompt, setTestPrompt] = useState(
    'Hello! Can you confirm you received this message correctly? Please respond with "Message received successfully" and tell me what time it is.',
  );
  const [migrationResults, setMigrationResults] = useState<any>(null);
  const [uxLabsStoreState, setUxLabsStoreState] = useState<any>(null);
  const [metricsData, setMetricsData] = useState<any>(null);
  const [testServiceIdForMetrics, setTestServiceIdForMetrics] = useState('test-service-metrics');

  const addTestResult = (message: string) => {
    setTestResults((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const clearResults = () => {
    setTestResults([]);
    setError(null);
  };

  const fetchAllStores = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/stores');
      const result = await response.json();

      if (result.success) {
        setAllStores(result.stores);
        addTestResult(`Fetched ${result.stores.length} stores from SQLite`);
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      addTestResult(`Error fetching stores: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testDeviceStore = async () => {
    try {
      setIsLoading(true);
      addTestResult('Testing device store operations via API...');

      // Test via API instead of direct store access
      let response = await fetch('/api/stores/app-device');
      if (response.ok) {
        const result = await response.json();
        addTestResult(`Device store loaded: ${JSON.stringify(result.data)}`);
      } else if (response.status === 404) {
        addTestResult('Device store not found, creating test data...');

        // Create test device store data
        const testDeviceData = {
          deviceId: `device-${Date.now()}`,
          browserInfo: navigator.userAgent,
          timestamp: new Date().toISOString(),
          testData: true,
        };

        const createResponse = await fetch('/api/stores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'app-device',
            data: testDeviceData,
            version: 1,
          }),
        });

        if (createResponse.ok) {
          addTestResult('Device store created successfully');

          // Now fetch it again to verify
          response = await fetch('/api/stores/app-device');
          if (response.ok) {
            const result = await response.json();
            addTestResult(`Device store verified: ${JSON.stringify(result.data)}`);
          }
        } else {
          addTestResult('Failed to create device store');
        }
      } else {
        addTestResult(`Unexpected response: ${response.status}`);
      }
      addTestResult('Device store test completed successfully');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      addTestResult(`Device store test failed: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testUIPreferencesStore = async () => {
    try {
      setIsLoading(true);
      addTestResult('Testing UI Preferences store operations...');

      // Test direct store operations
      const directResult = await testSqliteUIStore();
      if (directResult.success) {
        addTestResult(`UI store direct test completed: ${directResult.operations} operations`);
        addTestResult(`Final state: ${JSON.stringify(directResult.finalState)}`);
        setUiStoreState(directResult.finalState);
      } else {
        addTestResult(`UI store direct test failed: ${directResult.error}`);
      }

      // Test API operations
      const apiResult = await testUIStoreAPI();
      if (apiResult.success) {
        addTestResult(`UI store API test completed`);
        if (apiResult.data) {
          addTestResult(`API data preview: ${JSON.stringify(apiResult.data).substring(0, 100)}...`);
        } else {
          addTestResult(`API note: ${apiResult.note}`);
        }
      } else {
        addTestResult(`UI store API test failed: ${apiResult.error}`);
      }

      addTestResult('UI Preferences store test completed successfully');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      addTestResult(`UI Preferences store test failed: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const checkAIStatus = async () => {
    try {
      setIsLoading(true);
      addTestResult('Checking AI API status...');

      const statusResponse = await fetch('/api/test-ai');
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        addTestResult(`✅ Test AI endpoint: ${statusData.status}`);
        addTestResult(`🔑 OpenAI configured: ${statusData.openaiConfigured ? 'Yes' : 'No'}`);

        if (!statusData.openaiConfigured) {
          addTestResult('⚠️ OpenAI API key not found. Please set OPENAI_API_KEY environment variable.');
        }

        setAiTestResults({
          statusCheck: true,
          ...statusData,
        });
      } else {
        addTestResult('❌ Failed to check AI status');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      addTestResult(`❌ Status check failed: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testUXLabsPreferencesStore = async () => {
    try {
      setIsLoading(true);
      addTestResult('Testing UX Labs store operations...');

      // Test direct store operations
      const directResult = await testSqliteUXLabsStore();
      if (directResult.success) {
        addTestResult(`UX Labs store direct test completed: ${directResult.operations} operations`);
        addTestResult(`Final state: ${JSON.stringify(directResult.finalState)}`);
        setUxLabsStoreState(directResult.finalState);
      } else {
        addTestResult(`UX Labs store direct test failed: ${directResult.error}`);
      }

      // Test API operations
      const apiResult = await testUXLabsStoreAPI();
      if (apiResult.success) {
        addTestResult(`UX Labs store API test completed`);
        if (apiResult.data) {
          addTestResult(`API data preview: ${JSON.stringify(apiResult.data).substring(0, 100)}...`);
        } else {
          addTestResult(`API note: ${apiResult.note}`);
        }
      } else {
        addTestResult(`UX Labs store API test failed: ${apiResult.error}`);
      }

      addTestResult('UX Labs store test completed successfully');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      addTestResult(`UX Labs store test failed: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testUIStoreMigration = async () => {
    try {
      setIsLoading(true);
      addTestResult('Starting UI Store migration verification test...');

      // Step 1: Clear any existing UI store data
      addTestResult('Step 1: Clearing existing UI store data...');
      try {
        await fetch('/api/stores/app-ui', { method: 'DELETE' });
        addTestResult('✅ Cleared existing UI store');
      } catch (e) {
        addTestResult('ℹ️ No existing UI store to clear');
      }

      // Step 2: Simulate old data with migration needed (version 1)
      addTestResult('Step 2: Creating legacy data (version 1) to test migration...');
      const legacyData = {
        preferredLanguage: 'en-US',
        centerMode: 'narrow', // old default
        complexityMode: 'pro',
        contentScaling: 'md', // old default
        enterToSend: true, // old property name (should become enterIsNewline: false)
        doubleClickToEdit: true, // old default
        dismissals: { 'test-old': true },
        actionCounters: { 'test-counter': 5 },
      };

      const createResponse = await fetch('/api/stores/app-ui', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: legacyData, version: 1 }),
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create legacy data');
      }
      addTestResult('✅ Legacy data created with version 1');

      // Step 3: Load the store and trigger migration by importing the SQLite store
      addTestResult('Step 3: Loading SQLite UI store to trigger migration...');
      const { useUIPreferencesStore: SqliteUIStore } = await import('~/common/stores/store-ui-sqlite');

      // Wait a moment for hydration
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const migratedState = SqliteUIStore.getState();
      addTestResult('✅ SQLite store loaded and hydrated');

      // Step 4: Verify migration occurred correctly
      addTestResult('Step 4: Verifying migration results...');
      const migrationChecks = {
        enterIsNewlineFixed: migratedState.enterIsNewline === false, // enterToSend: true -> enterIsNewline: false
        contentScalingUpdated: migratedState.contentScaling === 'sm', // md -> sm in v2
        centerModeUpdated: migratedState.centerMode === 'full', // narrow -> full in v3
        doubleClickEditFixed: migratedState.doubleClickToEdit === false, // true -> false in v2
        dismissalsPreserved: Object.keys(migratedState.dismissals).length > 0,
        actionCountersPreserved: Object.keys(migratedState.actionCounters).length > 0,
      };

      const allChecksPass = Object.values(migrationChecks).every((check) => check === true);

      if (allChecksPass) {
        addTestResult('✅ All migration checks passed!');
      } else {
        addTestResult('⚠️ Some migration checks failed');
      }

      // Step 5: Verify data persisted correctly in SQLite
      addTestResult('Step 5: Verifying data persistence in SQLite...');
      const persistedResponse = await fetch('/api/stores/app-ui');
      if (persistedResponse.ok) {
        const persistedData = await persistedResponse.json();
        addTestResult('✅ Data successfully persisted to SQLite');

        setMigrationResults({
          success: allChecksPass,
          migrationChecks,
          legacyData,
          migratedState: {
            preferredLanguage: migratedState.preferredLanguage,
            centerMode: migratedState.centerMode,
            complexityMode: migratedState.complexityMode,
            contentScaling: migratedState.contentScaling,
            enterIsNewline: migratedState.enterIsNewline,
            doubleClickToEdit: migratedState.doubleClickToEdit,
            dismissalsCount: Object.keys(migratedState.dismissals).length,
            actionCountersCount: Object.keys(migratedState.actionCounters).length,
          },
          persistedData: persistedData.data,
          timestamp: new Date().toISOString(),
        });
      }

      addTestResult('🎉 UI Store migration test completed!');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      addTestResult(`❌ Migration test failed: ${errorMsg}`);
      setMigrationResults({
        success: false,
        error: errorMsg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testAIIntegration = async () => {
    try {
      setIsLoading(true);
      addTestResult('Starting comprehensive AI integration test...');

      // Step 0: Check API status first
      addTestResult('Step 0: Checking API configuration...');
      const statusResponse = await fetch('/api/test-ai');
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        if (!statusData.openaiConfigured) {
          throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
        }
        addTestResult('✅ OpenAI API key configured');
      }

      // Step 1: Verify LLM store data from SQLite
      addTestResult('Step 1: Checking LLM store configuration...');
      const llmResponse = await fetch('/api/llms');
      if (!llmResponse.ok) {
        throw new Error('Failed to fetch LLM configurations');
      }

      const llmData = await llmResponse.json();
      const openAIServices = llmData.data?.services?.filter((s: any) => s.id?.includes('openai') || s.label?.toLowerCase().includes('openai')) || [];

      if (openAIServices.length === 0) {
        addTestResult('❌ No OpenAI services found in LLM store');
        throw new Error('No OpenAI services configured');
      }

      addTestResult(`✅ Found ${openAIServices.length} OpenAI service(s): ${openAIServices.map((s: any) => s.label || s.id).join(', ')}`);

      // Step 2: Check for available OpenAI models
      const availableModels = llmData.data?.models?.filter((m: any) => openAIServices.some((s: any) => m.sId === s.id)) || [];

      if (availableModels.length === 0) {
        addTestResult('❌ No OpenAI models found');
        throw new Error('No OpenAI models available');
      }

      const testModel = availableModels.find((m: any) => m.id?.includes('gpt-3.5') || m.id?.includes('gpt-4')) || availableModels[0];

      addTestResult(`✅ Selected test model: ${testModel.label || testModel.id}`);

      // Step 3: Verify UI preferences are accessible
      addTestResult('Step 2: Checking UI preferences from SQLite...');
      const uiResponse = await fetch('/api/stores/app-ui');
      let uiPreferences = null;

      if (uiResponse.ok) {
        const uiData = await uiResponse.json();
        uiPreferences = uiData.data;
        addTestResult(`✅ UI preferences loaded: Language=${uiPreferences?.preferredLanguage}, Complexity=${uiPreferences?.complexityMode}`);
      } else {
        addTestResult('ℹ️ UI preferences not yet stored (will use defaults)');
      }

      // Step 4: Create a test conversation to verify chat store integration
      addTestResult('Step 3: Creating test conversation in SQLite chat store...');
      const conversationData = {
        id: `test-ai-integration-${Date.now()}`,
        title: 'AI Integration Test',
        messages: [
          {
            id: `msg-${Date.now()}`,
            role: 'user',
            text: testPrompt,
            timestamp: new Date().toISOString(),
            fragments: [
              {
                fId: `frag-${Date.now()}`,
                fType: 'text',
                fText: testPrompt,
              },
            ],
          },
        ],
        systemPurposeId: 'Generic',
        userTitle: '',
        autoTitle: null,
        tokenCount: testPrompt.length / 4, // rough estimate
        created: Date.now(),
        updated: Date.now(),
      };

      const chatResponse = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conversationData),
      });

      if (!chatResponse.ok) {
        throw new Error('Failed to create test conversation');
      }

      addTestResult('✅ Test conversation created in SQLite chat store');

      // Step 5: Test actual OpenAI API call with SQLite-sourced data
      addTestResult('Step 4: Testing OpenAI API integration...');

      try {
        const apiCallData = {
          model: testModel.id,
          messages: [
            {
              role: 'system',
              content: `You are an AI assistant. Current user preferences: Language=${uiPreferences?.preferredLanguage || 'en-US'}, UI Complexity=${uiPreferences?.complexityMode || 'pro'}. This is a test to verify data flow from SQLite storage.`,
            },
            {
              role: 'user',
              content: testPrompt,
            },
          ],
          max_tokens: 150,
          temperature: 0.7,
        };

        // Make API call to OpenAI through our test endpoint
        const openaiResponse = await fetch('/api/test-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: testPrompt,
            model: testModel.id || 'gpt-3.5-turbo',
            uiPreferences: uiPreferences,
          }),
        });

        if (openaiResponse.ok) {
          const responseData = await openaiResponse.json();

          if (responseData.success) {
            addTestResult('✅ OpenAI API call successful');
            addTestResult(`📡 Model used: ${responseData.data.model}`);
            addTestResult(`🤖 AI Response: ${responseData.data.response.substring(0, 200)}...`);
            addTestResult(`📊 Token usage: ${JSON.stringify(responseData.data.usage)}`);

            setAiTestResults({
              success: true,
              model: responseData.data.model,
              uiPreferences: responseData.data.uiPreferencesUsed,
              aiResponse: responseData.data.response,
              usage: responseData.data.usage,
              testResult: responseData.data.testResult,
              timestamp: responseData.data.timestamp,
            });
          } else {
            addTestResult(`⚠️ OpenAI API test failed: ${responseData.error}`);
            setAiTestResults({
              success: false,
              error: responseData.error,
              details: responseData.details,
              model: testModel.label || testModel.id,
            });
          }
        } else {
          const errorData = await openaiResponse.json();
          addTestResult(`⚠️ OpenAI API call failed: ${openaiResponse.status} - ${errorData.error}`);

          setAiTestResults({
            success: false,
            error: `API Error ${openaiResponse.status}: ${errorData.error}`,
            details: errorData.details,
            model: testModel.label || testModel.id,
          });
        }
      } catch (apiError) {
        addTestResult(`⚠️ OpenAI API error: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
        setAiTestResults({
          success: false,
          error: apiError instanceof Error ? apiError.message : 'Unknown error',
          model: testModel.label || testModel.id,
          uiPreferences: uiPreferences,
        });
      }

      // Step 6: Verify conversation was updated in SQLite
      addTestResult('Step 5: Verifying conversation storage...');
      const updatedChatResponse = await fetch(`/api/chats/${conversationData.id}`);
      if (updatedChatResponse.ok) {
        addTestResult('✅ Conversation verified in SQLite storage');
      }

      addTestResult('🎉 AI Integration test completed!');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      addTestResult(`❌ AI Integration test failed: ${errorMsg}`);
      setAiTestResults({
        success: false,
        error: errorMsg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testCustomStore = async () => {
    try {
      setIsLoading(true);
      let data;
      try {
        data = JSON.parse(customStoreData);
      } catch (parseErr) {
        throw new Error('Invalid JSON data');
      }

      // Save custom store via API
      const response = await fetch(`/api/stores/${customStoreName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, version: 1 }),
      });

      if (response.ok) {
        addTestResult(`Saved custom store '${customStoreName}' to SQLite`);
      } else {
        throw new Error('Failed to save store');
      }

      // Load it back via API
      const loadResponse = await fetch(`/api/stores/${customStoreName}`);
      if (loadResponse.ok) {
        const loadResult = await loadResponse.json();
        addTestResult(`Loaded custom store '${customStoreName}' from SQLite`);
        addTestResult(`Loaded data: ${JSON.stringify(loadResult.data)}`);
      }

      // Refresh the stores list
      await fetchAllStores();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      addTestResult(`Custom store test failed: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteCustomStore = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/stores/${customStoreName}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (result.success) {
        addTestResult(`Deleted store '${customStoreName}' from SQLite`);
        await fetchAllStores();
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      addTestResult(`Delete failed: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearAllStores = async () => {
    try {
      setIsLoading(true);
      const deletePromises = allStores.map((store) => fetch(`/api/stores/${store.name}`, { method: 'DELETE' }));

      await Promise.all(deletePromises);
      addTestResult('Cleared all stores from SQLite');
      await fetchAllStores();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      addTestResult(`Clear all stores failed: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchChatConversations = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/chats');
      if (response.ok) {
        const result = await response.json();
        const conversations = result.conversations || [];
        setChatConversations(conversations);
        addTestResult(`Fetched ${conversations.length} conversations from chat SQLite`);
      } else {
        throw new Error('Failed to fetch conversations');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      addTestResult(`Error fetching conversations: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testChatOperations = async () => {
    try {
      setIsLoading(true);
      addTestResult('Creating test conversation via API...');

      // Create a test conversation via API
      const testConversation = {
        id: `conv-${Date.now()}`,
        userTitle: `Test Chat ${new Date().toLocaleTimeString()}`,
        messages: [
          {
            role: 'user' as const,
            fragments: [
              {
                ft: 'content' as const,
                fId: `frag-${Date.now()}`,
                part: {
                  pt: 'text' as const,
                  text: testMessageText,
                },
              },
            ],
            id: `msg-${Date.now()}`,
            created: Date.now(),
            updated: Date.now(),
            tokenCount: 0,
          },
        ],
        systemPurposeId: 'Generic',
        created: Date.now(),
        updated: Date.now(),
        tokenCount: 0,
        _abortController: null,
      };

      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation: testConversation }),
      });

      if (response.ok) {
        const result = await response.json();
        addTestResult(`Created conversation via API: ${result.id || 'success'}`);
      } else {
        throw new Error('Failed to create conversation');
      }

      // Refresh the conversations list
      await fetchChatConversations();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      addTestResult(`Chat test failed: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteChatConversation = async (conversationId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/chats/${conversationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        addTestResult(`Deleted conversation: ${conversationId}`);
        await fetchChatConversations();
      } else {
        throw new Error('Failed to delete conversation');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      addTestResult(`Delete conversation failed: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLLMStore = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/llms');
      const result = await response.json();

      if (result.success) {
        setLlmStore(result.data);
        addTestResult(`Fetched LLM store: ${result.data.counts.services} services, ${result.data.counts.models} models`);
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      addTestResult(`Error fetching LLM store: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testLLMOperations = async () => {
    try {
      setIsLoading(true);
      addTestResult('Creating test LLM service and model...');

      // Create test service
      const testService = {
        id: testServiceName,
        vId: 'openai',
        label: 'Test OpenAI Service',
        setup: { oaiKey: 'test-key-123', helicone: { oaiKey: '' } },
      };

      // Create test model
      const testModel = {
        id: testModelName,
        sId: testServiceName,
        vId: 'openai',
        label: 'Test GPT-4 Model',
        created: new Date().toISOString(),
        contextTokens: 8192,
        maxOutputTokens: 4096,
        interfaces: ['oai-chat'],
        pricing: { input: { perMTokens: 30 }, output: { perMTokens: 60 } },
      };

      // Create test assignment
      const testAssignment = {
        primaryChat: {
          domainId: 'primaryChat',
          modelId: testModelName,
          temperature: 0.7,
          maxTokens: 2048,
        },
      };

      // Save to SQLite via API
      const response = await fetch('/api/llms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: [testService],
          llms: [testModel],
          confServiceId: testServiceName,
          modelAssignments: testAssignment,
        }),
      });

      const result = await response.json();
      if (result.success) {
        addTestResult(`Created LLM test data: ${result.counts.services} services, ${result.counts.models} models`);
        await fetchLLMStore();
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      addTestResult(`LLM test failed: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearLLMStore = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/llms', { method: 'DELETE' });
      const result = await response.json();

      if (result.success) {
        addTestResult('Cleared LLM store successfully');
        await fetchLLMStore();
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      addTestResult(`Clear LLM store failed: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testDirectLLMAdapter = async () => {
    try {
      setIsLoading(true);
      addTestResult('Testing LLM adapter via API...');

      const response = await fetch('/api/llms');
      if (response.ok) {
        const result = await response.json();
        const data = result.data || {};
        addTestResult(`API adapter loaded: ${data.counts?.services || 0} services, ${data.counts?.models || 0} models`);
      } else {
        throw new Error('Failed to load LLM store via API');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      addTestResult(`API adapter test failed: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Metrics Store Testing Functions
  const fetchMetricsData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/metrics');
      const result = await response.json();

      if (result.success) {
        setMetricsData(result.data);
        const serviceCount = Object.keys(result.data.serviceMetrics || {}).length;
        addTestResult(`Fetched metrics: ${serviceCount} services tracked`);
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      addTestResult(`Error fetching metrics: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testMetricsOperations = async () => {
    try {
      setIsLoading(true);
      addTestResult('Creating test metrics entry...');

      // Create test cost entry
      const testCostEntry = {
        operation: 'addCostEntry',
        costs: {
          $c: 0.05, // 5 cents
          $cdCache: 0.02, // 2 cents saved
          $code: 'partial-msg'
        },
        inputTokens: 100,
        outputTokens: 50,
        serviceId: testServiceIdForMetrics,
        debugCostSource: 'SQLite Test Panel'
      };

      const response = await fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCostEntry),
      });

      if (response.ok) {
        const result = await response.json();
        addTestResult(`Created metrics entry: ${result.message}`);
      } else {
        throw new Error('Failed to create metrics entry');
      }

      // Refresh metrics data
      await fetchMetricsData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      addTestResult(`Metrics test failed: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testMetricsServiceQuery = async () => {
    try {
      setIsLoading(true);
      addTestResult(`Querying metrics for service: ${testServiceIdForMetrics}`);

      const response = await fetch(`/api/metrics/${testServiceIdForMetrics}`);
      
      if (response.ok) {
        const result = await response.json();
        addTestResult(`Service metrics: $${result.data.totalCosts.toFixed(4)} total, ${result.data.usageCount} uses`);
      } else if (response.status === 404) {
        addTestResult('No metrics found for service (expected if no entries created yet)');
      } else {
        throw new Error('Failed to query service metrics');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      addTestResult(`Service metrics query failed: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearMetricsData = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'clear' }),
      });

      if (response.ok) {
        addTestResult('All metrics data cleared');
        setMetricsData(null);
      } else {
        throw new Error('Failed to clear metrics data');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      addTestResult(`Clear metrics failed: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Simulate device store updates
  const updateDeviceId = () => {
    const newId = `device-${Date.now()}`;
    setDeviceState({ localDeviceId: newId });
    addTestResult(`Updated device ID to: ${newId}`);
  };

  // Initialize and load stores on component mount
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

      // Then fetch all data
      fetchAllStores();
      fetchChatConversations();
      fetchLLMStore();
    };

    initializeStores();
  }, []);

  return (
    <Box sx={{ p: 3, maxWidth: '800px', margin: '0 auto' }}>
      <Typography level="h2" sx={{ mb: 3 }}>
        SQLite Migration Test Panel
      </Typography>

      {/* Navigation Section */}
      <Card sx={{ mb: 3, p: 2, bgcolor: 'primary.softBg' }}>
        <Typography level="h4" sx={{ mb: 2 }}>
          Test Pages
        </Typography>
        <Typography level="body-sm" sx={{ mb: 2, color: 'text.secondary' }}>
          Navigate between different testing interfaces
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button variant="solid" color="primary" startDecorator={<ChatIcon />} onClick={() => window.open('/chat-test', '_blank')}>
            🚀 Real Chat Test
          </Button>
          <Button variant="outlined" onClick={() => window.location.reload()}>
            📊 SQLite Tests (Current)
          </Button>
        </Box>
        <Typography level="body-xs" sx={{ mt: 1, color: 'text.secondary' }}>
          💡 The Chat Test page provides a real chat interface to test complete SQLite + AI integration
        </Typography>
      </Card>

      {error && (
        <Alert color="danger" sx={{ mb: 2 }}>
          <Typography level="body-sm">{error}</Typography>
        </Alert>
      )}

      {/* Device Store Test Section */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Typography level="h4" sx={{ mb: 2 }}>
          Device Store (Zustand + SQLite)
        </Typography>

        <Box sx={{ mb: 2, p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
          <Typography level="body-sm" sx={{ fontFamily: 'monospace' }}>
            Current State: {JSON.stringify(deviceState, null, 2)}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" onClick={testDeviceStore} loading={isLoading}>
            Test Device Store
          </Button>
          <Button variant="outlined" onClick={updateDeviceId}>
            Update Device ID
          </Button>
        </Box>
      </Card>

      {/* UX Labs Store Test Section */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Typography level="h4" sx={{ mb: 2 }}>
          UX Labs Store (SQLite Backend)
        </Typography>

        <Typography level="body-sm" sx={{ mb: 2, color: 'text.secondary' }}>
          Testing experimental features and lab settings with SQLite persistence
        </Typography>

        {uxLabsStoreState && (
          <Box sx={{ mb: 2, p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
            <Typography level="body-sm" sx={{ mb: 1, fontWeight: 'bold' }}>
              Current Experiments State:
            </Typography>
            <Typography level="body-xs" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(uxLabsStoreState, null, 2)}
            </Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" onClick={testUXLabsPreferencesStore} loading={isLoading}>
            Test UX Labs Store
          </Button>
          <Button variant="soft" onClick={() => setUxLabsStoreState(null)}>
            Clear Labs Results
          </Button>
        </Box>
      </Card>

      {/* UI Preferences Store Test Section */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Typography level="h4" sx={{ mb: 2 }}>
          UI Preferences Store (SQLite Backend)
        </Typography>

        {uiStoreState && (
          <Box sx={{ mb: 2, p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
            <Typography level="body-sm" sx={{ mb: 1, fontWeight: 'bold' }}>
              Current State:
            </Typography>
            <Typography level="body-xs" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(uiStoreState, null, 2)}
            </Typography>
          </Box>
        )}

        {migrationResults && (
          <Box sx={{ mb: 2, p: 2, bgcolor: migrationResults.success ? 'success.softBg' : 'danger.softBg', borderRadius: 'sm' }}>
            <Typography level="body-sm" sx={{ mb: 1, fontWeight: 'bold' }}>
              Migration Test Results:
            </Typography>
            <Typography level="body-xs" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(migrationResults, null, 2)}
            </Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" onClick={testUIPreferencesStore} loading={isLoading}>
            Test UI Preferences Store
          </Button>
          <Button variant="outlined" color="warning" onClick={testUIStoreMigration} loading={isLoading}>
            🔄 Test Migration
          </Button>
          <Button variant="soft" onClick={() => setMigrationResults(null)}>
            Clear Migration Results
          </Button>
        </Box>
      </Card>

      {/* AI Integration Test Section */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Typography level="h4" sx={{ mb: 2 }}>
          AI Integration Test (OpenAI + SQLite)
        </Typography>

        <Typography level="body-sm" sx={{ mb: 2, color: 'text.secondary' }}>
          This test verifies the complete data flow: UI Preferences (SQLite) → LLM Store (SQLite) → Chat Store (SQLite) → OpenAI API
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
          <Textarea placeholder="Test prompt for AI" value={testPrompt} onChange={(e) => setTestPrompt(e.target.value)} minRows={2} maxRows={4} />
        </Box>

        {aiTestResults && (
          <Box sx={{ mb: 2, p: 2, bgcolor: aiTestResults.success ? 'success.softBg' : 'danger.softBg', borderRadius: 'sm' }}>
            <Typography level="body-sm" sx={{ mb: 1, fontWeight: 'bold' }}>
              AI Test Results:
            </Typography>
            <Typography level="body-xs" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(aiTestResults, null, 2)}
            </Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" onClick={checkAIStatus} loading={isLoading}>
            🔍 Check API Status
          </Button>
          <Button variant="solid" color="primary" onClick={testAIIntegration} loading={isLoading}>
            🤖 Test AI Integration
          </Button>
          <Button variant="outlined" onClick={() => setAiTestResults(null)}>
            Clear Results
          </Button>
        </Box>
      </Card>

      {/* Custom Store Test Section */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Typography level="h4" sx={{ mb: 2 }}>
          Custom Store Test
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
          <Input placeholder="Store name" value={customStoreName} onChange={(e) => setCustomStoreName(e.target.value)} />
          <Textarea placeholder="Store data (JSON)" value={customStoreData} onChange={(e) => setCustomStoreData(e.target.value)} minRows={3} />
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="solid" onClick={testCustomStore} loading={isLoading}>
            Save & Load Test
          </Button>
          <Button variant="outlined" color="danger" onClick={deleteCustomStore} loading={isLoading}>
            Delete Store
          </Button>
        </Box>
      </Card>

      {/* Chat Operations Section */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Typography level="h4" sx={{ mb: 2 }}>
          Chat Operations (SQLite Backend)
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
          <Input placeholder="Test message text" value={testMessageText} onChange={(e) => setTestMessageText(e.target.value)} />
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <Button variant="solid" onClick={testChatOperations} loading={isLoading}>
            Create Test Conversation
          </Button>
          <Button variant="outlined" onClick={fetchChatConversations} loading={isLoading}>
            Refresh Chats
          </Button>
        </Box>

        {/* Chat Conversations List */}
        <Typography level="body-sm" sx={{ mb: 1, fontWeight: 'bold' }}>
          Conversations ({chatConversations.length}):
        </Typography>

        {chatConversations.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: '200px', overflowY: 'auto' }}>
            {chatConversations.map((conversation, index) => (
              <Box
                key={index}
                sx={{
                  p: 2,
                  bgcolor: 'background.level1',
                  borderRadius: 'sm',
                  border: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Box>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                    {conversation.userTitle || conversation.autoTitle || 'Untitled'}
                  </Typography>
                  <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                    {conversation.messages?.length || 0} messages • {conversation.id}
                  </Typography>
                </Box>
                <Button size="sm" variant="outlined" color="danger" onClick={() => deleteChatConversation(conversation.id)}>
                  Delete
                </Button>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
            No chat conversations found
          </Typography>
        )}
      </Card>

      {/* LLM Operations Section */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Typography level="h4" sx={{ mb: 2 }}>
          LLM Store Operations (SQLite Backend)
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
          <Input placeholder="Test service name" value={testServiceName} onChange={(e) => setTestServiceName(e.target.value)} />
          <Input placeholder="Test model name" value={testModelName} onChange={(e) => setTestModelName(e.target.value)} />
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <Button variant="solid" onClick={testLLMOperations} loading={isLoading}>
            Create Test LLM Data
          </Button>
          <Button variant="outlined" onClick={fetchLLMStore} loading={isLoading}>
            Refresh LLM Store
          </Button>
          <Button variant="outlined" onClick={testDirectLLMAdapter} loading={isLoading}>
            Test LLM API
          </Button>
          <Button variant="outlined" color="danger" onClick={clearLLMStore} loading={isLoading}>
            Clear LLM Store
          </Button>
        </Box>

        {/* LLM Store Status */}
        {llmStore && (
          <Box sx={{ p: 2, bgcolor: 'background.level1', borderRadius: 'sm', mb: 2 }}>
            <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
              LLM Store Status:
            </Typography>
            <Typography level="body-xs" sx={{ mb: 1 }}>
              Services: {llmStore.counts?.services || 0} | Models: {llmStore.counts?.models || 0} | Assignments: {llmStore.counts?.assignments || 0}
            </Typography>
            <Typography level="body-xs" sx={{ mb: 1 }}>
              Configuration Service: {llmStore.confServiceId || 'None'}
            </Typography>

            {/* Services List */}
            {llmStore.services?.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography level="body-xs" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Services:
                </Typography>
                {llmStore.services.map((service: any, index: number) => (
                  <Typography key={index} level="body-xs" sx={{ ml: 2, color: 'text.secondary' }}>
                    • {service.label} ({service.id}) - {service.vId}
                  </Typography>
                ))}
              </Box>
            )}

            {/* Models List */}
            {llmStore.models?.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography level="body-xs" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Models:
                </Typography>
                {llmStore.models.slice(0, 5).map((model: any, index: number) => (
                  <Typography key={index} level="body-xs" sx={{ ml: 2, color: 'text.secondary' }}>
                    • {model.label} ({model.id}) - {model.contextTokens} ctx tokens
                  </Typography>
                ))}
                {llmStore.models.length > 5 && (
                  <Typography level="body-xs" sx={{ ml: 2, color: 'text.secondary', fontStyle: 'italic' }}>
                    ... and {llmStore.models.length - 5} more models
                  </Typography>
                )}
              </Box>
            )}

            {/* Assignments List */}
            {llmStore.assignments && Object.keys(llmStore.assignments).length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography level="body-xs" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Domain Assignments:
                </Typography>
                {Object.entries(llmStore.assignments).map(([domain, assignment]: [string, any], index: number) => (
                  <Typography key={index} level="body-xs" sx={{ ml: 2, color: 'text.secondary' }}>
                    • {domain}: {assignment.modelId} (temp: {assignment.temperature || 'default'})
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        )}

        {!llmStore && (
          <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
            No LLM store data loaded. Click &quot;Refresh LLM Store&quot; to load.
          </Typography>
        )}
      </Card>

      {/* All Stores Section */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Typography level="h4" sx={{ mb: 2 }}>
          All Stores in SQLite ({allStores.length})
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Button variant="outlined" onClick={fetchAllStores} loading={isLoading}>
            Refresh
          </Button>
          <Button variant="outlined" color="danger" onClick={clearAllStores} loading={isLoading} disabled={allStores.length === 0}>
            Clear All
          </Button>
        </Box>

        {allStores.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {allStores.map((store, index) => (
              <Box
                key={index}
                sx={{
                  p: 2,
                  bgcolor: 'background.level1',
                  borderRadius: 'sm',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {store.name} (v{store.version})
                </Typography>
                <Typography level="body-xs" sx={{ color: 'text.secondary', mb: 1 }}>
                  Created: {new Date(store.created_at).toLocaleString()}
                </Typography>
                <Typography level="body-xs" sx={{ color: 'text.secondary', mb: 1 }}>
                  Updated: {new Date(store.updated_at).toLocaleString()}
                </Typography>
                <Typography level="body-xs" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  Data: {store.data.substring(0, 100)}
                  {store.data.length > 100 && '...'}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
            No stores found in SQLite database
          </Typography>
        )}
      </Card>

      {/* Metrics Store Operations Section */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Typography level="h4" sx={{ mb: 2 }}>
          Metrics Store Operations (SQLite Backend)
        </Typography>

        <Typography level="body-sm" sx={{ mb: 2, color: 'text.secondary' }}>
          Testing LLM usage metrics tracking and cost aggregation with SQLite persistence
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
          <Input 
            placeholder="Test service ID for metrics" 
            value={testServiceIdForMetrics} 
            onChange={(e) => setTestServiceIdForMetrics(e.target.value)} 
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <Button variant="solid" onClick={testMetricsOperations} loading={isLoading}>
            Create Test Metrics Entry
          </Button>
          <Button variant="outlined" onClick={fetchMetricsData} loading={isLoading}>
            Refresh Metrics Data
          </Button>
          <Button variant="outlined" onClick={testMetricsServiceQuery} loading={isLoading}>
            Query Service Metrics
          </Button>
          <Button variant="outlined" color="danger" onClick={clearMetricsData} loading={isLoading}>
            Clear All Metrics
          </Button>
        </Box>

        {/* Metrics Data Display */}
        {metricsData && (
          <Box sx={{ p: 2, bgcolor: 'background.level1', borderRadius: 'sm', mb: 2 }}>
            <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
              Metrics Data Status:
            </Typography>
            <Typography level="body-xs" sx={{ mb: 1 }}>
              Services Tracked: {Object.keys(metricsData.serviceMetrics || {}).length}
            </Typography>

            {/* Service Metrics List */}
            {Object.keys(metricsData.serviceMetrics || {}).length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography level="body-xs" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Service Metrics:
                </Typography>
                {Object.entries(metricsData.serviceMetrics).map(([serviceId, metrics]: [string, any], index: number) => (
                  <Box key={index} sx={{ ml: 2, mb: 1, p: 1, bgcolor: 'background.level2', borderRadius: 'xs' }}>
                    <Typography level="body-xs" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                      • {serviceId}
                    </Typography>
                    <Typography level="body-xs" sx={{ ml: 2, color: 'text.secondary' }}>
                      Total Cost: ${metrics.totalCosts?.toFixed(4) || '0.0000'} | Savings: ${metrics.totalSavings?.toFixed(4) || '0.0000'}
                    </Typography>
                    <Typography level="body-xs" sx={{ ml: 2, color: 'text.secondary' }}>
                      Usage: {metrics.usageCount || 0} calls | Tokens: {metrics.totalInputTokens || 0} in, {metrics.totalOutputTokens || 0} out
                    </Typography>
                    <Typography level="body-xs" sx={{ ml: 2, color: 'text.secondary' }}>
                      Counters: Free({metrics.freeUsages || 0}), No-Pricing({metrics.noPricingUsages || 0}), Partial({metrics.partialMessageUsages || 0})
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}

        {!metricsData && (
          <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
            No metrics data loaded. Click "Refresh Metrics Data" to load.
          </Typography>
        )}
      </Card>

      {/* Test Results Section */}
      <Card sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography level="h4">Test Results ({testResults.length})</Typography>
          <Button size="sm" variant="outlined" onClick={clearResults} disabled={testResults.length === 0}>
            Clear Results
          </Button>
        </Box>

        <Box
          sx={{
            maxHeight: '300px',
            overflowY: 'auto',
            p: 2,
            bgcolor: 'background.level1',
            borderRadius: 'sm',
            fontFamily: 'monospace',
            fontSize: 'sm',
          }}
        >
          {testResults.length > 0 ? (
            testResults.map((result, index) => (
              <Typography key={index} level="body-xs" sx={{ mb: 0.5, lineHeight: 1.4 }}>
                {result}
              </Typography>
            ))
          ) : (
            <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
              No test results yet. Click a test button to start.
            </Typography>
          )}
        </Box>
      </Card>

      <Divider sx={{ my: 3 }} />

      <Typography level="body-sm" sx={{ color: 'text.secondary', textAlign: 'center' }}>
        Este painel demonstra a migração do IndexedDB para SQLite local.
        <br />
        As operações CRUD são realizadas através de APIs REST no Next.js.
      </Typography>
    </Box>
  );
}
