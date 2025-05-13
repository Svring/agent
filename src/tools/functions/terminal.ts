import { z } from "zod";
import { tool } from "ai";
import { propsManager, SSHCredentials } from "@/backstage/props-manager";

export const terminalExecuteCommand = tool({
    description: "Executes a shell command on the remote server for a specific user. Returns stdout and stderr.",
    parameters: z.object({
        userId: z.string().describe("The ID of the user whose SSH session is being used."),
        command: z.string().describe("The command to execute."),
    }),
    execute: async ({ userId, command }) => {
        try {
            const result = await propsManager.executeCommand(userId, command);
            return { 
                success: result.success,
                stdout: result.stdout || "", 
                stderr: result.stderr || "",
                message: result.message
            };
        } catch (error: any) {
            return { success: false, error: `Failed to execute command for user ${userId}: ${error.message}` };
        }
    }
});

// export const terminalEditFile = tool({
//     description: "Edits or creates a file on the remote server with the provided content for a user.",
//     parameters: z.object({
//         userId: z.string().describe("User ID."),
//         filePath: z.string().describe("The absolute path to the file on the remote server."),
//         content: z.string().describe("The content to write to the file."),
//     }),
//     execute: async ({ userId, filePath, content }) => {
//         try {
//             if (!propsManager.isSSHConnected(userId)) {
//                 return { success: false, error: `SSH session for user ${userId} is not active. Please initialize connection.` };
//             }
//             const result = await propsManager.editRemoteFile(userId, filePath, content);
//             return { success: result.success, message: result.message };
//         } catch (error: any) {
//             return { success: false, error: `Failed to edit file '${filePath}' for user ${userId}: ${error.message}` };
//         }
//     }
// });

// export const terminalReadFile = tool({
//     description: "Reads the content of a specified file from the remote server for a user.",
//     parameters: z.object({
//         userId: z.string().describe("User ID."),
//         filePath: z.string().describe("The absolute path to the file on the remote server."),
//     }),
//     execute: async ({ userId, filePath }) => {
//         try {
//             if (!propsManager.isSSHConnected(userId)) {
//                 return { success: false, error: `SSH session for user ${userId} is not active. Please initialize connection.` };
//             }
//             const result = await propsManager.readRemoteFile(userId, filePath);
//             if (result.success) {
//                 return { success: true, content: result.content || "", message: result.message };
//             } else {
//                 return { success: false, error: result.message, content: null };
//             }
//         } catch (error: any) {
//             return { success: false, error: `Failed to read file '${filePath}' for user ${userId}: ${error.message}`, content: null };
//         }
//     }
// });

export const terminalInitializeSsh = tool({
    description: "Initializes or re-initializes the SSH connection for a user. Requires host, username, and auth (password or privateKeyPath).",
    parameters: z.object({
        userId: z.string().describe("The ID of the user for whom to initialize the SSH session."),
        host: z.string().describe("The hostname or IP address of the SSH server."),
        port: z.number().optional().describe("The port number for SSH (default is 22)."),
        username: z.string().describe("The username for SSH login."),
        password: z.string().optional().describe("The password for SSH login. Use this OR privateKeyPath."),
        privateKeyPath: z.string().optional().describe("The server-side path to the private key file for SSH login. Use this OR password."),
    }),
    execute: async ({ userId, host, port, username, password, privateKeyPath }) => {
        const credentials: SSHCredentials = { host, port, username, password, privateKeyPath };
        if (!host || !username || (!password && !privateKeyPath)) {
            return { success: false, error: "Host, username, and either password or privateKeyPath are required for SSH initialization." };
        }
        try {
            const result = await propsManager.initializeSSH(userId, credentials);
            return { 
                success: result.success, 
                message: result.message, 
                cwd: result.data?.cwd, 
                activeHost: result.data?.credentials?.host 
            };
        } catch (error: any) {
            return { success: false, error: `SSH initialization failed for user ${userId}: ${error.message}` };
        }
    }
});

export const terminalDisconnectSsh = tool({
    description: "Disconnects the current user's SSH session.",
    parameters: z.object({
        userId: z.string().describe("The ID of the user whose SSH session should be disconnected."),
    }),
    execute: async ({ userId }) => {
        try {
            propsManager.disconnectSSH(userId);
            return { success: true, message: `SSH session for user ${userId} disconnected.` };
        } catch (error: any) {
            return { success: false, error: `Failed to disconnect SSH for user ${userId}: ${error.message}` };
        }
    }
});

// --- Additional Direct Props/Terminal Tools ---

