import { NodeSSH, SSHExecCommandOptions } from 'node-ssh';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

interface CommandLogEntry {
  timestamp: Date;
  command: string;
  stdout?: string;
  stderr?: string;
  success: boolean;
}

interface SSHCredentials {
  host?: string;
  port?: number;
  username?: string;
  password?: string; // Add password
  privateKeyPath?: string; // Keep privateKeyPath for fallback/env loading
}

/**
 * Singleton class to manage SSH connections and actions
 */
export class PropsManager {
  private static instance: PropsManager;
  private ssh: NodeSSH;
  private isConnected: boolean = false;
  private privateKeyPath: string = '';
  private currentWorkingDirectory: string | null = null;
  private host: string = '';
  private username: string = '';
  private port: number = 22;
  private commandLog: CommandLogEntry[] = []; // Array to store command logs
  private currentPassword?: string; // Store password temporarily if used for connection

  public constructor() {
    this.ssh = new NodeSSH();
    this.loadCredentialsFromEnv();
  }

  /**
   * Load SSH credentials from .env file
   */
  private loadCredentialsFromEnv(): void {
    this.host = process.env.SSH_HOST || '';
    this.username = process.env.SSH_USERNAME || '';
    this.port = process.env.SSH_PORT ? parseInt(process.env.SSH_PORT, 10) : 22;
    this.privateKeyPath = process.env.SSH_PRIVATE_KEY_PATH || '';
    this.currentPassword = undefined; // Reset password when loading from env
    console.log('SSH credentials loaded from .env');
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): PropsManager {
    if (!PropsManager.instance) {
      PropsManager.instance = new PropsManager();
    }
    return PropsManager.instance;
  }

