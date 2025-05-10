import { NextRequest, NextResponse } from 'next/server';
import { propsManager, SSHCredentials } from '@/backstage/props-manager';
import { getAuthenticatedUserId } from '@/lib/auth-utils';

export async function POST(req: NextRequest) {
  let body: any;
  let authenticatedUserId: string | null = null;
  let action: string | undefined = undefined;

  try {
    authenticatedUserId = await getAuthenticatedUserId(req.headers);
    body = await req.json();
    action = body.action;

    console.log(`[Props API] User [${authenticatedUserId || 'unknown'}] requested action: ${action}`);

    if (!authenticatedUserId) {
      return NextResponse.json({ message: 'Authentication required for this action.' }, { status: 401 });
    }

    switch (action) {
      case 'initialize':
        const { host, port, username, password, privateKeyPath } = body;
        if (!host || !username || (!password && !privateKeyPath)) {
          return NextResponse.json({ message: 'Host, username, and (password or privateKeyPath) are required for SSH initialization.' }, { status: 400 });
        }
        const credentialsToUse: SSHCredentials = { host, port, username, password, privateKeyPath };
        // Call to initializeSSH which now requires credentials
        const initResult = await propsManager.initializeSSH(authenticatedUserId, credentialsToUse);
        return NextResponse.json({ message: initResult.message, data: initResult.data }, { status: initResult.success ? 200 : 500 });

      case 'execute': {
        const command = body.command;
        if (!command) return NextResponse.json({ message: 'Command is required' }, { status: 400 });
        const execResult = await propsManager.executeCommand(authenticatedUserId, command);
        return NextResponse.json({
          message: execResult.message, stdout: execResult.stdout, stderr: execResult.stderr
        }, { status: execResult.success ? 200 : 500 });
      }

      case 'editFile': {
        const { filePath, content } = body;
        if (!filePath || content === undefined) return NextResponse.json({ message: 'filePath and content are required' }, { status: 400 });
        const editResult = await propsManager.editRemoteFile(authenticatedUserId, filePath, content);
        return NextResponse.json({ message: editResult.message }, { status: editResult.success ? 200 : 500 });
      }

      case 'readFile': {
        const { filePath } = body;
        if (!filePath) return NextResponse.json({ message: 'filePath is required' }, { status: 400 });
        const readResult = await propsManager.readRemoteFile(authenticatedUserId, filePath);
        return NextResponse.json({
          message: readResult.message, content: readResult.content
        }, { status: readResult.success ? 200 : 500 });
      }

      case 'disconnect': {
        propsManager.disconnectSSH(authenticatedUserId);
        return NextResponse.json({ message: `SSH session for user ${authenticatedUserId} disconnected` }, { status: 200 });
      }

      // case 'disconnectAll': { // This is an admin-level action, ideally role-protected.
      //   // For now, allow if any authenticated user calls it (though not ideal for production without role checks)
      //   propsManager.disconnectAllSessions();
      //   return NextResponse.json({ message: 'All user SSH sessions disconnected' }, { status: 200 });
      // }

      // updateDefaultSSHCredentials and updateModelProxyEnv handled above as global actions

      default:
        return NextResponse.json({ message: 'Invalid action specified' }, { status: 400 });
    }
  } catch (error) {
    console.error(`[Props API] User [${authenticatedUserId || 'unknown'}] Error for action [${action || 'unknown'}]:`, error);
    return NextResponse.json(
      { message: `Internal Server Error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  let authenticatedUserId: string | null = null;
  try {
    authenticatedUserId = await getAuthenticatedUserId(req.headers);

    if (authenticatedUserId) {
      // If a userId is available, return status for that user
      const userStatus = propsManager.getUserStatus(authenticatedUserId);
      const commandLog = propsManager.getCommandLog(authenticatedUserId);
      return NextResponse.json({
        userSpecific: true,
        status: userStatus.connected ? 'Connected' : 'Disconnected',
        cwd: userStatus.cwd,
        activeCredentials: userStatus.activeCredentials, // These are the credentials used for the current user's session
        commandLog: commandLog,
        // Default credentials are no longer managed by PropsManager .env loading for SSH.
        // SSH connections now require explicit credentials per user session initialization.
        // Model proxy env vars are still relevant if set globally.
        modelProxy: {
          baseUrl: process.env.SEALOS_USW_BASE_URL || 'Not Set',
          apiKeySet: !!process.env.SEALOS_USW_API_KEY // Just indicate if API key is set, not its value
        }
      });
    } else {
      // If no specific userId, return global manager status
      const managerStatus = propsManager.getManagerStatus();
      return NextResponse.json({
        userSpecific: false,
        activeUserSessions: managerStatus.activeUserSessions,
        // No default SSH credentials to report from the manager itself.
        // Application relies on user-provided credentials for each session init 
        // or credentials stored per user profile (if implemented).
        modelProxy: {
          baseUrl: process.env.SEALOS_USW_BASE_URL || 'Not Set',
          apiKeySet: !!process.env.SEALOS_USW_API_KEY
        }
      });
    }
  } catch (error) {
    console.error(`[Props API] User [${authenticatedUserId || 'unknown'}] Error during GET status:`, error);
    return NextResponse.json(
      { message: `Internal Server Error fetching status: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

