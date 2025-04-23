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
        const initErrorText = await initResponse.text();
        console.error(`[PropsMCP] Failed to initialize SSH: ${initErrorText}`);
        return {
          type: "text",
          text: `Failed to initialize SSH connection: ${initErrorText || 'Unknown error'}`
        };
      }
      
      const initResult = await initResponse.json();
      console.log(`[PropsMCP] SSH initialization result: ${initResult.message}`);
      
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
        const execErrorText = await execResponse.text();
        console.error(`[PropsMCP] Command execution error: ${execErrorText}`);
        return {
          type: "text",
          text: `Command execution error: ${execErrorText || 'Unknown error'}`
        };
      }
      
      const result = await execResponse.json();
      
      // Format the result for MCP output
      const resultText = `${result.message}${result.stdout ? `\nStdout: ${result.stdout}` : ''}${result.stderr ? `\nStderr: ${result.stderr}` : ''}`;
      console.log(`[PropsMCP] Command result: ${resultText}`);
      
      return {
        type: "text",
        text: resultText,
        stdout: result.stdout || '',
        stderr: result.stderr || ''
      };
    } catch (err) {
      console.error(`[PropsMCP] Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
      return {
        type: "text",
        text: `Error: ${err instanceof Error ? err.message : String(err)}`
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
        const errorText = await statusResponse.text();
        console.error(`[PropsMCP] Failed to get status: ${errorText}`);
        return {
          type: "text",
          text: `Failed to get status: ${errorText || 'Unknown error'}`,
          connected: false
        };
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
      console.error(`[PropsMCP] Status check error: ${err instanceof Error ? err.message : String(err)}`);
      return {
        type: "text",
        text: `Error checking status: ${err instanceof Error ? err.message : String(err)}`,
        connected: false
      };
    }
  }
);

// Tool to edit a remote file
server.tool(
  "props_edit_file",
  {
    filePath: z.string().describe("The path of the file to edit on the remote server."),
    content: z.string().describe("The content to write to the file.")
  },
  async ({ filePath, content }) => {
    try {
      console.log(`[PropsMCP] Editing file: ${filePath}`);
      
      // First ensure connection is initialized
      const initResponse = await fetch(PROPS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initialize' })
      });
      
      if (!initResponse.ok) {
        const initErrorText = await initResponse.text();
        console.error(`[PropsMCP] Failed to initialize SSH: ${initErrorText}`);
        return {
          type: "text",
          text: `Failed to initialize SSH connection: ${initErrorText || 'Unknown error'}`
        };
      }
      
      const initResult = await initResponse.json();
      console.log(`[PropsMCP] SSH initialization result: ${initResult.message}`);
      
      // Edit the file
      const editResponse = await fetch(PROPS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'editFile',
          filePath: filePath,
          content: content
        })
      });
      
      if (!editResponse.ok) {
        const editErrorText = await editResponse.text();
        console.error(`[PropsMCP] File edit error: ${editErrorText}`);
        return {
          type: "text",
          text: `File edit error: ${editErrorText || 'Unknown error'}`
        };
      }
      
      const editResult = await editResponse.json();
      console.log(`[PropsMCP] File edit result: ${editResult.message}`);
      
      return {
        type: "text",
        text: editResult.message
      };
    } catch (err) {
      console.error(`[PropsMCP] Unexpected error during file edit: ${err instanceof Error ? err.message : String(err)}`);
      return {
        type: "text",
        text: `Error: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }
);

// Tool to read a remote file
server.tool(
  "props_read_file",
  {
    filePath: z.string().describe("The path of the file to read from the remote server.")
  },
  async ({ filePath }) => {
    try {
      console.log(`[PropsMCP] Reading file: ${filePath}`);
      
      // First ensure connection is initialized
      const initResponse = await fetch(PROPS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initialize' })
      });
      
      if (!initResponse.ok) {
        const initErrorText = await initResponse.text();
        console.error(`[PropsMCP] Failed to initialize SSH: ${initErrorText}`);
        return {
          type: "text",
          text: `Failed to initialize SSH connection: ${initErrorText || 'Unknown error'}`
        };
      }
      
      const initResult = await initResponse.json();
      console.log(`[PropsMCP] SSH initialization result: ${initResult.message}`);
      
      // Read the file
      const readResponse = await fetch(PROPS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'readFile',
          filePath: filePath
        })
      });
      
      if (!readResponse.ok) {
        const readErrorText = await readResponse.text();
        console.error(`[PropsMCP] File read error: ${readErrorText}`);
        return {
          type: "text",
          text: `File read error: ${readErrorText || 'Unknown error'}`
        };
      }
      
      const readResult = await readResponse.json();
      console.log(`[PropsMCP] File read result: ${readResult.message}`);
      
      return {
        type: "text",
        text: `${readResult.message}${readResult.content ? `\nContent: ${readResult.content}` : ''}`,
        content: readResult.content || ''
      };
    } catch (err) {
      console.error(`[PropsMCP] Unexpected error during file read: ${err instanceof Error ? err.message : String(err)}`);
      return {
        type: "text",
        text: `Error: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);

console.log("[PropsMCP] Props MCP Server started and connected via Stdio.");