  /**
   * Update SSH credentials (in-memory only, as .env cannot be written at runtime)
   */
  public updateSSHCredentials(credentials: { host?: string; username?: string; port?: number; privateKeyPath?: string }): { success: boolean; message: string } {
    if (credentials.host) this.host = credentials.host;
    if (credentials.username) this.username = credentials.username;
    if (credentials.port) this.port = credentials.port;
    if (credentials.privateKeyPath) this.privateKeyPath = credentials.privateKeyPath;
    // If we're already connected, disconnect to reconnect with new credentials
    if (this.isConnected && this.ssh.isConnected()) {
      this.disconnectSSH();
      console.log('Disconnected existing SSH connection to apply new credentials.');
    }
    // Persist to .env file
    try {
      const envPath = path.join(process.cwd(), '.env');
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }
      const envLines = envContent.split(/\r?\n/);
      const envMap: Record<string, string> = {};
      for (const line of envLines) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (match) {
          envMap[match[1]] = match[2];
        }
      }
      if (this.host) envMap['SSH_HOST'] = this.host;
      if (this.username) envMap['SSH_USERNAME'] = this.username;
      if (this.port) envMap['SSH_PORT'] = String(this.port);
      if (this.privateKeyPath) envMap['SSH_PRIVATE_KEY_PATH'] = this.privateKeyPath;
      // Rebuild .env content
      const allKeys = new Set([...Object.keys(envMap), 'SSH_HOST', 'SSH_USERNAME', 'SSH_PORT', 'SSH_PRIVATE_KEY_PATH']);
      const newLines: string[] = [];
      for (const key of allKeys) {
        if (envMap[key] !== undefined) {
          newLines.push(`${key}=${envMap[key]}`);
        }
      }
      fs.writeFileSync(envPath, newLines.join('\n'));
    } catch (err) {
      console.error('Failed to persist SSH credentials to .env:', err);
      return { success: false, message: 'Failed to persist SSH credentials to .env file.' };
    }
    return { success: true, message: 'SSH credentials (excluding password) updated and persisted to .env file.' };
  }

  /**
   * Get current SSH credentials
   */
  public getSSHCredentials(): { host: string; username: string; port: number; privateKeyPath: string } {
    return {
      host: this.host,
      username: this.username,
      port: this.port,
      privateKeyPath: this.privateKeyPath
    };
  }

  /**
   * Initialize SSH connection, optionally with specific credentials.
   * If credentials are provided, they override .env settings for this connection attempt.
   * Prioritizes password from credentials, falls back to privateKeyPath (either from credentials or .env).
   */
  public async initializeSSH(credentials?: SSHCredentials): Promise<{ success: boolean; message: string; data?: any }> {
    if (this.isConnected && this.ssh.isConnected()) {
      console.log('SSH already connected.');
      return { success: true, message: 'Already connected' };
    }

    // Determine connection details
    const useCreds = credentials && credentials.host && credentials.username;
    const host = useCreds ? credentials.host! : this.host;
    const username = useCreds ? credentials.username! : this.username;
    const port = useCreds ? credentials.port || 22 : this.port;
    const password = useCreds ? credentials.password : undefined;
    const privateKeyPath = useCreds
       ? credentials.privateKeyPath || (password ? undefined : this.privateKeyPath)
       : this.privateKeyPath;

    console.log(`Initializing SSH with: host=${host}, port=${port}, username=${username}, usingPassword=${!!password}, privateKeyPath=${privateKeyPath || 'none'}`);

    // Check if connection parameters are sufficient
    if (!host || !username || (!password && !privateKeyPath)) {
      const errorMsg = 'SSH connection details (host, username, and password/privateKeyPath) are missing or incomplete.';
      console.error(`❌ ${errorMsg}`);
      return { success: false, message: errorMsg };
    }

    let privateKeyContent: string | undefined = undefined;
    if (!password && privateKeyPath) {
       if (!fs.existsSync(privateKeyPath)) {
         const errorMsg = `Private key file not found at: ${privateKeyPath}`;
         console.error(`❌ ${errorMsg}`);
         return { success: false, message: errorMsg };
       }
       try {
         privateKeyContent = fs.readFileSync(privateKeyPath, 'utf8');
       } catch (readErr) {
         const errorMsg = `Failed to read private key file: ${privateKeyPath}`;
         console.error(`❌ ${errorMsg}`, readErr);
         return { success: false, message: `${errorMsg}: ${readErr instanceof Error ? readErr.message : String(readErr)}` };
       }
    } else if (!password && !privateKeyPath) {
        return { success: false, message: 'No password or private key path available for authentication.' };
    }

    try {
      console.log(`Attempting SSH connection to ${host}:${port}...`);
      await this.ssh.connect({
        host: host,
        username: username,
        port: port,
        ...(password ? { password: password } : { privateKey: privateKeyContent }), // Use password OR privateKey
      });
      this.isConnected = true;
      // Store details used for this successful connection temporarily
      this.host = host;
      this.username = username;
      this.port = port;
      this.currentPassword = password;
      this.privateKeyPath = password ? '' : privateKeyPath || ''; 

      console.log('✅ SSH Connected!');

      // Get initial working directory
      try {
        const pwdResult = await this.ssh.execCommand('pwd');
        if (pwdResult.stdout && !pwdResult.stderr) {
          const cleanedCwd = pwdResult.stdout.split('\n').filter(line => line.trim().length > 0)[0]?.trim();
          this.currentWorkingDirectory = cleanedCwd || null;
          console.log(`Initial working directory set to: ${this.currentWorkingDirectory}`);
        } else {
          console.warn(`Could not determine initial working directory. stderr: ${pwdResult.stderr}`);
          this.currentWorkingDirectory = null;
        }
      } catch (pwdErr) {
        console.error('❌ Failed to get initial working directory:', pwdErr);
        this.currentWorkingDirectory = null;
      }
      return { success: true, message: 'SSH connection successful' };
    } catch (err) {
      this.isConnected = false;
      this.currentWorkingDirectory = null;
      const errorMsg = `SSH Connection failed`;
      console.error(`❌ ${errorMsg}:`, err);
      return { success: false, message: `${errorMsg}: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  /**
   * Get the SSH client instance
   */
  public getSSHClient(): NodeSSH | null {
    return this.isConnected && this.ssh.isConnected() ? this.ssh : null;
  }

  /**
   * Disconnect SSH connection
   */
  public disconnectSSH(): void {
    if (this.ssh.isConnected()) {
      console.log('Disconnecting SSH connection...');
      this.ssh.dispose();
      this.isConnected = false;
      this.currentWorkingDirectory = null;
      this.currentPassword = undefined; // Clear temp password on disconnect
      // Optionally reload from .env here 
      // this.loadCredentialsFromEnv(); 
    }
  }

  /**
   * Execute a command over SSH, maintaining CWD state
   */
  public async executeCommand(command: string): Promise<{ success: boolean; message: string; stdout?: string; stderr?: string }> {
    if (!this.isConnected || !this.ssh.isConnected()) {
      // Log attempt even if not connected
      this.logCommand(command, undefined, 'SSH not connected', false);
      return { success: false, message: 'SSH not connected. Please initialize connection first.' };
    }

    // Trim the command
    const trimmedCommand = command.trim();
    let result: { success: boolean; message: string; stdout?: string; stderr?: string };

    try {
      // Check if it's a cd command
      if (trimmedCommand.startsWith('cd ') || trimmedCommand === 'cd') {
        // Execute cd and then pwd to update the stored CWD
        // Handle 'cd' without arguments (goes to home)
        const cdCommand = trimmedCommand === 'cd' ? 'cd && pwd' : `${trimmedCommand} && pwd`;
        console.log(`Executing cd command: ${cdCommand} in ${this.currentWorkingDirectory || 'default directory'}`);
        const cdResult = await this.ssh.execCommand(cdCommand, { cwd: this.currentWorkingDirectory || undefined });

        if (cdResult.stderr) {
          console.error(`cd command stderr: ${cdResult.stderr}`);
          // cd failed, CWD remains unchanged
          result = {
            success: false,
            message: `Failed to change directory: ${cdResult.stderr}`,
            stderr: cdResult.stderr
          };
        } else {
          // cd succeeded, update CWD
          // Clean the stdout to ensure it's a single line path
          const lines = cdResult.stdout.split('\n').filter(line => line.trim().length > 0);
          const cleanedCwd = lines[lines.length - 1]?.trim();
          this.currentWorkingDirectory = cleanedCwd || null;
          console.log(`Working directory changed to: ${this.currentWorkingDirectory}`);
          result = {
            success: true,
            message: `Working directory changed to ${this.currentWorkingDirectory || 'unknown'}`,
            stdout: '', // No stdout from the original cd command itself
            stderr: ''
          };
        }
      } else {
        // Execute other commands in the current working directory
        console.log(`Executing command: ${trimmedCommand} in ${this.currentWorkingDirectory || 'default directory'}`);
        const execResult = await this.ssh.execCommand(trimmedCommand, { cwd: this.currentWorkingDirectory || undefined });
        console.log(`Command executed. Stdout length: ${execResult.stdout.length}, Stderr length: ${execResult.stderr.length}`);
        // Determine success based on stderr for simplicity here (could be refined)
        const success = !execResult.stderr || execResult.stderr.trim().length === 0;
        result = {
          success: success,
          message: success ? 'Command executed successfully' : 'Command executed with errors/output on stderr',
          stdout: execResult.stdout,
          stderr: execResult.stderr
        };
      }
    } catch (err) {
      const errorMsg = `Failed to execute command: ${command}`;
      console.error(`❌ ${errorMsg}:`, err);
      result = {
        success: false,
        message: `${errorMsg}: ${err instanceof Error ? err.message : String(err)}`,
        stderr: err instanceof Error ? err.message : String(err)
      };
    }

    // Log the command result
    this.logCommand(trimmedCommand, result.stdout, result.stderr, result.success);
    return result;
  }

  /**
   * Log command execution details
   */
  private async logCommand(command: string, stdout: string | undefined, stderr: string | undefined, success: boolean): Promise<void> {
    const timestamp = new Date();
    const logEntry: CommandLogEntry = {
      timestamp,
      command,
      stdout,
      stderr,
      success
    };
    this.commandLog.push(logEntry);

    // --- Append to remote log file ---
    const logFileName = 'command.log';
    // Format for file logging (adjust as needed)
    const fileLogEntry = 
      `[${timestamp.toISOString()}] ${success ? '✅' : '❌'} CMD: ${command}\n` +
      `${stdout ? `[${timestamp.toISOString()}] STDOUT: ${stdout}\n` : ''}` +
      `${stderr ? `[${timestamp.toISOString()}] STDERR: ${stderr}\n` : ''}`;

    if (this.isConnected && this.ssh.isConnected()) {
      try {
        const appendCommand = `tee -a ${logFileName}`;
        console.log(`Appending command log entry to remote file: ${logFileName} in CWD: ${this.currentWorkingDirectory || 'default'}`);
        // Use ssh.exec to pass the log entry via stdin to tee
        const resultStderr = await this.ssh.exec(appendCommand, [], {
          cwd: this.currentWorkingDirectory || undefined,
          stdin: fileLogEntry, // Pass the formatted log entry via stdin
          stream: 'stderr' // Only capture stderr for this operation
        });

        // Check if the result (stderr string) is non-empty
        if (resultStderr && resultStderr.trim().length > 0) {
          // Log append error but don't throw, as logging is secondary
          console.error(`❌ Failed to append to remote command log (${logFileName}): ${resultStderr}`);
        }
      } catch (err) {
        // Log append error but don't throw
        console.error(`❌ Error appending to remote command log (${logFileName}):`, err);
      }
    } else {
      console.warn(`SSH not connected, cannot append to remote command log file: ${logFileName}`);
    }
    // ---------------------------------

    // Optional: Add logic here to limit in-memory log size (e.g., keep last N entries)
    // if (this.commandLog.length > MAX_LOG_ENTRIES) {
    //   this.commandLog.shift();
    // }
  }

  /**
   * Get the command execution log
   */
  public getCommandLog(): CommandLogEntry[] {
    return [...this.commandLog]; // Return a copy
  }

  /**
   * Check if SSH is connected
   */
  public isSSHConnected(): boolean {
    return this.isConnected && this.ssh.isConnected();
  }

  /**
   * Get the current status of the SSH connection
   */
  public getStatus(): { connected: boolean } {
    return { connected: this.isConnected && this.ssh.isConnected() };
  }

  /**
   * Edit or upload content to a specific file on the remote server
   * This method overwrites the file if it exists or creates a new file if it doesn't.
   */
  public async editRemoteFile(filePath: string, content: string): Promise<{ success: boolean; message: string }> {
    if (!this.isConnected || !this.ssh.isConnected()) {
      return { success: false, message: 'SSH not connected. Please initialize connection first.' };
    }

    try {
      // Escape single quotes in the file path itself for the shell command
      const escapedFilePath = filePath.replace(/'/g, "'\\''");
      const command = `cat > '${escapedFilePath}'`;
      console.log(`Uploading content via stdin to remote file: '${escapedFilePath}' using command: ${command}`);

      // Use ssh.exec instead of execCommand to pass stdin
      const result = await this.ssh.exec(command, [], {
        cwd: this.currentWorkingDirectory || undefined,
        stdin: content, // Pass the raw content via stdin
        stream: 'both' // Ensure we capture stderr
      });

      // node-ssh exec doesn't throw on stderr, we need to check it
      // It resolves with an object containing stdout and stderr or rejects on critical errors
      if (result.stderr) {
        throw new Error(result.stderr);
      }

      console.log(`File content uploaded successfully to: ${filePath}`);
      return {
        success: true,
        message: `File content uploaded successfully to ${filePath}`
      };
    } catch (err) {
      const errorMsg = `Failed to upload content to file: ${filePath}`;
      console.error(`❌ ${errorMsg}:`, err);
      return {
        success: false,
        message: `${errorMsg}: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }

  /**
   * Read content from a specific file on the remote server
   */
  public async readRemoteFile(filePath: string): Promise<{ success: boolean; message: string; content?: string }> {
    if (!this.isConnected || !this.ssh.isConnected()) {
      return { success: false, message: 'SSH not connected. Please initialize connection first.' };
    }

    try {
      console.log(`Reading content from remote file: ${filePath}`);
      // Run this command within the current working directory if filePath is relative
      const command = `cat ${filePath}`;
      const result = await this.ssh.execCommand(command, { cwd: this.currentWorkingDirectory || undefined });
      if (result.stderr) {
        throw new Error(result.stderr);
      }
      console.log(`File content read successfully from: ${filePath}`);
      return {
        success: true,
        message: `File content read successfully from ${filePath}`,
        content: result.stdout
      };
    } catch (err) {
      const errorMsg = `Failed to read content from file: ${filePath}`;
      console.error(`❌ ${errorMsg}:`, err);
      return {
        success: false,
        message: `${errorMsg}: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }

  /**
   * Get the current working directory stored in the manager
   */
  public getCurrentWorkingDirectory(): string | null {
    return this.currentWorkingDirectory;
  }

  /**
   * Update model proxy environment variables in .env
   */
  public updateModelProxyEnv(proxy: { baseUrl?: string; apiKey?: string }): { success: boolean; message: string } {
    try {
      const envPath = path.join(process.cwd(), '.env');
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }
      const envLines = envContent.split(/\r?\n/);
      const envMap: Record<string, string> = {};
      for (const line of envLines) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (match) {
          envMap[match[1]] = match[2];
        }
      }
      if (proxy.baseUrl) envMap['SEALOS_USW_BASE_URL'] = proxy.baseUrl;
      if (proxy.apiKey) envMap['SEALOS_USW_API_KEY'] = proxy.apiKey;
      // Rebuild .env content
      const allKeys = new Set([...Object.keys(envMap), 'SEALOS_USW_BASE_URL', 'SEALOS_USW_API_KEY']);
      const newLines: string[] = [];
      for (const key of allKeys) {
        if (envMap[key] !== undefined) {
          newLines.push(`${key}=${envMap[key]}`);
        }
      }
      fs.writeFileSync(envPath, newLines.join('\n'));
    } catch (err) {
      console.error('Failed to persist model proxy env to .env:', err);
      return { success: false, message: 'Failed to persist model proxy env to .env file.' };
    }
    return { success: true, message: 'Model proxy env updated and persisted to .env file.' };
  }
}

// Singleton instance
export const propsManager = new PropsManager();

// Ensure cleanup on process exit
process.on('exit', () => propsManager.disconnectSSH());
process.on('SIGINT', () => propsManager.disconnectSSH());
process.on('SIGTERM', () => propsManager.disconnectSSH());

// Do not automatically connect when module loads
// connectToServer(); 
