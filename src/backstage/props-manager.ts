import { NodeSSH } from 'node-ssh';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

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
    return { success: true, message: 'SSH credentials updated and persisted to .env file.' };
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
   * Initialize SSH connection
   */
  public async initializeSSH(): Promise<{ success: boolean; message: string; data?: any }> {
    if (this.isConnected && this.ssh.isConnected()) {
      console.log('SSH already connected.');
      return { success: true, message: 'Already connected' };
    }
    // Reload credentials from .env before initializing connection
    this.loadCredentialsFromEnv();
    // Check if credentials are set
    if (!this.host || !this.username || !this.privateKeyPath) {
      const errorMsg = 'SSH credentials are not properly configured. Please check your .env file.';
      console.error(`❌ ${errorMsg}`);
      return { success: false, message: errorMsg };
    }
    // Check if the key file exists
    if (!fs.existsSync(this.privateKeyPath)) {
      const errorMsg = `Private key file not found at: ${this.privateKeyPath}`;
      console.error(`❌ ${errorMsg}`);
      return { success: false, message: errorMsg };
    }
    // Read the private key content
    let privateKeyContent: string;
    try {
      privateKeyContent = fs.readFileSync(this.privateKeyPath, 'utf8');
    } catch (readErr) {
      const errorMsg = `Failed to read private key file: ${this.privateKeyPath}`;
      console.error(`❌ ${errorMsg}`, readErr);
      return { success: false, message: `${errorMsg}: ${readErr instanceof Error ? readErr.message : String(readErr)}` };
    }
    try {
      console.log(`Attempting SSH connection to ${this.host}:${this.port}...`);
      await this.ssh.connect({
        host: this.host,
        username: this.username,
        port: this.port,
        privateKey: privateKeyContent,
      });
      this.isConnected = true;
      console.log('✅ SSH Connected!');
      // Get initial working directory
      try {
        const pwdResult = await this.ssh.execCommand('pwd');
        if (pwdResult.stdout && !pwdResult.stderr) {
          // Clean the stdout to ensure it's a single line path
          const cleanedCwd = pwdResult.stdout.split('\n').filter(line => line.trim().length > 0)[0]?.trim();
          this.currentWorkingDirectory = cleanedCwd || null;
          console.log(`Initial working directory set to: ${this.currentWorkingDirectory}`);
        } else {
          console.warn(`Could not determine initial working directory. stderr: ${pwdResult.stderr}`);
          this.currentWorkingDirectory = null; // Indicate unknown CWD
        }
      } catch (pwdErr) {
        console.error('❌ Failed to get initial working directory:', pwdErr);
        this.currentWorkingDirectory = null; // Indicate unknown CWD
      }
      return { success: true, message: 'SSH connection successful' };
    } catch (err) {
      this.isConnected = false;
      this.currentWorkingDirectory = null; // Reset CWD on connection failure
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
      this.currentWorkingDirectory = null; // Reset CWD on disconnect
    }
  }

  /**
   * Execute a command over SSH, maintaining CWD state
   */
  public async executeCommand(command: string): Promise<{ success: boolean; message: string; stdout?: string; stderr?: string }> {
    if (!this.isConnected || !this.ssh.isConnected()) {
      return { success: false, message: 'SSH not connected. Please initialize connection first.' };
    }

    // Trim the command
    const trimmedCommand = command.trim();

    try {
      // Check if it's a cd command
      if (trimmedCommand.startsWith('cd ') || trimmedCommand === 'cd') {
        // Execute cd and then pwd to update the stored CWD
        // Handle 'cd' without arguments (goes to home)
        const cdCommand = trimmedCommand === 'cd' ? 'cd && pwd' : `${trimmedCommand} && pwd`;
        console.log(`Executing cd command: ${cdCommand} in ${this.currentWorkingDirectory || 'default directory'}`);
        const result = await this.ssh.execCommand(cdCommand, { cwd: this.currentWorkingDirectory || undefined });

        if (result.stderr) {
          console.error(`cd command stderr: ${result.stderr}`);
          // cd failed, CWD remains unchanged
          return {
            success: false,
            message: `Failed to change directory: ${result.stderr}`,
            stderr: result.stderr
          };
        } else {
          // cd succeeded, update CWD
          // Clean the stdout to ensure it's a single line path
          const lines = result.stdout.split('\n').filter(line => line.trim().length > 0);
          const cleanedCwd = lines[lines.length - 1]?.trim();
          this.currentWorkingDirectory = cleanedCwd || null;
          console.log(`Working directory changed to: ${this.currentWorkingDirectory}`);
          return {
            success: true,
            message: `Working directory changed to ${this.currentWorkingDirectory || 'unknown'}`,
            stdout: '', // No stdout from the original cd command itself
            stderr: ''
          };
        }
      } else {
        // Execute other commands in the current working directory
        console.log(`Executing command: ${trimmedCommand} in ${this.currentWorkingDirectory || 'default directory'}`);
        const result = await this.ssh.execCommand(trimmedCommand, { cwd: this.currentWorkingDirectory || undefined });
        console.log(`Command executed. Stdout: ${result.stdout}`);
        if (result.stderr) {
          console.error(`Command stderr: ${result.stderr}`);
        }
        return {
          success: true,
          message: 'Command executed successfully',
          stdout: result.stdout,
          stderr: result.stderr
        };
      }
    } catch (err) {
      const errorMsg = `Failed to execute command: ${command}`;
      console.error(`❌ ${errorMsg}:`, err);
      return {
        success: false,
        message: `${errorMsg}: ${err instanceof Error ? err.message : String(err)}`
      };
    }
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
      console.log(`Uploading content to remote file: ${filePath}`);
      // Use execCommand to create/overwrite file with content via echo command
      // Run this command within the current working directory if filePath is relative
      const command = `echo "${content.replace(/"/g, '\"')}" > ${filePath}`;
      const result = await this.ssh.execCommand(command, { cwd: this.currentWorkingDirectory || undefined });
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
