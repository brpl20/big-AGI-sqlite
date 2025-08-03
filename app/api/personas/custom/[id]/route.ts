import { NextRequest, NextResponse } from 'next/server';

type RouteParams = Promise<{ id: string }>;

// GET /api/personas/custom/[id] - Get a specific custom persona
export async function GET(request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { id } = await params;
    const { getPersonasAdapter } = await import('../../../../../src/lib/db/sqlite-personas-adapter');
    const adapter = getPersonasAdapter();
    
    const persona = await adapter.getCustomPersona(id);
    
    if (!persona) {
      return NextResponse.json(
        { error: 'Custom persona not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(persona);
  } catch (error) {
    console.error('[Personas API] Error getting custom persona:', error);
    return NextResponse.json(
      { error: 'Failed to get custom persona' },
      { status: 500 }
    );
  }
}

// DELETE /api/personas/custom/[id] - Delete a specific custom persona
export async function DELETE(request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { id } = await params;
    const { getPersonasAdapter } = await import('../../../../../src/lib/db/sqlite-personas-adapter');
    const adapter = getPersonasAdapter();
    
    await adapter.deleteCustomPersona(id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Personas API] Error deleting custom persona:', error);
    return NextResponse.json(
      { error: 'Failed to delete custom persona' },
      { status: 500 }
    );
  }
}