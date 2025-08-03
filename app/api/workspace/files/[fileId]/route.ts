import { NextRequest, NextResponse } from 'next/server';

let sqliteWorkspaceAdapter: any = null;

async function getSqliteWorkspaceAdapter() {
  if (!sqliteWorkspaceAdapter) {
    const workspaceModule = await import('../../../../../src/lib/db/sqlite-workspace-adapter');
    sqliteWorkspaceAdapter = workspaceModule.sqliteWorkspaceAdapter;
  }
  return sqliteWorkspaceAdapter;
}

interface RouteParams {
  params: Promise<{ fileId: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { fileId } = await params;
    const adapter = await getSqliteWorkspaceAdapter();
    
    await adapter.unassignLiveFileFromAll(fileId);
    
    return NextResponse.json({
      success: true,
      message: `File ${fileId} unassigned from all workspaces`
    });
  } catch (error: any) {
    console.error('[API] Workspace file DELETE error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}