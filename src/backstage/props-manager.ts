import { NodeSSH } from 'node-ssh';
import fs from 'fs';
import path from 'path';
import * as toml from '@iarna/toml';

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
  private configFilePath: string = path.join(process.cwd(), 'src', 'auth', 'props', 'credential.toml');

  public constructor() {
    this.ssh = new NodeSSH();
    this.loadCredentialsFromConfig();
  }

  /**
   * Load SSH credentials from TOML config file
   */
  private loadCredentialsFromConfig(): void {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const configData = fs.readFileSync(this.configFilePath, 'utf8');
        const config = toml.parse(configData) as { ssh?: { host?: string; username?: string; port?: number | string; privateKeyPath?: string } };
        if (config.ssh) {
          this.host = config.ssh.host || '';
          this.username = config.ssh.username || '';
          // Handle port number that might contain underscores or be a string
          if (config.ssh.port) {
            this.port = typeof config.ssh.port === 'string' ? parseInt(config.ssh.port.replace('_', ''), 10) : config.ssh.port;
          } else {
            this.port = 22;
          }
          this.privateKeyPath = config.ssh.privateKeyPath || '';
          console.log('SSH credentials loaded from config file');
        } else {
          console.warn('No SSH section found in credential.toml');
        }
      } else {
        console.warn('Credentials config file not found at:', this.configFilePath);
      }
    } catch (error) {
      console.error('Failed to load credentials from config file:', error);
    }
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
   * Update SSH credentials
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
    
    return { success: true, message: 'SSH credentials updated successfully.' };
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

    // Reload credentials from config file before initializing connection
    this.loadCredentialsFromConfig();

    // Check if credentials are set
    if (!this.host || !this.username || !this.privateKeyPath) {
      const errorMsg = 'SSH credentials are not properly configured. Please check credential.toml';
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
          const cleanedCwd = result.stdout.split('\n').filter(line => line.trim().length > 0)[0]?.trim();
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
}

// Singleton instance
export const propsManager = new PropsManager();

// Ensure cleanup on process exit
process.on('exit', () => propsManager.disconnectSSH());
process.on('SIGINT', () => propsManager.disconnectSSH());
process.on('SIGTERM', () => propsManager.disconnectSSH());

// Do not automatically connect when module loads
// connectToServer(); 
