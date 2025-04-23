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
      return { success: true, message: 'SSH connection successful' };

    } catch (err) {
      this.isConnected = false;
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
    }
  }

  /**
   * Execute a command over SSH
   */
  public async executeCommand(command: string): Promise<{ success: boolean; message: string; stdout?: string; stderr?: string }> {
    if (!this.isConnected || !this.ssh.isConnected()) {
      return { success: false, message: 'SSH not connected. Please initialize connection first.' };
    }

    try {
      console.log(`Executing command: ${command}`);
      const result = await this.ssh.execCommand(command);
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
}

// Singleton instance
export const propsManager = new PropsManager();

// Ensure cleanup on process exit
process.on('exit', () => propsManager.disconnectSSH());
process.on('SIGINT', () => propsManager.disconnectSSH());
process.on('SIGTERM', () => propsManager.disconnectSSH());

// Do not automatically connect when module loads
// connectToServer(); 