export const terminalLaunchDevServer = tool({
    description: 'Kills any existing dev server and launches a new one (e.g., "npm run dev") in the background in a specified project root directory on the remote server. Logs output to npm_dev.log.',
    parameters: z.object({
        userId: z.string().describe("The ID of the user whose SSH session is being used."),
        projectRoot: z.string().describe("The absolute path to the project's root directory on the remote server."),
    }),
    execute: async ({ userId, projectRoot }) => {
        try {
            if (!propsManager.isSSHConnected(userId)) {
                return { success: false, error: `SSH session for user ${userId} is not active. Please initialize connection.` };
            }
            // This command is complex and assumes specific shell behavior (pkill, nohup, cd)
            // It might be better to have a dedicated script on the remote server triggered by a simpler command.
            const escapedProjectRoot = projectRoot.replace(/'/g, "'\\''");
            const killCommand = `cd '${escapedProjectRoot}' && pkill -f 'npm run dev' || true`;
            const launchCommand = `cd '${escapedProjectRoot}' && nohup npm run dev > npm_dev.log 2>&1 &`;
            
            let responseMessage = '';

            // Kill existing
            const killResult = await propsManager.executeCommand(userId, killCommand);
            responseMessage += `Kill attempt: ${killResult.message}. `;
            if (!killResult.success && killResult.stderr) { 
                responseMessage += `Stderr: ${killResult.stderr}. `;
                // Decide if we should stop if kill fails significantly
            }

            // Launch new
            const launchResult = await propsManager.executeCommand(userId, launchCommand);
            responseMessage += `Launch attempt: ${launchResult.message}`;
            if (!launchResult.success && launchResult.stderr) {
                responseMessage += ` Stderr: ${launchResult.stderr}`;
            }

            return { 
                success: launchResult.success, // Success of the launch command itself primarily
                message: responseMessage.trim()
            };
        } catch (error: any) {
            return { success: false, error: `Failed to launch dev server for user ${userId} in ${projectRoot}: ${error.message}` };
        }
    }
});

export const terminalCheckDevServerStatus = tool({
    description: 'Checks if an "npm run dev" process is currently running on the remote server for the user.',
    parameters: z.object({
        userId: z.string().describe("The ID of the user whose SSH session is being used."),
        // projectRoot: z.string().optional().describe("Optional: Project root to narrow down the search, though command is generic.")
    }),
    execute: async ({ userId }) => {
        try {
            if (!propsManager.isSSHConnected(userId)) {
                return { success: false, error: `SSH session for user ${userId} is not active.` };
            }
            const command = "ps aux | grep 'npm run dev' | grep -v grep";
            const result = await propsManager.executeCommand(userId, command);
            const isRunning = result.success && result.stdout && result.stdout.trim().length > 0;
            const message = isRunning 
                ? `An 'npm run dev' process appears to be running. Details: ${result.stdout?.trim()}` 
                : `No 'npm run dev' process found running (or an error occurred: ${result.stderr || result.message}).`;
            return { 
                success: result.success, // Based on command execution, not presence of process
                isRunning: isRunning,
                message: message,
                stdout: result.stdout,
                stderr: result.stderr
            };
        } catch (error: any) {
            return { success: false, isRunning: false, error: `Failed to check dev server status for user ${userId}: ${error.message}` };
        }
    }
});

export const terminalReadDevLog = tool({
    description: 'Reads the content of the npm_dev.log file from a specified project root directory on the remote server.',
    parameters: z.object({
        userId: z.string().describe("User ID."),
        projectRoot: z.string().describe("The absolute path to the project's root directory where npm_dev.log is located."),
    }),
    execute: async ({ userId, projectRoot }) => {
        try {
            if (!propsManager.isSSHConnected(userId)) {
                return { success: false, error: `SSH session for user ${userId} is not active.` };
            }
            const logFilePath = `${projectRoot.replace(/\/$/, '')}/npm_dev.log`;
            const result = await propsManager.readRemoteFile(userId, logFilePath);
            if (result.success) {
                return { success: true, content: result.content || "(Log file is empty)", message: result.message };
            } else {
                // Check if error is due to file not existing, which is a common scenario
                if (result.message.includes('No such file or directory')) {
                    return { success: true, content: "(Log file not found. Server might not have started or logged anything yet.)", message: "Log file not found." };
                }
                return { success: false, error: result.message, content: null };
            }
        } catch (error: any) {
            return { success: false, error: `Failed to read dev log for user ${userId} from ${projectRoot}: ${error.message}`, content: null };
        }
    }
});

export const terminalReadCommandLog = tool({
    description: 'Reads the command execution history for the current user\'s SSH session.',
    parameters: z.object({
        userId: z.string().describe("The ID of the user whose command log is to be retrieved."),
    }),
    execute: async ({ userId }) => {
        try {
            // isSSHConnected check might not be strictly necessary if we just want to see historical logs even for disconnected session.
            // However, PropsManager.getCommandLog(userId) will return empty if session doesn't exist.
            const logEntries = propsManager.getCommandLog(userId);
            if (!logEntries || logEntries.length === 0) {
                return { success: true, message: "No commands logged for this user session yet.", log: [] };
            }
            // Format for better readability if sending as a single string, or return structured log.
            const formattedLog = logEntries.map(entry => 
                `[${new Date(entry.timestamp).toISOString()}] ${entry.success ? '✅' : '❌'} ${entry.command}` +
                `${entry.stdout ? `\n  STDOUT: ${entry.stdout.substring(0, 100)}${entry.stdout.length > 100 ? '...' : ''}` : ''}` +
                `${entry.stderr ? `\n  STDERR: ${entry.stderr.substring(0, 100)}${entry.stderr.length > 100 ? '...' : ''}` : ''}`
            ).join('\n---\n');
            return { 
                success: true, 
                message: `Retrieved ${logEntries.length} command log entries.`, 
                log: formattedLog, // Or return logEntries directly for structured data
                // rawLog: logEntries 
            };
        } catch (error: any) {
            return { success: false, error: `Failed to read command log for user ${userId}: ${error.message}` };
        }
    }
});

// Group all terminal tools
export const terminalTools = {
    terminalExecuteCommand,
    // terminalEditFile,
    // terminalReadFile,
    // terminalInitializeSsh,
    // terminalDisconnectSsh,
    terminalLaunchDevServer,
    terminalCheckDevServerStatus,
    terminalReadDevLog,
    terminalReadCommandLog,
};

export default terminalTools;
