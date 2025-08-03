import { NextRequest, NextResponse } from 'next/server';
import { SystemPurposes, SystemPurposeId } from '../../../src/data';

// Simple API endpoint to test OpenAI integration with SQLite data (fixed imports)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, model = 'gpt-3.5-turbo', uiPreferences = {}, systemContext, systemPurposeId } = body;

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

    // Use BigAGI's proper persona resolution system
    let systemMessage = 'You are an AI assistant.';
    
    if (systemPurposeId && SystemPurposes[systemPurposeId as SystemPurposeId]) {
      const persona = SystemPurposes[systemPurposeId as SystemPurposeId];
      
      // Apply BigAGI's bareBonesPromptMixer logic (simplified version)
      systemMessage = persona.systemMessage
        .replace(/\{\{LLM\.Cutoff\}\}/g, 'January 2024')
        .replace(/\{\{LocaleNow\}\}/g, new Date().toLocaleDateString())
        .replace(/\{\{Today\}\}/g, new Date().toLocaleDateString())
        .replace(/\{\{RenderMermaid\}\}/g, 'You can create Mermaid diagrams using ```mermaid code blocks.')
        .replace(/\{\{RenderPlantUML\}\}/g, 'You can create PlantUML diagrams using ```plantuml code blocks.')
        .replace(/\{\{RenderSVG\}\}/g, 'You can create SVG graphics using ```svg code blocks.')
        .replace(/\{\{PreferTables\}\}/g, 'When presenting data, prefer markdown tables when appropriate.');
      
      console.log(`[AI API] Using persona: ${systemPurposeId}`);
      console.log(`[AI API] Processed system message: ${systemMessage.substring(0, 100)}...`);
    } else {
      console.log(`[AI API] No valid persona found for: ${systemPurposeId}, using default`);
    }

    // Add context if provided, otherwise use the persona system message directly
    if (systemContext) {
      systemMessage = systemContext;
    } else if (systemPurposeId) {
      // Add minimal context for testing
      systemMessage += `\n\nAdditional Context: You are being tested in a SQLite-backed system. Respond naturally with your persona characteristics.`;
    }

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
                  const jsonStr = line.slice(6).trim();
                  if (!jsonStr) continue;
                  
                  // Additional validation: check if JSON string looks complete
                  if (!jsonStr.startsWith('{') || !jsonStr.endsWith('}')) {
                    continue;
                  }
                  
                  const data = JSON.parse(jsonStr);
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
                  // Silently skip malformed JSON chunks - they're often incomplete fragments
                  console.warn('Skipped malformed SSE chunk');
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
