import { NextRequest, NextResponse } from 'next/server';
import { propsManager } from '@/backstage/props-manager';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action;
  
  console.log(`Received request for action: ${action}`);
  
  try {
    switch (action) {
      case 'initialize':
        const { host, port, username, password } = body; 
        let credentials;
        if (host && username) {
            credentials = { host, port, username, password };
            console.log('API: Initialize action called with specific credentials.');
        } else {
            console.log('API: Initialize action called without specific credentials (using defaults).');
        }
        
        const initResult = await propsManager.initializeSSH(credentials); 
        
        if (initResult.success) {
          console.log('SSH Initialization successful via API.');
          return NextResponse.json({ message: initResult.message }, { status: 200 });
        } else {
          console.log('SSH Initialization failed via API:', initResult.message);
          return NextResponse.json({ message: initResult.message }, { status: 500 });
        }
      case 'execute': {
        const command = body.command;
        if (!command) {
          return NextResponse.json({ message: 'Command is required for execute action' }, { status: 400 });
        }
        const execResult = await propsManager.executeCommand(command);
        return NextResponse.json({ 
            message: execResult.message, 
            stdout: execResult.stdout, 
            stderr: execResult.stderr 
        }, { status: execResult.success ? 200 : 500 });
      }
      case 'editFile': {
        const { filePath, content } = body;
        if (!filePath || content === undefined) {
          return NextResponse.json({ message: 'filePath and content are required for editFile action' }, { status: 400 });
        }
        const editResult = await propsManager.editRemoteFile(filePath, content);
        return NextResponse.json({ message: editResult.message }, { status: editResult.success ? 200 : 500 });
      }
      case 'readFile': {
        const { filePath } = body;
        if (!filePath) {
          return NextResponse.json({ message: 'filePath is required for readFile action' }, { status: 400 });
        }
        const readResult = await propsManager.readRemoteFile(filePath);
        return NextResponse.json({ 
            message: readResult.message, 
            content: readResult.content 
        }, { status: readResult.success ? 200 : 500 });
      }
      case 'disconnect': {
        try {
          propsManager.disconnectSSH();
          console.log('SSH Disconnection successful via API.');
          return NextResponse.json({ message: 'SSH disconnected successfully' }, { status: 200 });
        } catch (disconnectErr) {
          console.error('SSH Disconnection failed via API:', disconnectErr);
          return NextResponse.json({ message: `SSH Disconnection failed: ${disconnectErr instanceof Error ? disconnectErr.message : String(disconnectErr)}` }, { status: 500 });
        }
      }
      case 'updateCredentials': {
        const creds = body.credentials;
        if (!creds || typeof creds !== 'object') {
          return NextResponse.json({ message: 'Credentials object is required for updateCredentials action' }, { status: 400 });
        }
        const updateResult = propsManager.updateSSHCredentials(creds);
        return NextResponse.json({ message: updateResult.message }, { status: updateResult.success ? 200 : 500 });
      }
      case 'updateModelProxyEnv': {
        const proxy = body.proxy;
        if (!proxy || typeof proxy !== 'object') {
          return NextResponse.json({ message: 'Proxy object is required for updateModelProxyEnv action' }, { status: 400 });
        }
        const proxyResult = propsManager.updateModelProxyEnv(proxy);
        return NextResponse.json({ message: proxyResult.message }, { status: proxyResult.success ? 200 : 500 });
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

export async function GET(req: NextRequest) {
  const status = propsManager.getStatus();
  const cwd = propsManager.getCurrentWorkingDirectory();
  const credentials = propsManager.getSSHCredentials();
  const commandLog = propsManager.getCommandLog();

  return NextResponse.json({
    status: status.connected ? 'Connected' : 'Disconnected',
    cwd: cwd,
    credentials: {
      host: credentials.host,
      username: credentials.username,
      port: credentials.port,
      privateKeyPath: credentials.privateKeyPath
    },
    modelProxy: {
      baseUrl: process.env.SEALOS_USW_BASE_URL || '',
      apiKey: process.env.SEALOS_USW_API_KEY || ''
    },
    commandLog: commandLog
  });
}