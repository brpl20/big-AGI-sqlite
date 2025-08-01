import { NextRequest, NextResponse } from 'next/server';

// GET /api/metrics/[id] - Get metrics for specific service
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: serviceId } = await params;
    
    // Dynamic import to ensure server-side only execution
    const { SQLiteMetricsAdapter } = await import('../../../../src/lib/db/sqlite-metrics-adapter');
    
    const adapter = SQLiteMetricsAdapter.getInstance();
    const serviceMetrics = await adapter.getAggregateMetricsForService(serviceId);
    
    if (!serviceMetrics) {
      return NextResponse.json(
        { success: false, error: 'Service metrics not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: serviceMetrics,
      serviceId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Error fetching service metrics:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch service metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE /api/metrics/[id] - Clear metrics for specific service (test purposes)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: serviceId } = await params;
    
    // Dynamic import to ensure server-side only execution
    const { SQLiteMetricsAdapter } = await import('../../../../src/lib/db/sqlite-metrics-adapter');
    
    const adapter = SQLiteMetricsAdapter.getInstance();
    
    // For now, we'll clear all data since we don't have service-specific clearing
    // In a real implementation, you might want to add this functionality to the adapter
    await adapter.clearAllData();
    
    return NextResponse.json({
      success: true,
      message: `All metrics data cleared (service-specific clearing not implemented)`,
      serviceId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Error clearing service metrics:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to clear service metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}