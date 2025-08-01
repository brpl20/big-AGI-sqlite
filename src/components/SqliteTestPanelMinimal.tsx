import React, { useState, useEffect } from 'react';
import { Box, Button, Card, Typography, Alert, Divider, Input, Textarea } from '@mui/joy';

export function SqliteTestPanelMinimal() {
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);
  const [allStores, setAllStores] = useState<any[]>([]);
  const [customStoreName, setCustomStoreName] = useState('test-store');
  const [customStoreData, setCustomStoreData] = useState('{"message": "Hello SQLite!"}');
  const [error, setError] = useState<string | null>(null);
  const [llmStore, setLlmStore] = useState<any>(null);
  const [testServiceName, setTestServiceName] = useState('test-openai');
  const [testModelName, setTestModelName] = useState('gpt-4');

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
        created: '0',
        contextTokens: 8192,
        maxOutputTokens: 4096,
        hidden: false,
        interfaces: ['oai-chat'],
        pricing: { input: { perMTokens: 30 }, output: { perMTokens: 60 } },
        parameterSpecs: [],
        initialParameters: {},
        description: 'Test model for SQLite migration',
      };

      // Create test assignment
      const testAssignment = {
        primaryChat: {
          mct: 'model-parametric',
          domainId: 'primaryChat',
          modelId: testModelName,
          modelParameters: {
            llmTemperature: 0.7,
            llmResponseTokens: 2048,
          },
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
      fetchLLMStore();
    };

    initializeStores();
  }, []);

  return (
    <Box sx={{ p: 3, maxWidth: '800px', margin: '0 auto' }}>
      <Typography level="h2" sx={{ mb: 3 }}>
        SQLite Migration Test Panel (API Only)
      </Typography>

      {error && (
        <Alert color="danger" sx={{ mb: 2 }}>
          <Typography level="body-sm">{error}</Typography>
        </Alert>
      )}

      {/* Custom Store Test Section */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Typography level="h4" sx={{ mb: 2 }}>
          Custom Store Test (API Only)
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

      {/* LLM Operations Section */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Typography level="h4" sx={{ mb: 2 }}>
          LLM Store Operations (API Only)
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
                    • {domain}: {assignment.modelId} (temp: {assignment.modelParameters?.llmTemperature || 'default'})
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
        Minimal SQLite Test Panel - API Only (No Direct SQLite Imports)
        <br />
        Tests all SQLite functionality through REST API endpoints only.
      </Typography>
    </Box>
  );
}
