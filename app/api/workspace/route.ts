import { NextRequest, NextResponse } from 'next/server';

let sqliteWorkspaceAdapter: any = null;

async function getSqliteWorkspaceAdapter() {
  if (!sqliteWorkspaceAdapter) {
    const workspaceModule = await import('../../../src/lib/db/sqlite-workspace-adapter');
    sqliteWorkspaceAdapter = workspaceModule.sqliteWorkspaceAdapter;
  }
  return sqliteWorkspaceAdapter;
}

export async function GET() {
  try {
    const adapter = await getSqliteWorkspaceAdapter();
    const data = await adapter.loadStore();
    
    return NextResponse.json({
      success: true,
      data: data || { liveFilesByWorkspace: {} }
    });
  } catch (error: any) {
    console.error('[API] Workspace GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const adapter = await getSqliteWorkspaceAdapter();
    
    await adapter.saveStore(data);
    
    return NextResponse.json({
      success: true,
      message: 'Workspace data saved successfully'
    });
  } catch (error: any) {
    console.error('[API] Workspace POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const adapter = await getSqliteWorkspaceAdapter();
    await adapter.clear();
    
    return NextResponse.json({
      success: true,
      message: 'Workspace data cleared successfully'
    });
  } catch (error: any) {
    console.error('[API] Workspace DELETE error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}