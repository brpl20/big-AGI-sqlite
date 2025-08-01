import { NextRequest, NextResponse } from 'next/server';
import { getChatAdapter } from '../../../src/lib/db/sqlite-chat-adapter';

export async function GET() {
  try {
    const chatAdapter = getChatAdapter();
    const conversations = await chatAdapter.getAllConversations();

    return NextResponse.json({
      success: true,
      conversations,
      count: conversations.length,
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch conversations',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[Chat API] Received request body:', JSON.stringify(body, null, 2));

    const { conversation } = body;

    if (!conversation) {
      console.error('[Chat API] Missing conversation data in request');
      return NextResponse.json(
        {
          success: false,
          error: 'Conversation data is required',
        },
        { status: 400 },
      );
    }

    if (!conversation.id) {
      console.error('[Chat API] Missing conversation ID');
      return NextResponse.json(
        {
          success: false,
          error: 'Conversation ID is required',
        },
        { status: 400 },
      );
    }

    console.log('[Chat API] Saving conversation:', {
      id: conversation.id,
      messagesCount: conversation.messages?.length || 0,
      hasSystemPurpose: !!conversation.systemPurposeId,
      created: conversation.created,
      updated: conversation.updated,
    });

    const chatAdapter = getChatAdapter();
    await chatAdapter.saveConversation(conversation);

    console.log('[Chat API] Conversation saved successfully:', conversation.id);
    return NextResponse.json({
      success: true,
      message: `Conversation '${conversation.id}' saved successfully`,
      conversationId: conversation.id,
    });
  } catch (error) {
    console.error('[Chat API] Error saving conversation:', error);
    console.error('[Chat API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save conversation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
