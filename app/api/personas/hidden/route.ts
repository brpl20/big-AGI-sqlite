import { NextRequest, NextResponse } from 'next/server';

// GET /api/personas/hidden - Get all hidden persona IDs
export async function GET() {
  try {
    const { getPersonasAdapter } = await import('../../../../src/lib/db/sqlite-personas-adapter');
    const adapter = getPersonasAdapter();
    const hiddenPersonas = await adapter.getHiddenPersonas();
    
    return NextResponse.json({ hiddenPersonas });
  } catch (error) {
    console.error('[Personas API] Error getting hidden personas:', error);
    return NextResponse.json(
      { error: 'Failed to get hidden personas' },
      { status: 500 }
    );
  }
}

// PUT /api/personas/hidden - Update the list of hidden personas
export async function PUT(request: NextRequest) {
  try {
    const { getPersonasAdapter } = await import('../../../../src/lib/db/sqlite-personas-adapter');
    const adapter = getPersonasAdapter();
    const { personaIds } = await request.json();
    
    if (!Array.isArray(personaIds)) {
      return NextResponse.json(
        { error: 'personaIds must be an array' },
        { status: 400 }
      );
    }
    
    await adapter.setHiddenPersonas(personaIds);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Personas API] Error updating hidden personas:', error);
    return NextResponse.json(
      { error: 'Failed to update hidden personas' },
      { status: 500 }
    );
  }
}

// POST /api/personas/hidden/toggle - Toggle a persona's hidden state
export async function POST(request: NextRequest) {
  try {
    const { getPersonasAdapter } = await import('../../../../src/lib/db/sqlite-personas-adapter');
    const adapter = getPersonasAdapter();
    const { personaId } = await request.json();
    
    if (!personaId) {
      return NextResponse.json(
        { error: 'personaId is required' },
        { status: 400 }
      );
    }
    
    await adapter.toggleHiddenPersona(personaId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Personas API] Error toggling hidden persona:', error);
    return NextResponse.json(
      { error: 'Failed to toggle hidden persona' },
      { status: 500 }
    );
  }
}