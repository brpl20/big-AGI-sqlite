import { NextRequest, NextResponse } from 'next/server';

type RouteParams = Promise<{ conversationId: string }>;

// GET /api/personas/conversation/[conversationId] - Get custom prompt for a conversation
export async function GET(request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { conversationId } = await params;
    const { getPersonasAdapter } = await import('../../../../../src/lib/db/sqlite-personas-adapter');
    const adapter = getPersonasAdapter();
    
    const systemPrompt = await adapter.getConversationCustomPrompt(conversationId);
    
    return NextResponse.json({ systemPrompt });
  } catch (error) {
    console.error('[Personas API] Error getting conversation custom prompt:', error);
    return NextResponse.json(
      { error: 'Failed to get conversation custom prompt' },
      { status: 500 }
    );
  }
}

// PUT /api/personas/conversation/[conversationId] - Set custom prompt for a conversation
export async function PUT(request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { conversationId } = await params;
    const { getPersonasAdapter } = await import('../../../../../src/lib/db/sqlite-personas-adapter');
    const adapter = getPersonasAdapter();
    const { systemPrompt } = await request.json();
    
    if (!systemPrompt) {
      return NextResponse.json(
        { error: 'systemPrompt is required' },
        { status: 400 }
      );
    }
    
    await adapter.setConversationCustomPrompt(conversationId, systemPrompt);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Personas API] Error setting conversation custom prompt:', error);
    return NextResponse.json(
      { error: 'Failed to set conversation custom prompt' },
      { status: 500 }
    );
  }
}

// DELETE /api/personas/conversation/[conversationId] - Delete custom prompt for a conversation
export async function DELETE(request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { conversationId } = await params;
    const { getPersonasAdapter } = await import('../../../../../src/lib/db/sqlite-personas-adapter');
    const adapter = getPersonasAdapter();
    
    await adapter.deleteConversationCustomPrompt(conversationId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Personas API] Error deleting conversation custom prompt:', error);
    return NextResponse.json(
      { error: 'Failed to delete conversation custom prompt' },
      { status: 500 }
    );
  }
}