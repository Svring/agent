import { NextRequest, NextResponse } from 'next/server';
import { propsManager } from '@/backstage/props-manager';
import fs from 'fs';
import path from 'path';
import * as toml from '@iarna/toml';

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
      case 'editFile':
        const filePath = body.filePath;
        const content = body.content;
        if (!filePath || content === undefined) {
          return NextResponse.json({ message: 'filePath and content are required for editFile action' }, { status: 400 });
        }
        const editResult = await propsManager.editRemoteFile(filePath, content);
        if (editResult.success) {
          console.log('File edit successful via API.');
          return NextResponse.json({ message: editResult.message }, { status: 200 });
        } else {
          console.log('File edit failed via API:', editResult.message);
          return NextResponse.json({ message: editResult.message }, { status: 500 });
        }
      case 'readFile':
        const readFilePath = body.filePath;
        if (!readFilePath) {
          return NextResponse.json({ message: 'filePath is required for readFile action' }, { status: 400 });
        }
        const readResult = await propsManager.readRemoteFile(readFilePath);
        if (readResult.success) {
          console.log('File read successful via API.');
          return NextResponse.json({ message: readResult.message, content: readResult.content }, { status: 200 });
        } else {
          console.log('File read failed via API:', readResult.message);
          return NextResponse.json({ message: readResult.message }, { status: 500 });
        }
      case 'disconnect':
        try {
          await propsManager.disconnectSSH();
          console.log('SSH Disconnection successful via API.');
          return NextResponse.json({ message: 'SSH disconnected successfully' }, { status: 200 });
        } catch (disconnectErr) {
          console.error('SSH Disconnection failed via API:', disconnectErr);
          return NextResponse.json({ message: `SSH Disconnection failed: ${disconnectErr instanceof Error ? disconnectErr.message : String(disconnectErr)}` }, { status: 500 });
        }
      case 'updateCredentials':
        const credentials = body.credentials;
        if (!credentials || typeof credentials !== 'object') {
          return NextResponse.json({ message: 'Credentials object is required for updateCredentials action' }, { status: 400 });
        }
        const updateResult = propsManager.updateSSHCredentials(credentials);
        if (updateResult.success) {
          // Save credentials to TOML file
          try {
            const configFilePath = path.join(process.cwd(), 'src', 'auth', 'props', 'credential.toml');
            let config: { ssh: { host: string; username: string; port: number; privateKeyPath: string } } = { ssh: { host: '', username: '', port: 22, privateKeyPath: '' } };
            if (fs.existsSync(configFilePath)) {
              const configData = fs.readFileSync(configFilePath, 'utf8');
              config = toml.parse(configData) as typeof config;
            }
            config.ssh.host = credentials.host || config.ssh.host;
            config.ssh.username = credentials.username || config.ssh.username;
            config.ssh.port = credentials.port || config.ssh.port;
            config.ssh.privateKeyPath = credentials.privateKeyPath || config.ssh.privateKeyPath;
            fs.writeFileSync(configFilePath, toml.stringify(config));
            console.log('SSH credentials saved to config file');
          } catch (error) {
            console.error('Failed to save credentials to config file:', error);
            return NextResponse.json({ message: 'Failed to save credentials to config file' }, { status: 500 });
          }
          console.log('SSH credentials updated successfully via API.');
          return NextResponse.json({ message: updateResult.message }, { status: 200 });
        } else {
          console.log('SSH credentials update failed via API:', updateResult.message);
          return NextResponse.json({ message: updateResult.message }, { status: 500 });
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

// GET handler to check status and CWD
export async function GET(req: NextRequest) {
  const status = propsManager.getStatus();
  const cwd = propsManager.getCurrentWorkingDirectory();
  const credentials = propsManager.getSSHCredentials();
  return NextResponse.json({
    status: status.connected ? 'Connected' : 'Disconnected',
    cwd: cwd,
    credentials: {
      host: credentials.host,
      username: credentials.username,
      port: credentials.port,
      privateKeyPath: credentials.privateKeyPath
    }
  });
}
