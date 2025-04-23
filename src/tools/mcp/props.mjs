import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { NodeSSH } from 'node-ssh';
import fs from 'fs';

// PropsManager logic, similar to the backstage version but adapted for direct use here
class PropsManager {
  constructor() {
    this.ssh = new NodeSSH();
    this.isConnected = false;
    // Keep the hardcoded path as seen in the original manager
    this.privateKeyPath = '/Users/linkling/Code/agent/src/config/hzh.sealos.run_ns-qezqvm92_devbox';
    this.connectionPromise = null; // To handle concurrent initialization attempts
  }

  // Simplified initialization, ensuring it only runs once concurrently
  async initializeSSH() {
    if (this.isConnected && this.ssh.isConnected()) {
      console.log('[PropsMCP] SSH already connected.');
      return { success: true, message: 'Already connected' };
    }

    // If connection is already in progress, wait for it
    if (this.connectionPromise) {
        console.log('[PropsMCP] SSH connection attempt already in progress, waiting...');
        return this.connectionPromise;
    }

    // Start the connection process and store the promise
    this.connectionPromise = (async () => {
        console.log('[PropsMCP] Attempting new SSH connection...');
        if (!fs.existsSync(this.privateKeyPath)) {
          const errorMsg = `Private key file not found at: ${this.privateKeyPath}`;
          console.error(`[PropsMCP] ❌ ${errorMsg}`);
          return { success: false, message: errorMsg };
        }

        let privateKeyContent;
        try {
          privateKeyContent = fs.readFileSync(this.privateKeyPath, 'utf8');
        } catch (readErr) {
          const errorMsg = `Failed to read private key file: ${this.privateKeyPath}`;
          console.error(`[PropsMCP] ❌ ${errorMsg}`, readErr);
          return { success: false, message: `${errorMsg}: ${readErr instanceof Error ? readErr.message : String(readErr)}` };
        }

        try {
          console.log(`[PropsMCP] Connecting to hzh.sealos.run:32699...`);
          await this.ssh.connect({
            host: 'hzh.sealos.run',
            username: 'devbox',
            port: 32699,
            privateKey: privateKeyContent,
          });

          this.isConnected = true;
          console.log('[PropsMCP] ✅ SSH Connected!');
          return { success: true, message: 'SSH connection successful' };

        } catch (err) {
          this.isConnected = false;
          const errorMsg = `SSH Connection failed`;
          console.error(`[PropsMCP] ❌ ${errorMsg}:`, err);
          return { success: false, message: `${errorMsg}: ${err instanceof Error ? err.message : String(err)}` };
        } finally {
          this.connectionPromise = null; // Reset promise once completed/failed
        }
    })();

    return this.connectionPromise;
  }

  async executeCommand(command) {
    if (!this.isConnected || !this.ssh.isConnected()) {
        // Attempt to connect if not already connected
        console.warn('[PropsMCP] SSH not connected. Attempting to initialize before executing command...');
        const initResult = await this.initializeSSH();
        if (!initResult.success) {
            return { success: false, message: `SSH connection failed, cannot execute command: ${initResult.message}` };
        }
    }

    try {
      console.log(`[PropsMCP] Executing command: ${command}`);
      const result = await this.ssh.execCommand(command);
      console.log(`[PropsMCP] Command executed. Exit code: ${result.code}`);
      // Combine stdout and stderr for simplicity in MCP output, but log stderr separately
      if (result.stderr) {
        console.error(`[PropsMCP] Command stderr: ${result.stderr}`);
      }
      return {
        success: result.code === 0, // Consider command successful if exit code is 0
        message: `Command executed (exit code ${result.code})`,
        stdout: result.stdout,
        stderr: result.stderr
      };
    } catch (err) {
      const errorMsg = `Failed to execute command: ${command}`;
      console.error(`[PropsMCP] ❌ ${errorMsg}:`, err);
      return {
        success: false,
        message: `${errorMsg}: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }

  disconnectSSH() {
    if (this.ssh.isConnected()) {
      console.log('[PropsMCP] Disconnecting SSH connection...');
      this.ssh.dispose();
      this.isConnected = false;
      this.connectionPromise = null; // Ensure promise is cleared on disconnect
      console.log('[PropsMCP] SSH Disconnected.');
      return { success: true, message: 'SSH disconnected successfully.' };
    } else {
      console.log('[PropsMCP] SSH already disconnected.');
      return { success: true, message: 'SSH was not connected.' };
    }
  }

  getStatus() {
    const connected = this.isConnected && this.ssh.isConnected();
    console.log(`[PropsMCP] Status check: ${connected ? 'Connected' : 'Disconnected'}`);
    return {
        connected: connected,
        message: `SSH is currently ${connected ? 'Connected' : 'Disconnected'}.`
    };
  }
}

const propsManager = new PropsManager();

// Create an MCP server
const server = new McpServer({
  name: "Props",
  version: "1.0.0",
  description: "A tool for managing SSH connections and executing commands on a remote props server."
});

// Tool to execute a command
server.tool(
  "props_execute_command",
  {
    command: z.string().describe("The command to execute on the remote server.")
  },
  async ({ command }) => {
    const result = await propsManager.executeCommand(command);
    // Return stdout/stderr along with the message
    return {
      type: "text",
      text: `${result.message}${result.stderr ? `
Stderr: ${result.stderr}` : ''}`,
      stdout: result.stdout,
      stderr: result.stderr
    };
  }
);

// Tool to get connection status
server.tool(
  "props_get_status",
  {}, // No input parameters
  async () => {
    const result = propsManager.getStatus();
    return {
      type: "text",
      text: result.message,
      connected: result.connected // Expose connection status directly
    };
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);

console.log("[PropsMCP] Props MCP Server started and connected via Stdio.");
