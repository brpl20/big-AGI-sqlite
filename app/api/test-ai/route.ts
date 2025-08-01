import { NextRequest, NextResponse } from 'next/server';

// Simple API endpoint to test OpenAI integration with SQLite data
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, model = 'gpt-3.5-turbo', uiPreferences = {}, systemContext } = body;

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 });
    }

    // Check for OpenAI API key
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'OpenAI API key not configured',
          note: 'Please set OPENAI_API_KEY environment variable',
        },
        { status: 500 },
      );
    }

    // Prepare system message with UI preferences context
    const defaultSystemMessage = `You are an AI assistant integrated with a SQLite-backed system.
Current user preferences from SQLite:
- Language: ${uiPreferences.preferredLanguage || 'en-US'}
- UI Complexity: ${uiPreferences.complexityMode || 'pro'}
- Content Scaling: ${uiPreferences.contentScaling || 'sm'}
- Center Mode: ${uiPreferences.centerMode || 'full'}

This is a test to verify that data flows correctly from SQLite storage through to the AI API.
Please acknowledge that you received this context information and respond to the user's message.`;

    const systemMessage = systemContext || defaultSystemMessage;

    // Make request to OpenAI API with streaming
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        stream: true,
        messages: [
          {
            role: 'system',
            content: systemMessage,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      console.error('OpenAI API error:', errorData);

      return NextResponse.json(
        {
          success: false,
          error: `OpenAI API error: ${openaiResponse.status}`,
          details: errorData,
          timestamp: new Date().toISOString(),
        },
        { status: openaiResponse.status },
      );
    }

    // Handle streaming response
    if (!openaiResponse.body) {
      throw new Error('No response body received from OpenAI');
    }

    // Create a readable stream to forward the OpenAI stream
    const stream = new ReadableStream({
      start(controller) {
        const reader = openaiResponse.body!.getReader();
        const decoder = new TextDecoder();

        function pump(): Promise<void> {
          return reader.read().then(({ done, value }) => {
            if (done) {
              controller.close();
              return;
            }

            try {
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (line.trim() === '') continue;
                if (line.trim() === 'data: [DONE]') continue;
                if (!line.startsWith('data: ')) continue;

                try {
                  const data = JSON.parse(line.slice(6));
                  const content = data.choices?.[0]?.delta?.content;

                  if (content) {
                    // Send the content chunk
                    controller.enqueue(
                      new TextEncoder().encode(
                        `data: ${JSON.stringify({
                          type: 'content',
                          content: content,
                          timestamp: new Date().toISOString(),
                        })}\n\n`,
                      ),
                    );
                  }
                } catch (e) {
                  console.error('Error parsing SSE data:', e);
                }
              }
            } catch (e) {
              console.error('Error processing chunk:', e);
            }

            return pump();
          });
        }

        pump().catch((err) => {
          console.error('Stream error:', err);
          controller.error(err);
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('Test AI API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

// GET endpoint to check API status
export async function GET() {
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

  return NextResponse.json({
    success: true,
    status: 'Test AI endpoint is operational',
    openaiConfigured: hasOpenAIKey,
    timestamp: new Date().toISOString(),
    endpoints: {
      POST: 'Test AI integration with SQLite data',
      GET: 'Check API status',
    },
  });
}
