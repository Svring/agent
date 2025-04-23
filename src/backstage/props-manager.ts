import { NodeSSH } from 'node-ssh';
import fs from 'fs';

/**
 * Singleton class to manage SSH connections and actions
 */
export class PropsManager {
  private static instance: PropsManager;
  private ssh: NodeSSH;
  private isConnected: boolean = false;
  private privateKeyPath: string = '/Users/linkling/Code/agent/src/auth/hzh.sealos.run_ns-qezqvm92_devbox';
  private currentWorkingDirectory: string | null = null;

  public constructor() {
    this.ssh = new NodeSSH();
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
   * Initialize SSH connection
   */
  public async initializeSSH(): Promise<{ success: boolean; message: string; data?: any }> {
    if (this.isConnected && this.ssh.isConnected()) {
      console.log('SSH already connected.');
      return { success: true, message: 'Already connected' };
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
      console.log(`Attempting SSH connection to hzh.sealos.run:32699...`);
      await this.ssh.connect({
        host: 'hzh.sealos.run',
        username: 'devbox',
        port: 32699,
        privateKey: privateKeyContent,
      });

      this.isConnected = true;
      console.log('✅ SSH Connected!');

      // Get initial working directory
      try {
        const pwdResult = await this.ssh.execCommand('pwd');
        if (pwdResult.stdout && !pwdResult.stderr) {
          this.currentWorkingDirectory = pwdResult.stdout.trim();
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
          this.currentWorkingDirectory = result.stdout.trim();
          console.log(`Working directory changed to: ${this.currentWorkingDirectory}`);
          return {
            success: true,
            message: `Working directory changed to ${this.currentWorkingDirectory}`,
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
