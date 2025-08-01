import { NextRequest, NextResponse } from 'next/server';
import { getSQLiteDatabase } from '../../../src/lib/db/sqlite';

export async function GET() {
  try {
    const db = getSQLiteDatabase();
    const stores = await db.getAllStores();

    return NextResponse.json({
      success: true,
      stores,
    });
  } catch (error) {
    console.error('Error fetching stores:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch stores',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, data, version } = body;

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error: 'Store name is required',
        },
        { status: 400 },
      );
    }

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
      message: `Store '${name}' saved successfully`,
    });
  } catch (error) {
    console.error('Error saving store:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save store',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
