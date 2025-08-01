import { NextRequest, NextResponse } from 'next/server';

// GET /api/metrics - List all service metrics
export async function GET() {
  try {
    // Dynamic import to ensure server-side only execution
    const { SQLiteMetricsAdapter } = await import('../../../src/lib/db/sqlite-metrics-adapter');
    
    const adapter = SQLiteMetricsAdapter.getInstance();
    const serviceMetrics = await adapter.getAllServiceMetrics();
    
    return NextResponse.json({
      success: true,
      data: { serviceMetrics },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Error fetching metrics:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/metrics - Add new metrics entry or bulk operations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Dynamic import to ensure server-side only execution
    const { SQLiteMetricsAdapter } = await import('../../../src/lib/db/sqlite-metrics-adapter');
    
    const adapter = SQLiteMetricsAdapter.getInstance();
    
    // Handle different operations
    if (body.operation === 'addCostEntry') {
      const { costs, inputTokens, outputTokens, serviceId, debugCostSource } = body;
      
      if (!serviceId) {
        return NextResponse.json(
          { success: false, error: 'Service ID is required' },
          { status: 400 }
        );
      }
      
      await adapter.addChatGenerateCostEntry(costs, inputTokens, outputTokens, serviceId, debugCostSource);
      
      return NextResponse.json({
        success: true,
        message: 'Cost entry added successfully',
        timestamp: new Date().toISOString(),
      });
    } else if (body.operation === 'saveStore') {
      const { data } = body;
      
      if (!data) {
        return NextResponse.json(
          { success: false, error: 'Store data is required' },
          { status: 400 }
        );
      }
      
      await adapter.saveStoreData(data);
      
      return NextResponse.json({
        success: true,
        message: 'Store data saved successfully',
        timestamp: new Date().toISOString(),
      });
    } else if (body.operation === 'clear') {
      await adapter.clearAllData();
      
      return NextResponse.json({
        success: true,
        message: 'All metrics data cleared',
        timestamp: new Date().toISOString(),
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid operation' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[API] Error processing metrics operation:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process metrics operation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}