import { NextRequest, NextResponse } from 'next/server';
import { indexManager } from '@/backstage/index-manager';

// GET handler to check status and Qdrant URL
export async function GET(req: NextRequest) {
  try {
    const status = indexManager.getStatus();
    console.log('API GET /api/index: Returning status:', status);
    return NextResponse.json({
      status: status.connected ? 'Connected' : 'Disconnected',
      url: status.url,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('API GET /api/index: Error getting status:', errorMessage);
    return NextResponse.json(
      { message: `Internal Server Error: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// POST handler for actions like testing connection
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action;
    console.log(`API POST /api/index: Received action: ${action}`);

    switch (action) {
      case 'testConnection':
        const result = await indexManager.testConnection();
        if (result.success) {
          console.log('API POST /api/index: Test connection successful.');
          return NextResponse.json({ 
            message: result.message, 
            collections: result.collections 
          }, { status: 200 });
        } else {
          console.error('API POST /api/index: Test connection failed:', result.message);
          return NextResponse.json({ message: result.message }, { status: 500 });
        }
      // Add other actions here as needed (e.g., createCollection, addPoints, search)
      
      default:
        console.log(`API POST /api/index: Invalid action specified: ${action}`);
        return NextResponse.json({ message: 'Invalid action specified' }, { status: 400 });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`API POST /api/index: Error during action processing:`, error);
    return NextResponse.json(
      { message: `Internal Server Error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
