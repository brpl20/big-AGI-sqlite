import { NextRequest, NextResponse } from 'next/server';

// GET /api/openai-models - List available OpenAI models
export async function GET() {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'OpenAI API key not configured',
          models: []
        },
        { status: 400 }
      );
    }

    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Filter for chat models and sort by name
    const chatModels = data.data
      .filter((model: any) => {
        const modelId = model.id.toLowerCase();
        return (
          modelId.includes('gpt') || 
          modelId.includes('o1') ||
          modelId.includes('chatgpt')
        ) && !modelId.includes('instruct') && !modelId.includes('embed');
      })
      .map((model: any) => ({
        id: model.id,
        name: model.id,
        created: model.created,
        owned_by: model.owned_by,
        // Add pricing information for common models
        pricing: getModelPricing(model.id)
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    return NextResponse.json({
      success: true,
      models: chatModels,
      count: chatModels.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Error fetching OpenAI models:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch models',
        details: error instanceof Error ? error.message : 'Unknown error',
        models: []
      },
      { status: 500 }
    );
  }
}

// Helper function to get model pricing information
function getModelPricing(modelId: string) {
  const pricingMap: Record<string, { input: number; output: number; description: string }> = {
    'gpt-4o': { input: 2.50, output: 10.00, description: 'GPT-4o (Latest)' },
    'gpt-4o-mini': { input: 0.15, output: 0.60, description: 'GPT-4o Mini (Fast & Cheap)' },
    'gpt-4-turbo': { input: 10.00, output: 30.00, description: 'GPT-4 Turbo (Most Capable)' },
    'gpt-4': { input: 30.00, output: 60.00, description: 'GPT-4 (Original)' },
    'gpt-3.5-turbo': { input: 0.50, output: 1.50, description: 'GPT-3.5 Turbo (Fast)' },
    'gpt-3.5-turbo-0125': { input: 0.50, output: 1.50, description: 'GPT-3.5 Turbo (Latest)' },
    'o1-preview': { input: 15.00, output: 60.00, description: 'o1 Preview (Reasoning)' },
    'o1-mini': { input: 3.00, output: 12.00, description: 'o1 Mini (Reasoning)' },
  };

  // Find exact match or partial match
  const exactMatch = pricingMap[modelId];
  if (exactMatch) return exactMatch;

  // Try partial matches
  for (const [key, pricing] of Object.entries(pricingMap)) {
    if (modelId.includes(key)) {
      return pricing;
    }
  }

  // Default pricing for unknown models
  return { input: 1.00, output: 2.00, description: 'Custom Model' };
}