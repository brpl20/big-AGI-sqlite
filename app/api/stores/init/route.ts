import { NextRequest, NextResponse } from 'next/server';
import { getSQLiteDatabase } from '../../../../src/lib/db/sqlite';

export async function POST(request: NextRequest) {
  try {
    const db = getSQLiteDatabase();

    // Default stores to initialize
    const defaultStores = {
      'app-folders': {
        folders: [],
        enableFolders: false,
      },
      'app-ux-labs': {
        labsAttachScreenCapture: true,
        labsCameraDesktop: false,
        labsChatBarAlt: false,
        labsEnhanceCodeBlocks: true,
        labsEnhanceCodeLiveFile: false,
        labsHighPerformance: false,
        labsShowCost: true,
        labsAutoHideComposer: false,
        labsShowShortcutBar: true,
        labsDevMode: false,
        labsDevNoStreaming: false,
      },
      'app-ui': {
        preferredLanguage: 'auto',
        centerMode: 'narrow',
        complexityMode: 'pro',
        contentScaling: 'md',
        doubleClickToEdit: false,
        disableMarkdown: false,
        enterIsNewline: false,
        renderCodeLineNumbers: true,
        renderCodeSoftWrap: false,
        showPersonaFinder: false,
        composerQuickButton: 'beam',
        dismissals: {},
        actionCounters: {},
      },
      'app-device': {
        isDesktopCapable: true,
        hasNativeSharing: false,
        cameraPrefixes: [],
        microphonePrefixes: [],
      },
    };

    const initResults: { [key: string]: any } = {};

    // Initialize each store if it doesn't exist
    for (const [storeName, defaultData] of Object.entries(defaultStores)) {
      try {
        // Check if store already exists
        const existingStore = await db.getStore(storeName);

        if (existingStore === null) {
          // Store doesn't exist, create it
          await db.saveStore(storeName, defaultData, 1);
          initResults[storeName] = {
            status: 'created',
            data: defaultData,
          };
          console.log(`[SQLite Init] Created store: ${storeName}`);
        } else {
          // Store already exists
          initResults[storeName] = {
            status: 'exists',
            data: existingStore,
          };
          console.log(`[SQLite Init] Store already exists: ${storeName}`);
        }
      } catch (error) {
        console.error(`[SQLite Init] Error initializing store ${storeName}:`, error);
        initResults[storeName] = {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    // Count results
    const created = Object.values(initResults).filter((r) => r.status === 'created').length;
    const existing = Object.values(initResults).filter((r) => r.status === 'exists').length;
    const errors = Object.values(initResults).filter((r) => r.status === 'error').length;

    return NextResponse.json({
      success: true,
      message: `Store initialization complete: ${created} created, ${existing} existing, ${errors} errors`,
      summary: {
        created,
        existing,
        errors,
        total: Object.keys(defaultStores).length,
      },
      stores: initResults,
    });
  } catch (error) {
    console.error('[SQLite Init] Error during store initialization:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initialize stores',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const db = getSQLiteDatabase();

    // Get all existing stores
    const allStores = await db.getAllStores();

    // Check which required stores exist
    const requiredStores = ['app-folders', 'app-ux-labs', 'app-ui', 'app-device'];
    const existingStores = allStores.map((store) => store.name);
    const missingStores = requiredStores.filter((name) => !existingStores.includes(name));

    return NextResponse.json({
      success: true,
      initialized: missingStores.length === 0,
      summary: {
        total: allStores.length,
        required: requiredStores.length,
        missing: missingStores.length,
      },
      existingStores,
      missingStores,
      stores: allStores.map((store) => ({
        name: store.name,
        version: store.version,
        hasData: !!store.data,
        updatedAt: store.updated_at,
      })),
    });
  } catch (error) {
    console.error('[SQLite Init] Error checking store initialization:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check store initialization',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
