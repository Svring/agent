import { NextRequest, NextResponse } from 'next/server';
import { propsManager } from '@/backstage/props-manager';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action || 'initialize';
  
  console.log(`Received request for action: ${action}`);
  
  try {
    switch (action) {
      case 'initialize':
        const initResult = await propsManager.initializeSSH();
        if (initResult.success) {
          console.log('SSH Initialization successful via API.');
          return NextResponse.json({ message: initResult.message }, { status: 200 });
        } else {
          console.log('SSH Initialization failed via API:', initResult.message);
          return NextResponse.json({ message: initResult.message }, { status: 500 });
        }
      case 'execute':
        const command = body.command;
        if (!command) {
          return NextResponse.json({ message: 'Command is required for execute action' }, { status: 400 });
        }
        const execResult = await propsManager.executeCommand(command);
        if (execResult.success) {
          console.log('Command execution successful via API.');
          return NextResponse.json({ message: execResult.message, stdout: execResult.stdout, stderr: execResult.stderr }, { status: 200 });
        } else {
          console.log('Command execution failed via API:', execResult.message);
          return NextResponse.json({ message: execResult.message }, { status: 500 });
        }
      default:
        return NextResponse.json({ message: 'Invalid action specified' }, { status: 400 });
    }
  } catch (error) {
    console.error(`Unexpected error during ${action} via API:`, error);
    return NextResponse.json(
      { message: `Internal Server Error: ${error instanceof Error ? error.message : String(error)}` }, 
      { status: 500 } 
    );
  }
}

// GET handler to check status
export async function GET(req: NextRequest) {
  const status = propsManager.getStatus();
  return NextResponse.json({ status: status.connected ? 'Connected' : 'Disconnected' });
}
