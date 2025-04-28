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

// Tool to launch npm run dev in the background
server.tool(
  "props_launch_dev",
  {
    projectRoot: z.string().describe("The absolute path to the project's root directory on the remote server where 'npm run dev' should be launched.")
  },
  async ({ projectRoot }) => {
    // Escape single quotes in the project path for shell safety
    const escapedProjectRoot = projectRoot.replace(/'/g, "'\\''");

    // Use pkill to find and kill processes matching the command line pattern, running within the project root
    const killCommand = `cd '${escapedProjectRoot}' && pkill -f 'npm run dev' || true`; // Use '|| true' to prevent failure if no process is found
    // Launch command, also ensuring it runs within the project root
    const launchCommand = `cd '${escapedProjectRoot}' && nohup npm run dev > npm_dev.log 2>&1 &`;
    try {
      console.log(`[PropsMCP] Attempting to kill existing 'npm run dev' processes in directory '${escapedProjectRoot}' with command: ${killCommand}`);
      console.log(`[PropsMCP] Then launching dev server in directory '${escapedProjectRoot}' with command: ${launchCommand}`);

      // Ensure connection is initialized
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

      // Execute the kill command first
      const killResponse = await fetch(PROPS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          command: killCommand
        })
      });

      let killMessage = "";
      if (!killResponse.ok) {
        // Error during pkill execution (should be rare with '|| true')
        const killErrorText = await killResponse.text();
        killMessage = `Attempt to kill 'npm run dev' processes encountered an error. Server response: ${killErrorText}`;
        console.error(`[PropsMCP] ${killMessage}`);
        // Decide if we should proceed or return an error - let's proceed but log the error
      } else {
        const killResult = await killResponse.json();
        // Check stderr specifically, as stdout might be empty if nothing was killed
        if (killResult.stderr && killResult.stderr.trim().length > 0) {
          // pkill might output messages even if it succeeds or finds nothing
          killMessage = `Kill command stderr: ${killResult.stderr}`.trim();
          console.log(`[PropsMCP] ${killMessage}`);
        } else {
          killMessage = `Attempt to kill existing 'npm run dev' processes finished.`
          console.log(`[PropsMCP] ${killMessage}`);
        }
      }

      // Now execute the launch command
      console.log(`[PropsMCP] Executing launch command: ${launchCommand}`);
      const launchResponse = await fetch(PROPS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          command: launchCommand
        })
      });

      if (!launchResponse.ok) {
        const launchErrorText = await launchResponse.text();
        console.error(`[PropsMCP] Failed to launch dev server: ${launchErrorText}`);
        return {
          type: "text",
          text: `${killMessage}. Failed to launch dev server: ${launchErrorText || 'Unknown error'}`
        };
      }

      const launchResult = await launchResponse.json();
      const resultText = `${killMessage}. Attempted to launch 'npm run dev' in the background. Server response: ${launchResult.message}. Check npm_dev.log for output.`;
      console.log(`[PropsMCP] Launch sequence finished. Result: ${resultText}`);

      return {
        type: "text",
        text: resultText
      };
    } catch (err) {
      console.error(`[PropsMCP] Unexpected error during launch sequence: ${err instanceof Error ? err.message : String(err)}`);
      return {
        type: "text",
        text: `Error during launch sequence: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }
);

// Tool to check if 'npm run dev' is running
server.tool(
  "props_check_dev_status",
  async () => {
    const command = "ps aux | grep 'npm run dev' | grep -v grep";
    try {
      console.log(`[PropsMCP] Checking dev server status with command: ${command}`);

      // Ensure connection is initialized
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
          text: `Failed to initialize SSH connection before checking status: ${initErrorText || 'Unknown error'}`
        };
      }

      const initResult = await initResponse.json();
      console.log(`[PropsMCP] SSH initialization result: ${initResult.message}`);

      // Execute the check command
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
        console.error(`[PropsMCP] Failed to check dev server status: ${execErrorText}`);
        return {
          type: "text",
          text: `Failed to check dev server status: ${execErrorText || 'Unknown error'}`
        };
      }

      const result = await execResponse.json();

      // Check the stdout for relevant process information
      const isRunning = result.stdout && result.stdout.trim().length > 0;
      const statusMessage = isRunning
        ? `An 'npm run dev' process appears to be running.\nOutput:\n${result.stdout}`
        : "No 'npm run dev' process found running.";
        
      if (result.stderr && result.stderr.trim().length > 0) {
        console.warn(`[PropsMCP] Check command stderr: ${result.stderr}`);
        // Optionally append stderr to the message if needed
      }

      console.log(`[PropsMCP] Dev server status check result: ${statusMessage}`);

      return {
        type: "text",
        text: statusMessage,
        isRunning: isRunning // Adding a boolean flag for potential programmatic use
      };

    } catch (err) {
      console.error(`[PropsMCP] Unexpected error checking dev server status: ${err instanceof Error ? err.message : String(err)}`);
      return {
        type: "text",
        text: `Error checking dev server status: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }
);

