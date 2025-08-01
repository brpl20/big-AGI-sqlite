import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const { SQLiteLLMAdapter } = await import('../../../src/lib/db/sqlite-llm-adapter');
    const llmAdapter = new SQLiteLLMAdapter();
    const llmStore = await llmAdapter.loadLLMStore();

    return NextResponse.json({
      success: true,
      data: {
        services: llmStore.sources,
        models: llmStore.llms,
        confServiceId: llmStore.confServiceId,
        assignments: llmStore.modelAssignments,
        counts: {
          services: llmStore.sources.length,
          models: llmStore.llms.length,
          assignments: Object.keys(llmStore.modelAssignments).length,
        },
      },
    });
  } catch (error) {
    console.error('[API] Error loading LLM store:', error);
    return NextResponse.json({ success: false, error: 'Failed to load LLM store' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.llms || !body.sources || !body.modelAssignments) {
      return NextResponse.json({ success: false, error: 'Missing required fields: llms, sources, modelAssignments' }, { status: 400 });
    }

    const { SQLiteLLMAdapter } = await import('../../../src/lib/db/sqlite-llm-adapter');
    const llmAdapter = new SQLiteLLMAdapter();
    await llmAdapter.saveLLMStore({
      llms: body.llms,
      sources: body.sources,
      confServiceId: body.confServiceId || null,
      modelAssignments: body.modelAssignments,
    });

    return NextResponse.json({
      success: true,
      message: 'LLM store saved successfully',
      counts: {
        services: body.sources.length,
        models: body.llms.length,
        assignments: Object.keys(body.modelAssignments).length,
      },
    });
  } catch (error) {
    console.error('[API] Error saving LLM store:', error);
    return NextResponse.json({ success: false, error: 'Failed to save LLM store' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const { SQLiteLLMAdapter } = await import('../../../src/lib/db/sqlite-llm-adapter');
    const llmAdapter = new SQLiteLLMAdapter();
    await llmAdapter.saveLLMStore({
      llms: [],
      sources: [],
      confServiceId: null,
      modelAssignments: {} as any,
    });

    return NextResponse.json({
      success: true,
      message: 'LLM store cleared successfully',
    });
  } catch (error) {
    console.error('[API] Error clearing LLM store:', error);
    return NextResponse.json({ success: false, error: 'Failed to clear LLM store' }, { status: 500 });
  }
}
