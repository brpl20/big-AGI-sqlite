import { NextRequest, NextResponse } from 'next/server';
import { getSQLiteDatabase } from '../../../../src/lib/db/sqlite';

export async function GET(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    const db = getSQLiteDatabase();
    const storeData = await db.getStore(name);

    if (storeData === null) {
      return NextResponse.json(
        {
          success: false,
          error: `Store '${name}' not found`,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      name,
      data: storeData,
    });
  } catch (error) {
    console.error('Error fetching store:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch store',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    const body = await request.json();
    const { data, version } = body;

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: 'Store data is required',
        },
        { status: 400 },
      );
    }

    const db = getSQLiteDatabase();
    await db.saveStore(name, data, version);

    return NextResponse.json({
      success: true,
      message: `Store '${name}' updated successfully`,
    });
  } catch (error) {
    console.error('Error updating store:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update store',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    const db = getSQLiteDatabase();

    // Check if store exists first
    const existingStore = await db.getStore(name);
    if (existingStore === null) {
      return NextResponse.json(
        {
          success: false,
          error: `Store '${name}' not found`,
        },
        { status: 404 },
      );
    }

    await db.deleteStore(name);

    return NextResponse.json({
      success: true,
      message: `Store '${name}' deleted successfully`,
    });
  } catch (error) {
    console.error('Error deleting store:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete store',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