// Tool to read the dev server log file (npm_dev.log)
server.tool(
  "props_read_dev_log",
  {
    projectRoot: z.string().describe("The absolute path to the project's root directory on the remote server where 'npm_dev.log' is located.")
  },
  async ({ projectRoot }) => {
    // Combine project root and log file name. Assuming POSIX paths for remote server.
    // Ensure no double slashes if projectRoot ends with /
    const logFilePath = `${projectRoot.replace(/\/$/, '')}/npm_dev.log`;
    try {
      console.log(`[PropsMCP] Reading dev server log file from path: ${logFilePath}`);

      // Ensure connection is initialized (readFile action in API also checks this)
      const initResponse = await fetch(PROPS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initialize' })
      });

      if (!initResponse.ok) {
        const initErrorText = await initResponse.text();
        console.error(`[PropsMCP] Failed to initialize SSH before reading log: ${initErrorText}`);
        return {
          type: "text",
          text: `Failed to initialize SSH connection before reading log: ${initErrorText || 'Unknown error'}`
        };
      }
      const initResult = await initResponse.json();
      console.log(`[PropsMCP] SSH initialization result: ${initResult.message}`);

      // Call the readFile action from the props API
      const readResponse = await fetch(PROPS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'readFile',
          filePath: logFilePath // Use the full path
        })
      });

      if (!readResponse.ok) {
        const readErrorText = await readResponse.text();
        // Handle case where log file might not exist yet
        if (readResponse.status === 500 && readErrorText.includes('No such file or directory')) {
          console.warn(`[PropsMCP] Dev log file not found: ${logFilePath}`);
          return { type: "text", text: `Dev log file (${logFilePath}) not found. The server might not have started or logged anything yet.` };
        } else {
          console.error(`[PropsMCP] Failed to read dev log file: ${readErrorText}`);
          return { type: "text", text: `Failed to read dev log file: ${readErrorText || 'Unknown error'}` };
        }
      }

      const readResult = await readResponse.json();
      console.log(`[PropsMCP] Dev log file read successfully.`);

      return {
        type: "text",
        text: `Content of ${logFilePath}:
${readResult.content || '(empty)'}`,
        content: readResult.content || ''
      };

    } catch (err) {
      console.error(`[PropsMCP] Unexpected error reading dev log: ${err instanceof Error ? err.message : String(err)}`);
      return {
        type: "text",
        text: `Error reading dev log file: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }
);

// Tool to read the command execution log
server.tool(
  "props_read_command_log",
  async () => {
    try {
      console.log(`[PropsMCP] Reading command log via GET request.`);

      // Call the GET endpoint of the props API
      const response = await fetch(PROPS_API_URL, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[PropsMCP] Failed to get command log: ${errorText}`);
        return {
          type: "text",
          text: `Failed to fetch command log: ${errorText || 'Unknown error'}`
        };
      }

      const result = await response.json();
      const commandLog = result.commandLog || [];

      console.log(`[PropsMCP] Command log fetched successfully (${commandLog.length} entries).`);

      // Format the log for output
      let formattedLog = "Command Execution Log:\n";
      if (commandLog.length === 0) {
        formattedLog += "(No commands executed yet in this session)";
      } else {
        formattedLog += commandLog.map(entry => 
          `[${new Date(entry.timestamp).toISOString()}] ${entry.success ? '✅' : '❌'} ${entry.command}\n` +
          `${entry.stdout ? `  STDOUT: ${entry.stdout}\n` : ''}` +
          `${entry.stderr ? `  STDERR: ${entry.stderr}\n` : ''}`
        ).join('\n');
      }

      return {
        type: "text",
        text: formattedLog,
        logData: commandLog // Return raw data as well if needed
      };

    } catch (err) {
      console.error(`[PropsMCP] Unexpected error reading command log: ${err instanceof Error ? err.message : String(err)}`);
      return {
        type: "text",
        text: `Error reading command log: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);

console.log("[PropsMCP] Props MCP Server started and connected via Stdio.");
