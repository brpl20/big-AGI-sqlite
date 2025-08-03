import { NextRequest, NextResponse } from 'next/server';

// GET /api/personas - Get all personas data (hidden and custom personas)
export async function GET() {
  try {
    const { getPersonasAdapter } = await import('../../../src/lib/db/sqlite-personas-adapter');
    const adapter = getPersonasAdapter();
    const data = await adapter.getAllData();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Personas API] Error getting personas:', error);
    return NextResponse.json(
      { error: 'Failed to get personas data' },
      { status: 500 }
    );
  }
}

// POST /api/personas/custom - Create a new custom persona
export async function POST(request: NextRequest) {
  try {
    const { getPersonasAdapter } = await import('../../../src/lib/db/sqlite-personas-adapter');
    const adapter = getPersonasAdapter();
    const persona = await request.json();
    
    if (!persona.id || !persona.systemPrompt || !persona.creationDate) {
      return NextResponse.json(
        { error: 'Missing required fields: id, systemPrompt, creationDate' },
        { status: 400 }
      );
    }
    
    await adapter.prependCustomPersona(persona);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Personas API] Error creating custom persona:', error);
    return NextResponse.json(
      { error: 'Failed to create custom persona' },
      { status: 500 }
    );
  }
}