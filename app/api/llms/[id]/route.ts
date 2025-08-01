import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { SQLiteLLMAdapter } = await import('../../../../src/lib/db/sqlite-llm-adapter');
    const llmAdapter = new SQLiteLLMAdapter();
    const llmStore = await llmAdapter.loadLLMStore();

    // Check if it's a service ID or model ID
    const service = llmStore.sources.find((s) => s.id === id);
    if (service) {
      const serviceModels = llmStore.llms.filter((model) => model.sId === id);
      return NextResponse.json({
        success: true,
        type: 'service',
        data: {
          service,
          models: serviceModels,
          modelCount: serviceModels.length,
        },
      });
    }

    const model = llmStore.llms.find((m) => m.id === id);
    if (model) {
      const modelService = llmStore.sources.find((s) => s.id === model.sId);
      return NextResponse.json({
        success: true,
        type: 'model',
        data: {
          model,
          service: modelService,
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Service or model not found' }, { status: 404 });
  } catch (error) {
    console.error('[API] Error loading LLM by ID:', error);
    return NextResponse.json({ success: false, error: 'Failed to load LLM data' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { SQLiteLLMAdapter } = await import('../../../../src/lib/db/sqlite-llm-adapter');
    const llmAdapter = new SQLiteLLMAdapter();
    const llmStore = await llmAdapter.loadLLMStore();

    // Update service
    const serviceIndex = llmStore.sources.findIndex((s) => s.id === id);
    if (serviceIndex !== -1) {
      llmStore.sources[serviceIndex] = { ...llmStore.sources[serviceIndex], ...body };
      await llmAdapter.saveLLMStore(llmStore);

      return NextResponse.json({
        success: true,
        type: 'service',
        message: 'Service updated successfully',
        data: llmStore.sources[serviceIndex],
      });
    }

    // Update model
    const modelIndex = llmStore.llms.findIndex((m) => m.id === id);
    if (modelIndex !== -1) {
      llmStore.llms[modelIndex] = { ...llmStore.llms[modelIndex], ...body };
      await llmAdapter.saveLLMStore(llmStore);

      return NextResponse.json({
        success: true,
        type: 'model',
        message: 'Model updated successfully',
        data: llmStore.llms[modelIndex],
      });
    }

    return NextResponse.json({ success: false, error: 'Service or model not found' }, { status: 404 });
  } catch (error) {
    console.error('[API] Error updating LLM by ID:', error);
    return NextResponse.json({ success: false, error: 'Failed to update LLM data' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { SQLiteLLMAdapter } = await import('../../../../src/lib/db/sqlite-llm-adapter');
    const llmAdapter = new SQLiteLLMAdapter();
    const llmStore = await llmAdapter.loadLLMStore();

    // Delete service and its models
    const serviceIndex = llmStore.sources.findIndex((s) => s.id === id);
    if (serviceIndex !== -1) {
      const deletedService = llmStore.sources[serviceIndex];
      llmStore.sources.splice(serviceIndex, 1);

      // Remove all models from this service
      const modelsRemoved = llmStore.llms.filter((m) => m.sId === id).length;
      llmStore.llms = llmStore.llms.filter((m) => m.sId !== id);

      // Remove assignments for deleted models
      const assignmentsRemoved = Object.keys(llmStore.modelAssignments).length;
      for (const [domainId, assignment] of Object.entries(llmStore.modelAssignments)) {
        if (llmStore.llms.find((m) => m.id === assignment.modelId) === undefined) {
          delete (llmStore.modelAssignments as any)[domainId];
        }
      }
      const finalAssignments = Object.keys(llmStore.modelAssignments).length;

      await llmAdapter.saveLLMStore(llmStore);

      return NextResponse.json({
        success: true,
        type: 'service',
        message: 'Service and associated models deleted successfully',
        data: {
          deletedService,
          modelsRemoved,
          assignmentsRemoved: assignmentsRemoved - finalAssignments,
        },
      });
    }

    // Delete single model
    const modelIndex = llmStore.llms.findIndex((m) => m.id === id);
    if (modelIndex !== -1) {
      const deletedModel = llmStore.llms[modelIndex];
      llmStore.llms.splice(modelIndex, 1);

      // Remove assignments for this model
      const assignmentsRemoved = Object.keys(llmStore.modelAssignments).length;
      for (const [domainId, assignment] of Object.entries(llmStore.modelAssignments)) {
        if (assignment.modelId === id) {
          delete (llmStore.modelAssignments as any)[domainId];
        }
      }
      const finalAssignments = Object.keys(llmStore.modelAssignments).length;

      await llmAdapter.saveLLMStore(llmStore);

      return NextResponse.json({
        success: true,
        type: 'model',
        message: 'Model deleted successfully',
        data: {
          deletedModel,
          assignmentsRemoved: assignmentsRemoved - finalAssignments,
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Service or model not found' }, { status: 404 });
  } catch (error) {
    console.error('[API] Error deleting LLM by ID:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete LLM data' }, { status: 500 });
  }
}
