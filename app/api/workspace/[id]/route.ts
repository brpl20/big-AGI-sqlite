import { NextRequest, NextResponse } from 'next/server';

let sqliteWorkspaceAdapter: any = null;

async function getSqliteWorkspaceAdapter() {
  if (!sqliteWorkspaceAdapter) {
    const workspaceModule = await import('../../../../src/lib/db/sqlite-workspace-adapter');
    sqliteWorkspaceAdapter = workspaceModule.sqliteWorkspaceAdapter;
  }
  return sqliteWorkspaceAdapter;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: workspaceId } = await params;
    const adapter = await getSqliteWorkspaceAdapter();
    
    const files = await adapter.getWorkspaceFiles(workspaceId);
    
    return NextResponse.json({
      success: true,
      data: {
        workspaceId,
        files
      }
    });
  } catch (error: any) {
    console.error('[API] Workspace GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: workspaceId } = await params;
    const { operation, fileId, sourceWorkspaceId } = await request.json();
    const adapter = await getSqliteWorkspaceAdapter();
    
    switch (operation) {
      case 'assign':
        if (!fileId) {
          return NextResponse.json(
            { success: false, error: 'fileId is required for assign operation' },
            { status: 400 }
          );
        }
        await adapter.assignLiveFile(workspaceId, fileId);
        return NextResponse.json({
          success: true,
          message: `File ${fileId} assigned to workspace ${workspaceId}`
        });
        
      case 'unassign':
        if (!fileId) {
          return NextResponse.json(
            { success: false, error: 'fileId is required for unassign operation' },
            { status: 400 }
          );
        }
        await adapter.unassignLiveFile(workspaceId, fileId);
        return NextResponse.json({
          success: true,
          message: `File ${fileId} unassigned from workspace ${workspaceId}`
        });
        
      case 'copy':
        if (!sourceWorkspaceId) {
          return NextResponse.json(
            { success: false, error: 'sourceWorkspaceId is required for copy operation' },
            { status: 400 }
          );
        }
        await adapter.copyAssignments(sourceWorkspaceId, workspaceId);
        return NextResponse.json({
          success: true,
          message: `Assignments copied from ${sourceWorkspaceId} to ${workspaceId}`
        });
        
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid operation. Use: assign, unassign, or copy' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[API] Workspace POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: workspaceId } = await params;
    const adapter = await getSqliteWorkspaceAdapter();
    
    await adapter.removeWorkspace(workspaceId);
    
    return NextResponse.json({
      success: true,
      message: `Workspace ${workspaceId} removed successfully`
    });
  } catch (error: any) {
    console.error('[API] Workspace DELETE error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}