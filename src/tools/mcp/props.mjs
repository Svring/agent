import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fetch from 'node-fetch';

// API endpoint for Props service
const PROPS_API_URL = 'http://localhost:3000/api/props';

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
    try {
      console.log(`[PropsMCP] Executing command: ${command}`);
      
      // First ensure connection is initialized
      const initResponse = await fetch(PROPS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initialize' })
      });
      
      if (!initResponse.ok) {
        const initError = await initResponse.json();
        console.error(`[PropsMCP] Failed to initialize SSH: ${initError.message}`);
        return {
          type: "text",
          text: `Failed to initialize SSH connection: ${initError.message}`
        };
      }
      
      // Execute the command
      const execResponse = await fetch(PROPS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          command: command
        })
      });
      
      if (!execResponse.ok) {
        const execError = await execResponse.json();
        console.error(`[PropsMCP] Command execution error: ${execError.message}`);
        return {
          type: "text",
          text: `Command execution error: ${execError.message}`
        };
      }
      
      const result = await execResponse.json();
      
      // Format the result for MCP output
      const resultText = `${result.message}${result.stderr ? `\nStderr: ${result.stderr}` : ''}`;
      console.log(`[PropsMCP] Command result: ${resultText}`);
      
      return {
        type: "text",
        text: resultText,
        stdout: result.stdout,
        stderr: result.stderr
      };
    } catch (err) {
      console.error(`[PropsMCP] Unexpected error: ${err.message}`);
      return {
        type: "text",
        text: `Error: ${err.message}`
      };
    }
  }
);

// Tool to get connection status
server.tool(
  "props_get_status",
  {}, // No input parameters
  async () => {
    try {
      // Get the status from the API
      const statusResponse = await fetch(PROPS_API_URL, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!statusResponse.ok) {
        throw new Error(`Failed to get status: ${statusResponse.statusText}`);
      }
      
      const status = await statusResponse.json();
      const statusMessage = `SSH is currently ${status.status}.`;
      console.log(`[PropsMCP] Status check: ${statusMessage}`);
      
      return {
        type: "text",
        text: statusMessage,
        connected: status.status === 'Connected'
      };
    } catch (err) {
      console.error(`[PropsMCP] Status check error: ${err.message}`);
      return {
        type: "text",
        text: `Error checking status: ${err.message}`,
        connected: false
      };
    }
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);

console.log("[PropsMCP] Props MCP Server started and connected via Stdio.");
