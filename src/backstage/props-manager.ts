import { NodeSSH } from 'node-ssh';
import fs from 'fs';
import path from 'path';

interface CommandLogEntry {
  timestamp: Date;
  command: string;
  stdout?: string;
  stderr?: string;
  success: boolean;
}

export interface SSHCredentials {
  host?: string;
  port?: number;
  username?: string;
  password?: string; // Add password
  privateKeyPath?: string; // Keep privateKeyPath for fallback/env loading
}

// Describes the state for a single user's SSH session
interface UserSshSession {
  ssh: NodeSSH;
  isConnected: boolean;
  currentWorkingDirectory: string | null;
  commandLog: CommandLogEntry[];
  activeCredentials: SSHCredentials | null;
}

// Augment the NodeJS Global type to include our singleton
// For Next.js, it might be better to use a custom global type or check `globalThis`
declare global {
  var propsManagerInstance: PropsManager | undefined;
}

/**
 * Singleton class to manage SSH connections and actions for multiple users
 */
export class PropsManager {
  private static instance: PropsManager; // Standard instance for production
  // Map to hold user-specific SSH sessions
  private userSessions: Map<string, UserSshSession> = new Map();

  // Private constructor to enforce singleton pattern
  private constructor() {
    console.log("[PropsManager] Initialized. User-specific credentials required for SSH sessions.");
  }

  public static getInstance(): PropsManager {
    if (process.env.NODE_ENV === 'production') {
      if (!PropsManager.instance) {
        PropsManager.instance = new PropsManager();
      }
      return PropsManager.instance;
    } else {
      // In development, use the global object to preserve the instance across HMR
      if (!global.propsManagerInstance) {
        global.propsManagerInstance = new PropsManager();
      }
      return global.propsManagerInstance;
    }
  }
  
