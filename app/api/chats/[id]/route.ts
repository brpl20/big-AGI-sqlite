import { NextRequest, NextResponse } from 'next/server';
import { getChatAdapter } from '../../../../src/lib/db/sqlite-chat-adapter';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const chatAdapter = getChatAdapter();
    const conversation = await chatAdapter.getConversation(id);

    if (conversation === null) {
      return NextResponse.json(
        {
          success: false,
          error: `Conversation '${id}' not found`
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      conversation
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch conversation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { conversation } = body;

    if (!conversation) {
      return NextResponse.json(
        {
          success: false,
          error: 'Conversation data is required'
        },
        { status: 400 }
      );
    }

    // Ensure the conversation ID matches the URL parameter
    if (conversation.id !== id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Conversation ID mismatch'
        },
        { status: 400 }
      );
    }

    const chatAdapter = getChatAdapter();
    await chatAdapter.saveConversation(conversation);

    return NextResponse.json({
      success: true,
      message: `Conversation '${id}' updated successfully`
    });
  } catch (error) {
    console.error('Error updating conversation:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update conversation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const chatAdapter = getChatAdapter();

    // Check if conversation exists first
    const existingConversation = await chatAdapter.getConversation(id);
    if (existingConversation === null) {
      return NextResponse.json(
        {
          success: false,
          error: `Conversation '${id}' not found`
        },
        { status: 404 }
      );
    }

    await chatAdapter.deleteConversation(id);

    return NextResponse.json({
      success: true,
      message: `Conversation '${id}' deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete conversation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