  // Helper to get or create a user session structure
  private getUserSession(userId: string): UserSshSession {
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, {
        ssh: new NodeSSH(),
        isConnected: false,
        currentWorkingDirectory: null,
        commandLog: [],
        activeCredentials: null,
      });
      console.log(`[PropsManager] New session structure created for user ${userId}`);
    }
    return this.userSessions.get(userId)!;
  }

  /**
   * Initialize SSH connection, optionally with specific credentials.
   * If credentials are provided, they override .env settings for this connection attempt.
   * Prioritizes password from credentials, falls back to privateKeyPath (either from credentials or .env).
   */
  public async initializeSSH(
    userId: string, 
    credentials: SSHCredentials
  ): Promise<{ success: boolean; message: string; data?: any }> {
    if (!userId) return { success: false, message: '[PropsManager] userId is required.' };
    if (!credentials) return { success: false, message: '[PropsManager] SSH credentials are required to initialize session.' };
    
    const session = this.getUserSession(userId);

    // Check if already connected with potentially different credentials
    if (session.isConnected && session.ssh.isConnected()) {
      const currentCreds = session.activeCredentials;
      const portOrDefault = credentials.port || 22;
      if (currentCreds && 
          currentCreds.host === credentials.host &&
          currentCreds.port === portOrDefault &&
          currentCreds.username === credentials.username &&
          // Check if new request uses password OR privateKey, and if it matches stored type
          ((credentials.password && currentCreds.password === credentials.password) || 
           (credentials.privateKeyPath && currentCreds.privateKeyPath === credentials.privateKeyPath && !currentCreds.password))) {
        console.log(`[PropsManager] SSH already connected for user ${userId} with matching credentials.`);
        return { success: true, message: 'Already connected with matching credentials', data: { cwd: session.currentWorkingDirectory, credentials: session.activeCredentials } };
      } else {
        console.log(`[PropsManager] User ${userId} is connected, but new/different credentials provided or existing ones unclear. Re-initializing.`);
        this.disconnectSSH(userId); // Disconnect existing before reconnecting with new/different credentials
      }
    }

    const { 
        host, 
        port = 22,
        username, 
        password, 
        privateKeyPath 
    } = credentials;

    console.log(`[PropsManager] Initializing SSH for user ${userId} with: host=${host}, port=${port}, username=${username}, usingPassword=${!!password}, pkPath=${privateKeyPath || 'none'}`);

    if (!host || !username || (!password && !privateKeyPath)) {
      session.activeCredentials = null; // Clear any potentially stale active credentials if input is insufficient
      session.isConnected = false;
      return { success: false, message: 'SSH connection details (host, username, and password/privateKeyPath) are required.' };
    }

    let privateKeyContent: string | undefined = undefined;
    if (!password && privateKeyPath) {
       if (!fs.existsSync(privateKeyPath)) {
         session.activeCredentials = null; session.isConnected = false;
         return { success: false, message: `Private key file not found: ${privateKeyPath}` };
       }
       try { privateKeyContent = fs.readFileSync(privateKeyPath, 'utf8'); }
       catch (readErr: any) { 
         session.activeCredentials = null; session.isConnected = false;
         return { success: false, message: `Failed to read PK: ${readErr.message || readErr}` }; 
       }
    }

    try {
      session.ssh = new NodeSSH(); // Ensure a fresh NodeSSH instance for each connect attempt
      await session.ssh.connect({ host, username, port, ...(password ? { password } : { privateKey: privateKeyContent }) });
      session.isConnected = true;
      // Store the type of credential used successfully
      session.activeCredentials = { host, port, username, ...(password ? { password } : { privateKeyPath }) };
      console.log(`[PropsManager] SSH Connected for user ${userId}! Host: ${host}`);
      try {
        const pwdResult = await session.ssh.execCommand('pwd');
        session.currentWorkingDirectory = pwdResult.stdout?.trim() || null;
      } catch (pwdErr) { 
        console.warn(`[PropsManager] User ${userId}: Failed to get CWD after connect.`, pwdErr);
        session.currentWorkingDirectory = null; 
      }
      console.log(`[PropsManager] User ${userId} CWD: ${session.currentWorkingDirectory}`);
      return { success: true, message: 'SSH connection successful', data: { cwd: session.currentWorkingDirectory, activeCredentials: session.activeCredentials } };
    } catch (err: any) { // Catch any error from connect or pwd
      console.error(`[PropsManager] SSH Connection or initial CWD failed for ${userId} to ${host}:`, err);
      session.isConnected = false; 
      session.activeCredentials = null; // Crucial: clear active credentials on any failure
      session.ssh.dispose(); // Dispose of the NodeSSH instance on failure
      return { success: false, message: `SSH Connection for ${userId} to ${host} failed: ${err.message || err}` };
    }
  }

  public getSSHClient(userId: string): NodeSSH | null {
    if (!userId) return null;
    const session = this.userSessions.get(userId);
    return session && session.isConnected && session.ssh.isConnected() ? session.ssh : null;
  }

  public disconnectSSH(userId: string): void {
    if (!userId) return;
    const session = this.userSessions.get(userId);
    if (session && session.ssh.isConnected()) {
      console.log(`[PropsManager] Disconnecting SSH for user ${userId}...`);
      session.ssh.dispose();
      session.isConnected = false;
      session.currentWorkingDirectory = null;
      session.activeCredentials = null; // Clear active credentials for this session
      // Optionally remove the session from the map if it's meant to be transient
      // this.userSessions.delete(userId);
    }
  }
  
  public disconnectAllSessions(): void {
    console.log("[PropsManager] Disconnecting all active SSH sessions...");
    this.userSessions.forEach((session, userId) => {
      if (session.ssh.isConnected()) {
        session.ssh.dispose();
        console.log(`[PropsManager] Disconnected SSH for user ${userId}.`);
      }
    });
    this.userSessions.clear();
    console.log("[PropsManager] All user SSH sessions cleared.");
  }

  public getCommandLog(userId: string): CommandLogEntry[] {
    if (!userId) return [];
    const session = this.userSessions.get(userId);
    return session ? [...session.commandLog] : []; 
  }

  public isSSHConnected(userId: string): boolean {
    if (!userId) return false;
    const session = this.userSessions.get(userId);
    return !!session && session.isConnected && session.ssh.isConnected();
  }

  public getCurrentWorkingDirectory(userId: string): string | null {
    if (!userId) return null;
    const session = this.userSessions.get(userId);
    return session ? session.currentWorkingDirectory : null;
  }

  /**
   * Update model proxy environment variables in .env
   */
  public updateModelProxyEnv(proxy: { baseUrl?: string; apiKey?: string }): { success: boolean; message: string } {
    try {
      const envPath = path.join(process.cwd(), '.env');
      let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
      const envLines = envContent.split(/\r?\n/);
      const envMap: Record<string, string> = {};
      envLines.forEach(line => { const m = line.match(/^([^=]+)=(.*)$/); if (m) envMap[m[1]] = m[2]; });
      if (proxy.baseUrl) envMap['SEALOS_USW_BASE_URL'] = proxy.baseUrl;
      if (proxy.apiKey) envMap['SEALOS_USW_API_KEY'] = proxy.apiKey;
      const newEnvContent = Object.entries(envMap).map(([k, v]) => `${k}=${v}`).join('\n');
      fs.writeFileSync(envPath, newEnvContent);
      return { success: true, message: 'Model proxy env updated and persisted to .env file.' };
    } catch (err) {
      console.error('Failed to persist model proxy env to .env:', err);
      return { success: false, message: 'Failed to persist model proxy env to .env file.' };
    }
  }

  // Status for a specific user
  public getUserStatus(userId: string): { connected: boolean, cwd: string | null, activeCredentials: SSHCredentials | null } {
    if (!userId) return { connected: false, cwd: null, activeCredentials: null };
    const session = this.userSessions.get(userId);
    if (!session) {
        return { connected: false, cwd: null, activeCredentials: null };
    }
    return {
        connected: session.isConnected && session.ssh.isConnected(),
        cwd: session.currentWorkingDirectory,
        activeCredentials: session.activeCredentials ? { 
            host: session.activeCredentials.host,
            port: session.activeCredentials.port,
            username: session.activeCredentials.username,
            privateKeyPath: session.activeCredentials.privateKeyPath
        } : null
    };
  }
  
  // Overall status of the manager
  public getManagerStatus(): { activeUserSessions: number } {
    let activeCount = 0;
    this.userSessions.forEach(session => {
      if (session.isConnected && session.ssh.isConnected()) activeCount++;
    });
    return { activeUserSessions: activeCount };
  }

  private async _tryReconnect(userId: string, session: UserSshSession): Promise<boolean> {
    if (session.activeCredentials) {
      console.log(`[PropsManager] User ${userId}: SSH connection seems down. Attempting to re-establish with stored credentials.`);
      // Pass a copy of credentials to ensure no modification issues if any
      const credsToRetry = { ...session.activeCredentials };
      const result = await this.initializeSSH(userId, credsToRetry); 
      // initializeSSH handles setting isConnected and activeCredentials internally, including clearing on failure.
      if (result.success) {
        console.log(`[PropsManager] User ${userId}: Reconnection successful.`);
        return true;
      }
      console.warn(`[PropsManager] User ${userId}: Reconnection failed: ${result.message}`);
      return false;
    }
    console.log(`[PropsManager] User ${userId}: No stored credentials to attempt auto-reconnection.`);
    return false;
  }

  /**
   * Execute a command over SSH, maintaining CWD state
   */
  public async executeCommand(userId: string, command: string): Promise<{ success: boolean; message: string; stdout?: string; stderr?: string }> {
    if (!userId) return { success: false, message: '[PropsManager] userId is required.', stdout: '', stderr: 'userId is required.' };
    const session = this.getUserSession(userId);
    let connectionReady = false;
    const hadStoredCredentials = !!session.activeCredentials; // Check if we ever had credentials for this session

    if (session.isConnected && session.ssh.isConnected()) {
      connectionReady = true;
    } else {
      console.log(`[PropsManager] User ${userId} command '${command}': Not connected or SSH object reports disconnected. session.isConnected: ${session.isConnected}, session.ssh.isConnected(): ${session.ssh?.isConnected() ?? 'N/A'}`);
      if (hadStoredCredentials) { // Only try to reconnect if we previously had success with some credentials
        connectionReady = await this._tryReconnect(userId, session);
      }
    }

    if (!connectionReady) {
      const errorMessage = hadStoredCredentials
                       ? 'SSH re-connection attempt failed. Please check credentials or server, then try connecting again via UI.'
                       : 'SSH not connected. Please initialize connection first via UI.';
      // Do not log command here as it might contain sensitive info & we didn't execute
      console.warn(`[PropsManager] User ${userId}: Command '${command.split(' ')[0]}...' execution aborted. ${errorMessage}`);
      return { success: false, message: errorMessage, stdout: '', stderr: errorMessage };
    }

    const trimmedCommand = command.trim();
    let cmdResult: { success: boolean; message: string; stdout?: string; stderr?: string };
    try {
      if (trimmedCommand.startsWith('cd ') || trimmedCommand === 'cd') {
        const cdExec = await session.ssh.execCommand(`${trimmedCommand} && pwd`, { cwd: session.currentWorkingDirectory || undefined });
        if (cdExec.stderr) {
          cmdResult = { success: false, message: `Failed to change directory: ${cdExec.stderr}`, stdout: cdExec.stdout, stderr: cdExec.stderr };
        } else {
          session.currentWorkingDirectory = cdExec.stdout.trim().split('\n').pop() || null;
          cmdResult = { success: true, message: `CWD updated to: ${session.currentWorkingDirectory}`, stdout: cdExec.stdout, stderr: '' };
        }
      } else {
        const execResult = await session.ssh.execCommand(trimmedCommand, { cwd: session.currentWorkingDirectory || undefined });
        const success = !execResult.stderr || execResult.stderr.trim().length === 0;
        cmdResult = { success, message: success ? 'Command executed successfully' : 'Command executed with stderr', stdout: execResult.stdout, stderr: execResult.stderr };
      }
    } catch (err: any) {
      console.error(`[PropsManager] User ${userId}: Command execution failed for '${trimmedCommand}':`, err);
      // If command execution itself fails, the connection might still be alive but command errored.
      // We could check session.ssh.isConnected() again here, if it's now false, it implies command caused disconnect.
      if (!session.ssh.isConnected()) {
        session.isConnected = false; // Update our flag too
        console.warn(`[PropsManager] User ${userId}: SSH connection appears to have dropped during command execution.`);
        // Do not clear activeCredentials here, as a reconnect might be possible later.
      }
      cmdResult = { success: false, message: `Command execution failed: ${err.message || err}`, stdout: '', stderr: `${err.message || err}` };
    }
    // Log command after execution attempt
    await this.logCommand(userId, trimmedCommand, cmdResult.stdout, cmdResult.stderr, cmdResult.success);
    return cmdResult;
  }

  /**
   * Log command execution details
   */
  private async logCommand(userId: string, command: string, stdout: string | undefined, stderr: string | undefined, success: boolean): Promise<void> {
    const session = this.getUserSession(userId);
    const timestamp = new Date();
    session.commandLog.push({ timestamp, command, stdout, stderr, success });
    const logFileName = 'command.log';
    const fileLogEntry = 
      `[${timestamp.toISOString()}] User: ${userId} ${success ? '✅' : '❌'} CMD: ${command}\n` +
      `${stdout ? `[${timestamp.toISOString()}] STDOUT: ${stdout}\n` : ''}` +
      `${stderr ? `[${timestamp.toISOString()}] STDERR: ${stderr}\n` : ''}`;
    if (session.isConnected && session.ssh.isConnected()) {
      try {
        await session.ssh.exec(`tee -a ${logFileName}`, [], { 
            cwd: session.currentWorkingDirectory || undefined, 
            stdin: fileLogEntry, 
            stream: 'stderr' 
        });
      } catch (err) { console.error(`[PropsManager] User ${userId}: Error appending to remote log:`, err); }
    } else {
      console.warn(`[PropsManager] User ${userId}: SSH not connected, cannot append to remote log.`);
    }
  }

  public async editRemoteFile(userId: string, filePath: string, content: string): Promise<{ success: boolean; message: string }> {
    if (!userId) return { success: false, message: '[PropsManager] userId is required.' };
    const session = this.getUserSession(userId);
    if (!session.isConnected || !session.ssh.isConnected()) {
      return { success: false, message: 'SSH not connected.' };
    }
    try {
      const escapedFilePath = filePath.replace(/'/g, "'\\''");
      const cmdResult = await session.ssh.exec(`cat > '${escapedFilePath}'`, [], {
        cwd: session.currentWorkingDirectory || undefined,
        stdin: content,
        stream: 'stderr' 
      });
      if (cmdResult && cmdResult.trim().length > 0) { // Check if stderr from tee has content
        throw new Error(cmdResult); // cmdResult here is stderr content
      }
      return { success: true, message: `File ${filePath} updated for user ${userId}` };
    } catch (err) {
      return { success: false, message: `File edit failed for ${userId}: ${err}` };
    }
  }

  public async readRemoteFile(userId: string, filePath: string): Promise<{ success: boolean; message: string; content?: string }> {
    if (!userId) return { success: false, message: '[PropsManager] userId is required.' };
    const session = this.getUserSession(userId);
    if (!session.isConnected || !session.ssh.isConnected()) {
      return { success: false, message: 'SSH not connected.' };
    }
    try {
      const result = await session.ssh.execCommand(`cat ${filePath}`, { cwd: session.currentWorkingDirectory || undefined });
      if (result.stderr) throw new Error(result.stderr);
      return { success: true, message: `File ${filePath} read for user ${userId}`, content: result.stdout };
    } catch (err) {
      return { success: false, message: `File read failed for ${userId}: ${err}` };
    }
  }
}

// Singleton instance, now HMR-safe
export const propsManager = PropsManager.getInstance();

// Ensure cleanup on process exit
process.on('exit', () => propsManager.disconnectAllSessions());
process.on('SIGINT', () => { propsManager.disconnectAllSessions(); process.exit(0); });
process.on('SIGTERM', () => { propsManager.disconnectAllSessions(); process.exit(0); });

// Do not automatically connect when module loads
// connectToServer(); 
