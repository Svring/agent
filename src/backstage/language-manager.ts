import { propsManager, SSHCredentials } from '@/backstage/props-manager';
import { Project } from '@/payload-types'; // Assuming Payload CMS generated types are here
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getProjectById } from '../db/actions/projects-actions'; // Corrected import path

// Augment global for HMR-safe singleton in dev
declare global {
  // eslint-disable-next-line no-var
  var languageManagerInstance: LanguageManager | undefined;
}

interface GalateaExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  message: string;
  exitCode?: number;
}

interface GalateaServerInfo {
  userId: string;
  pid?: number;
  port?: number;
  url?: string;
  startTime: Date;
  status: 'starting' | 'running' | 'stopped' | 'error';
  lastError?: string;
  initialOutput?: string;
}

export class LanguageManager {
  private static instance: LanguageManager;
  private activeUserProjects: Map<string, string>; // userId -> projectId
  private galateaExecutionResults: Map<string, GalateaExecutionResult>; // userId -> latest execution result
  private galateaServers: Map<string, GalateaServerInfo>; // userId -> server info

  private constructor() {
    this.activeUserProjects = new Map();
    this.galateaExecutionResults = new Map();
    this.galateaServers = new Map();
    console.log("[LanguageManager] Initialized.");
  }

  public static getInstance(): LanguageManager {
    if (process.env.NODE_ENV === 'production') {
      if (!LanguageManager.instance) {
        LanguageManager.instance = new LanguageManager();
      }
      return LanguageManager.instance;
    } else {
      if (!global.languageManagerInstance) {
        global.languageManagerInstance = new LanguageManager();
      }
      return global.languageManagerInstance;
    }
  }

  public setActiveProject(userId: string, projectId: string): void {
    if (!userId || !projectId) {
      console.warn("[LanguageManager] Attempted to set active project with invalid userId or projectId.");
      return;
    }
    this.activeUserProjects.set(userId, projectId);
    console.log(`[LanguageManager] User ${userId} active project set to ${projectId}`);
  }

  public getActiveProject(userId: string): string | undefined {
    return this.activeUserProjects.get(userId);
  }

  public getLatestGalateaResult(userId: string): GalateaExecutionResult | null {
    return this.galateaExecutionResults.get(userId) || null;
  }

  public getGalateaServerInfo(userId: string): GalateaServerInfo | null {
    return this.galateaServers.get(userId) || null;
  }

  public async uploadGalateaToDev(userId: string, project: Project): Promise<{ success: boolean; message: string }> {
    if (!userId) return { success: false, message: "User ID is required." };
    if (!project || !project.id) return { success: false, message: "Project information is required." };
    
    const projectNameForLog = project.name || project.id;

    if (!project.dev_address || project.dev_address.length === 0 || !project.dev_address[0]) {
      return { success: false, message: `Project '${projectNameForLog}' does not have a primary development environment address configured.` };
    }

    const devEnv = project.dev_address[0];
    const sshCredentials: SSHCredentials = {
      host: devEnv.address || undefined,
      port: devEnv.port ? Number(devEnv.port) : undefined,
      username: devEnv.username || undefined,
      password: devEnv.password || undefined, 
    };

    // Check if essential credentials are provided (host, username, and password)
    // Based on Project collection, privateKeyPath is not part of dev_address, so we rely on password.
    if (!sshCredentials.host || !sshCredentials.username || !sshCredentials.password) { 
         return { success: false, message: `Incomplete SSH credentials (host, username, password) for project '${projectNameForLog}' dev environment.` };
    }

    console.log(`[LanguageManager] User ${userId} attempting to upload Galatea to project '${projectNameForLog}' (${sshCredentials.host})`);

    const initResult = await propsManager.initializeSSH(userId, sshCredentials);
    if (!initResult.success || !propsManager.isSSHConnected(userId)) {
      return { success: false, message: `Failed to initialize SSH to dev environment for '${projectNameForLog}': ${initResult.message}` };
    }
    console.log(`[LanguageManager] SSH initialized for ${userId} to ${sshCredentials.host}. CWD: ${initResult.data?.cwd}`);

    const localBinaryPath = path.join(process.cwd(), 'public', 'bin', 'galatea_for_linux');
    const remoteBinaryPath = '/home/devbox/galatea_for_linux';

    if (!fs.existsSync(localBinaryPath)) {
      return { success: false, message: `Local binary not found at ${localBinaryPath}` };
    }
    
    console.log(`[LanguageManager] Uploading ${localBinaryPath} to ${remoteBinaryPath} for user ${userId} on project '${projectNameForLog}'`);

    const uploadResult = await propsManager.uploadFileToRemote(userId, localBinaryPath, remoteBinaryPath);

    if (uploadResult.success) {
      console.log(`[LanguageManager] Galatea uploaded successfully for user ${userId} to project '${projectNameForLog}' at ${remoteBinaryPath}.`);
      
      const chmodResult = await propsManager.executeCommand(userId, `chmod +x ${remoteBinaryPath}`);
      if (chmodResult.success) {
        console.log(`[LanguageManager] Galatea set to executable at ${remoteBinaryPath} for user ${userId} on project '${projectNameForLog}'.`);
        return { success: true, message: `Galatea uploaded to ${remoteBinaryPath} and set to executable.` };
      } else {
        console.warn(`[LanguageManager] Galatea uploaded to '${projectNameForLog}', but failed to chmod: ${chmodResult.stderr}`);
        return { success: true, message: `Galatea uploaded to ${remoteBinaryPath}, but chmod failed: ${chmodResult.stderr || 'Unknown error'}` };
      }
    } else {
      console.error(`[LanguageManager] Failed to upload Galatea for user ${userId} to project '${projectNameForLog}': ${uploadResult.message}`);
      return { success: false, message: `Failed to upload Galatea to project '${projectNameForLog}': ${uploadResult.message}` };
    }
  }

  public async executeGalatea(userId: string, args: string[] = []): Promise<GalateaExecutionResult> {
    if (!userId) {
      const result: GalateaExecutionResult = {
        success: false,
        stdout: '',
        stderr: 'User ID is required.',
        message: 'User ID is required.'
      };
      return result;
    }

    if (!propsManager.isSSHConnected(userId)) {
      const result: GalateaExecutionResult = {
        success: false,
        stdout: '',
        stderr: 'SSH not connected.',
        message: 'SSH connection is required to execute Galatea.'
      };
      return result;
    }

    const remoteBinaryPath = '/home/devbox/galatea_for_linux';
    
    // Check if the file exists and is executable
    const checkResult = await propsManager.executeCommand(
      userId,
      `test -f ${remoteBinaryPath} && test -x ${remoteBinaryPath} && echo "ready" || echo "not_ready"`
    );

    if (!checkResult.success || checkResult.stdout?.trim() !== "ready") {
      const result: GalateaExecutionResult = {
        success: false,
        stdout: checkResult.stdout || '',
        stderr: checkResult.stderr || 'Galatea binary not found or not executable.',
        message: 'Galatea binary not found or not executable. Please upload it first.'
      };
      this.galateaExecutionResults.set(userId, result);
      return result;
    }

    // Prepare the command with arguments
    const argsString = args.map(arg => `"${arg.replace(/"/g, '\"')}"`).join(' ');
    const remoteDir = path.dirname(remoteBinaryPath);
    const binaryName = path.basename(remoteBinaryPath);
    const command = `cd ${remoteDir} && ./${binaryName} ${argsString}`;
    
    console.log(`[LanguageManager] Executing Galatea for user ${userId} with command: ${command}`);
    
    try {
      const execResult = await propsManager.executeCommand(userId, command);
      
      const result: GalateaExecutionResult = {
        success: execResult.success,
        stdout: execResult.stdout || '',
        stderr: execResult.stderr || '',
        message: execResult.success 
          ? 'Galatea executed successfully.' 
          : `Galatea execution failed: ${execResult.stderr || 'Unknown error'}`
      };
      
      console.log(`[LanguageManager] Galatea execution for user ${userId} completed. Success: ${result.success}`);
      if (result.stdout) {
        console.log(`[LanguageManager] Galatea stdout: ${result.stdout.substring(0, 200)}${result.stdout.length > 200 ? '...' : ''}`);
      }
      if (result.stderr) {
        console.error(`[LanguageManager] Galatea stderr: ${result.stderr.substring(0, 200)}${result.stderr.length > 200 ? '...' : ''}`);
      }
      
      this.galateaExecutionResults.set(userId, result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[LanguageManager] Error executing Galatea for user ${userId}:`, error);
      
      const result: GalateaExecutionResult = {
        success: false,
        stdout: '',
        stderr: errorMessage,
        message: `Error executing Galatea: ${errorMessage}`
      };
      
      this.galateaExecutionResults.set(userId, result);
      return result;
    }
  }

  public async startGalateaServer(userId: string, port: number = 3051, args: string[] = []): Promise<{ success: boolean; message: string; serverInfo?: GalateaServerInfo }> {
    if (!userId) {
      return { success: false, message: 'User ID is required.' };
    }

    if (!propsManager.isSSHConnected(userId)) {
      return { success: false, message: 'SSH connection is required to start Galatea server.' };
    }

    // Check if server is already running for this user
    const existingServer = this.galateaServers.get(userId);
    if (existingServer && existingServer.status === 'running') {
      return { 
        success: true, 
        message: `Galatea server is already running on port ${existingServer.port}`,
        serverInfo: existingServer
      };
    }

    const remoteBinaryPath = '/home/devbox/galatea_for_linux';
    
    // Check if the file exists and is executable
    const checkResult = await propsManager.executeCommand(
      userId,
      `test -f ${remoteBinaryPath} && test -x ${remoteBinaryPath} && echo "ready" || echo "not_ready"`
    );

    if (!checkResult.success || checkResult.stdout?.trim() !== "ready") {
      return { 
        success: false, 
        message: 'Galatea binary not found or not executable. Please upload it first.' 
      };
    }

    // Create a server info object
    const serverInfo: GalateaServerInfo = {
      userId,
      port,
      startTime: new Date(),
      status: 'starting'
    };
    
    this.galateaServers.set(userId, serverInfo);

    // First, ensure the port is free before starting
    await propsManager.executeCommand(userId, `lsof -i :${port} -t | xargs kill -9 2>/dev/null || true`);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for port to be released

    // Check if the port is free now
    const portCheckResult = await propsManager.executeCommand(userId, `lsof -i :${port} || echo "PORT_FREE"`);
    const isPortFree = portCheckResult.stdout?.includes('PORT_FREE') || 
                       (!portCheckResult.stdout || portCheckResult.stdout.trim() === '');
                       
    if (!isPortFree) {
      serverInfo.status = 'error';
      serverInfo.lastError = `Port ${port} is still in use, cannot start Galatea server`;
      this.galateaServers.set(userId, serverInfo);
      return {
        success: false,
        message: `Port ${port} is already in use and could not be freed. Please try again later.`,
        serverInfo
      };
    }
    
    // Prepare the command with arguments. args should be empty by default from API.
    // const argsString = args.map(arg => `"${arg.replace(/"/g, '\"')}"`).join(' ');
    
    // Start the server in the background with nohup
    const remoteDir = path.dirname(remoteBinaryPath);
    const binaryName = path.basename(remoteBinaryPath);
    const startCommand = `cd ${remoteDir} && nohup ./${binaryName} > galatea_server.log 2>&1 & echo $!`;
    
    console.log(`[LanguageManager] Starting Galatea server for user ${userId} with command: ${startCommand}`);
    
    try {
      // Execute the command to start the server in the background
      const execResult = await propsManager.executeCommand(userId, startCommand);
      
      if (!execResult.success || !execResult.stdout) {
        serverInfo.status = 'error';
        serverInfo.lastError = execResult.stderr || 'Failed to start server';
        this.galateaServers.set(userId, serverInfo);
        return { 
          success: false, 
          message: `Failed to start Galatea server: ${execResult.stderr || 'Unknown error'}` 
        };
      }
      
      // Get the PID from the command output
      const pid = parseInt(execResult.stdout.trim(), 10);
      if (isNaN(pid)) {
        serverInfo.status = 'error';
        serverInfo.lastError = 'Invalid PID returned';
        this.galateaServers.set(userId, serverInfo);
        return { 
          success: false, 
          message: 'Failed to get PID of Galatea server process' 
        };
      }
      
      // Wait for the server to start
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if the process is still running
      const pidCheckResult = await propsManager.executeCommand(userId, `ps -p ${pid} > /dev/null && echo "running" || echo "stopped"`);
      if (pidCheckResult.stdout?.trim() !== "running") {
        // The process has already stopped - likely due to errors
        // Get the last few lines of the log to see what happened
        const logResult = await propsManager.executeCommand(userId, `cd ${remoteDir} && tail -n 20 galatea_server.log`);
        serverInfo.status = 'error';
        serverInfo.lastError = `Process terminated immediately. Log: ${logResult.stdout || 'No log available'}`;
        this.galateaServers.set(userId, serverInfo);
        return {
          success: false,
          message: `Galatea process failed to start and terminated immediately. Check logs for details.`,
          serverInfo
        };
      }
      
      // Update server info
      serverInfo.pid = pid;
      serverInfo.status = 'running';
      serverInfo.url = `http://localhost:${port}`;
      this.galateaServers.set(userId, serverInfo);
      
      console.log(`[LanguageManager] Galatea server started for user ${userId} with PID ${pid} on port ${port}`);

      // Attempt to get initial output
      try {
        // Wait a brief moment for logs to populate
        await new Promise(resolve => setTimeout(resolve, 500)); 
        const logTailResult = await propsManager.executeCommand(userId, `cd ${remoteDir} && tail -n 20 galatea_server.log`);
        if (logTailResult.success && logTailResult.stdout) {
          serverInfo.initialOutput = logTailResult.stdout.trim();
          this.galateaServers.set(userId, serverInfo); // Update with initial output
           console.log(`[LanguageManager] Captured initial output for server PID ${pid}: ${serverInfo.initialOutput.substring(0, 100)}...`);
        } else if (!logTailResult.success) {
          console.warn(`[LanguageManager] Failed to fetch initial logs for server PID ${pid}: ${logTailResult.stderr}`);
        }
      } catch (logError) {
        console.warn(`[LanguageManager] Error fetching initial logs for server PID ${pid}:`, logError);
      }
      
      return { 
        success: true, 
        message: `Galatea server started with PID ${pid} on port ${port}`,
        serverInfo
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[LanguageManager] Error starting Galatea server for user ${userId}:`, error);
      
      serverInfo.status = 'error';
      serverInfo.lastError = errorMessage;
      this.galateaServers.set(userId, serverInfo);
      
      return { 
        success: false, 
        message: `Error starting Galatea server: ${errorMessage}` 
      };
    }
  }

  public async stopGalateaServer(userId: string): Promise<{ success: boolean; message: string }> {
    if (!userId) {
      return { success: false, message: 'User ID is required.' };
    }

    if (!propsManager.isSSHConnected(userId)) {
      return { success: false, message: 'SSH connection is required to stop Galatea server.' };
    }

    // Check if server is running for this user
    const serverInfo = this.galateaServers.get(userId);
    if (!serverInfo || serverInfo.status !== 'running' || !serverInfo.pid) {
      return { success: false, message: 'No running Galatea server found for this user.' };
    }

    console.log(`[LanguageManager] Stopping Galatea server for user ${userId} with PID ${serverInfo.pid}`);
    
    try {
      // Kill the process
      const killCommand = `kill ${serverInfo.pid} && echo "killed" || echo "failed"`;
      const execResult = await propsManager.executeCommand(userId, killCommand);
      
      if (!execResult.success || execResult.stdout?.trim() !== "killed") {
        return { 
          success: false, 
          message: `Failed to stop Galatea server: ${execResult.stderr || 'Unknown error'}` 
        };
      }
      
      // Update server info
      serverInfo.status = 'stopped';
      this.galateaServers.set(userId, serverInfo);
      
      console.log(`[LanguageManager] Galatea server stopped for user ${userId} with PID ${serverInfo.pid}`);
      
      return { 
        success: true, 
        message: `Galatea server with PID ${serverInfo.pid} stopped successfully` 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[LanguageManager] Error stopping Galatea server for user ${userId}:`, error);
      
      return { 
        success: false, 
        message: `Error stopping Galatea server: ${errorMessage}` 
      };
    }
  }

  public async checkGalateaServerStatus(userId: string): Promise<{ success: boolean; message: string; serverInfo?: GalateaServerInfo }> {
    if (!userId) {
      return { success: false, message: 'User ID is required.' };
    }

    if (!propsManager.isSSHConnected(userId)) {
      return { success: false, message: 'SSH connection is required to check Galatea server status.' };
    }

    // Check if server info exists for this user
    const serverInfo = this.galateaServers.get(userId);
    if (!serverInfo || !serverInfo.pid) {
      return { success: false, message: 'No Galatea server information found for this user.' };
    }

    console.log(`[LanguageManager] Checking Galatea server status for user ${userId} with PID ${serverInfo.pid}`);
    
    try {
      // Check if process is running
      const checkCommand = `ps -p ${serverInfo.pid} > /dev/null && echo "running" || echo "stopped"`;
      const execResult = await propsManager.executeCommand(userId, checkCommand);
      
      const isRunning = execResult.success && execResult.stdout?.trim() === "running";
      
      // Update server info
      serverInfo.status = isRunning ? 'running' : 'stopped';
      this.galateaServers.set(userId, serverInfo);
      
      console.log(`[LanguageManager] Galatea server for user ${userId} is ${serverInfo.status}`);
      
      return { 
        success: true, 
        message: `Galatea server is ${serverInfo.status}`,
        serverInfo
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[LanguageManager] Error checking Galatea server status for user ${userId}:`, error);
      
      return { 
        success: false, 
        message: `Error checking Galatea server status: ${errorMessage}` 
      };
    }
  }

  public async getGalateaServerLogs(userId: string, lines: number = 100): Promise<{ success: boolean; message: string; logs?: string }> {
    if (!userId) {
      return { success: false, message: 'User ID is required.' };
    }

    if (!propsManager.isSSHConnected(userId)) {
      return { success: false, message: 'SSH connection is required to get Galatea server logs.' };
    }

    console.log(`[LanguageManager] Getting Galatea server logs for user ${userId}`);
    
    try {
      // Get the last N lines of the log file
      const logCommand = `tail -n ${lines} galatea_server.log`;
      const execResult = await propsManager.executeCommand(userId, logCommand);
      
      if (!execResult.success) {
        return { 
          success: false, 
          message: `Failed to get Galatea server logs: ${execResult.stderr || 'Unknown error'}` 
        };
      }
      
      return { 
        success: true, 
        message: 'Galatea server logs retrieved successfully',
        logs: execResult.stdout || 'No logs found'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[LanguageManager] Error getting Galatea server logs for user ${userId}:`, error);
      
      return { 
        success: false, 
        message: `Error getting Galatea server logs: ${errorMessage}` 
      };
    }
  }

  public async configureNextJsRewriteAndTestGalatea(
    userId: string,
    galateaPortForNextJsProxy: number = 3051
  ): Promise<{
    success: boolean;
    message: string;
    configUpdated?: boolean;
    healthCheck?: {
      success: boolean;
      url: string;
      status?: number;
      data?: string;
      error?: string;
    };
  }> {
    if (!userId) {
      return { success: false, message: "User ID is required." };
    }

    const activeProjectId = this.getActiveProject(userId);
    if (!activeProjectId) {
      return { success: false, message: "No active project set for the user." };
    }

    let projectDetails;
    try {
      projectDetails = await getProjectById(activeProjectId);
      if (!projectDetails) {
        return { success: false, message: `Project with ID ${activeProjectId} not found.` };
      }
    } catch (e) {
      return { success: false, message: `Failed to fetch project details for ID ${activeProjectId}: ${e instanceof Error ? e.message : String(e)}` };
    }

    const productionUrl = projectDetails?.production_address; // Use production_address from projectDetails

    if (!propsManager.isSSHConnected(userId)) {
      // Optionally, attempt to connect if devAddress is available
      // For now, require connection to be pre-established.
      return { success: false, message: "SSH not connected. Please connect SSH first." };
    }

    // Assumption: project is located at /home/devbox/project/
    const remoteProjectBasePath = '/home/devbox/project';
    const remoteNextConfigPath = path.join(remoteProjectBasePath, 'next.config.mjs');

    const targetRewriteDestination = `http://127.0.0.1:${galateaPortForNextJsProxy}/:path*`;
    const nextConfigSourceContent = `/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Added output standalone as it's common for Dockerized Next.js
  async rewrites() {
    return [
      {
        source: '/galatea/:path*',
        destination: '${targetRewriteDestination}',
      },
      // Preserve other rewrites if any - this simple overwrite won't do that.
      // A more sophisticated approach would parse and modify the AST or use regex.
    ]
  },
};

export default nextConfig;
`;

    let configUpdated = false;
    try {
      console.log(`[LanguageManager] Checking Next.js config at ${remoteNextConfigPath} for user ${userId}`);
      const readResult = await propsManager.executeCommand(userId, `cat ${remoteNextConfigPath}`);

      let needsUpdate = true;
      if (readResult.success && readResult.stdout) {
        if (readResult.stdout.includes(targetRewriteDestination)) {
          console.log(`[LanguageManager] Next.js config already contains rewrite for port ${galateaPortForNextJsProxy}.`);
          needsUpdate = false;
        } else {
          console.log(`[LanguageManager] Next.js config found, but Galatea rewrite for port ${galateaPortForNextJsProxy} is missing or different.`);
        }
      } else {
        console.log(`[LanguageManager] Next.js config not found at ${remoteNextConfigPath} or failed to read. Will create/overwrite.`);
      }

      if (needsUpdate) {
        console.log(`[LanguageManager] Updating Next.js config at ${remoteNextConfigPath}`);
        const tempFilePath = path.join(os.tmpdir(), `next.config.mjs.${Date.now()}`);
        fs.writeFileSync(tempFilePath, nextConfigSourceContent);

        // Ensure the directory exists on the remote server
        const ensureDirResult = await propsManager.executeCommand(userId, `mkdir -p ${remoteProjectBasePath}`);
        if (!ensureDirResult.success) {
          throw new Error(`Failed to create project directory ${remoteProjectBasePath} on remote: ${ensureDirResult.stderr}`);
        }

        const uploadResult = await propsManager.uploadFileToRemote(userId, tempFilePath, remoteNextConfigPath);
        fs.unlinkSync(tempFilePath); // Clean up temp file

        if (!uploadResult.success) {
          throw new Error(`Failed to upload next.config.mjs: ${uploadResult.message}`);
        }
        configUpdated = true;
        console.log(`[LanguageManager] Successfully updated ${remoteNextConfigPath}.`);
      }
    } catch (error) {
      const msg = `Error managing next.config.mjs: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[LanguageManager] ${msg}`);
      return { success: false, message: msg };
    }

    let healthCheckResult;
    // Placeholder for productionUrl - this needs to come from project details
    // const productionUrl = "YOUR_PROJECT_PRODUCTION_URL_HERE"; // Replace with actual project.production_url
    // For now, we cannot proceed with health check without production_url
    // const productionUrl: string | null = null; // Simulate unavailable production URL, explicitly type for clarity

    if (productionUrl) { // This check ensures productionUrl is a string, as null/undefined are falsy
      const healthCheckUrl = `${productionUrl.replace(/\/$/, '')}/galatea/health`;
      console.log(`[LanguageManager] Performing health check on ${healthCheckUrl}`);
      try {
        const response = await fetch(healthCheckUrl);
        const responseText = await response.text();
        healthCheckResult = {
          success: response.ok,
          url: healthCheckUrl,
          status: response.status,
          data: responseText,
        };
        console.log(`[LanguageManager] Health check to ${healthCheckUrl} status: ${response.status}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[LanguageManager] Health check to ${healthCheckUrl} failed: ${errorMsg}`);
        healthCheckResult = {
          success: false,
          url: healthCheckUrl,
          error: errorMsg,
        };
      }
    } else {
      console.warn("[LanguageManager] Production URL for project not available. Skipping Galatea health check via production URL.");
    }

    let message = configUpdated
      ? "next.config.mjs processed. IMPORTANT: Restart your Next.js dev server on the remote machine for changes to take effect."
      : "next.config.mjs already contains the Galatea rewrite for the specified port.";

    if (!productionUrl) { // If productionUrl is null or empty string (though we check for null above)
      message += " Production URL not configured, so Galatea health check via production URL was skipped."
    }


    return {
      success: true,
      message,
      configUpdated,
      healthCheck: healthCheckResult,
    };
  }

  /**
   * Check if Galatea is properly functioning by testing the API endpoint directly
   * This is useful for direct checks without waiting for the monitor cycle
   */
  public async checkGalateaFunctioning(userId: string): Promise<{ 
    success: boolean; 
    message: string; 
    healthy: boolean;
    logs?: string;
  }> {
    if (!userId) {
      return { success: false, message: "User ID is required.", healthy: false };
    }

    if (!propsManager.isSSHConnected(userId)) {
      return { success: false, message: "SSH not connected. Please connect SSH first.", healthy: false };
    }

    const activeProjectId = this.getActiveProject(userId);
    if (!activeProjectId) {
      return { success: false, message: "No active project set for the user.", healthy: false };
    }

    let projectDetails;
    try {
      projectDetails = await getProjectById(activeProjectId);
      if (!projectDetails) {
        return { success: false, message: `Project with ID ${activeProjectId} not found.`, healthy: false };
      }
    } catch (e) {
      return { success: false, message: `Failed to fetch project details: ${e instanceof Error ? e.message : String(e)}`, healthy: false };
    }

    // First, check if we can detect the process
    const findProcessCommand = `ps aux | grep "[g]alatea_for_linux" || echo "NOT_RUNNING"`;
    const processResult = await propsManager.executeCommand(userId, findProcessCommand);
    
    const isProcessRunning = !processResult.stdout?.includes('NOT_RUNNING');
    console.log(`[LanguageManager] Galatea process check: ${isProcessRunning ? 'RUNNING' : 'NOT RUNNING'}`);
    
    // Next, check if the port is in use
    const portCheckCommand = `netstat -tuln | grep :3051 || echo "PORT_FREE"`;
    const portResult = await propsManager.executeCommand(userId, portCheckCommand);
    
    const isPortBound = !portResult.stdout?.includes('PORT_FREE');
    console.log(`[LanguageManager] Galatea port check: ${isPortBound ? 'BOUND' : 'NOT BOUND'}`);
    
    // Get the latest logs
    const logCommand = `cd /home/devbox && tail -n 40 galatea_server.log`;
    const logResult = await propsManager.executeCommand(userId, logCommand);
    const logs = logResult.success ? logResult.stdout : "Could not retrieve logs";
    
    // See if we find error patterns in logs
    const hasBindError = logs?.includes("Address already in use");
    const wasTerminated = logs?.includes("Terminated") || logs?.includes("Killed");
    
    let healthy = isProcessRunning && isPortBound && !hasBindError && !wasTerminated;
    let message = healthy 
      ? "Galatea service appears to be running properly" 
      : "Galatea service is not functioning correctly";
    
    if (!healthy) {
      if (hasBindError) message += ". Port binding error detected";
      if (wasTerminated) message += ". Process was terminated";
      if (!isProcessRunning) message += ". Process not found";
      if (!isPortBound) message += ". Port not bound";
    }
    
    return {
      success: true,
      message,
      healthy,
      logs
    };
  }

  /**
   * Monitor and ensure Galatea service is running by performing health checks and recovery.
   * @param userId The user ID
   * @param checkIntervalMs How often to check, in milliseconds (default: 30000 = 30 seconds)
   * @param maxRetries Maximum number of recovery attempts per check (default: 3)
   * @returns An object containing information about the monitoring session
   */
  public async monitorAndEnsureGalateaService(
    userId: string,
    checkIntervalMs: number = 30000,
    maxRetries: number = 3
  ): Promise<{
    success: boolean;
    message: string;
    monitoringStarted: boolean;
    stopMonitoring?: () => void;
  }> {
    if (!userId) {
      return { success: false, message: "User ID is required.", monitoringStarted: false };
    }

    const activeProjectId = this.getActiveProject(userId);
    if (!activeProjectId) {
      return { success: false, message: "No active project set for the user.", monitoringStarted: false };
    }

    let projectDetails;
    try {
      projectDetails = await getProjectById(activeProjectId);
      if (!projectDetails) {
        return { success: false, message: `Project with ID ${activeProjectId} not found.`, monitoringStarted: false };
      }
    } catch (e) {
      return {
        success: false,
        message: `Failed to fetch project details for ID ${activeProjectId}: ${e instanceof Error ? e.message : String(e)}`,
        monitoringStarted: false
      };
    }

    const productionUrl = projectDetails?.production_address;
    if (!productionUrl) {
      return {
        success: false,
        message: "Production address not configured for the project. Required for health monitoring.",
        monitoringStarted: false
      };
    }

    if (!propsManager.isSSHConnected(userId)) {
      return { success: false, message: "SSH not connected. Please connect SSH first.", monitoringStarted: false };
    }

    // Initialize monitoring state
    let isMonitoring = true;
    let checkCount = 0;
    let consecutiveFailures = 0;
    const GALATEA_PORT = 3051; // Hard-coded port for Galatea service

    const performHealthCheck = async (): Promise<boolean> => {
      checkCount++;
      console.log(`[LanguageManager] Performing health check #${checkCount} for Galatea service for user ${userId}`);

      const healthCheckUrl = `${productionUrl.replace(/\/$/, '')}/galatea/api/health`;
      try {
        const response = await fetch(healthCheckUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          // Set a timeout to prevent hanging
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });

        if (response.ok) {
          console.log(`[LanguageManager] Health check #${checkCount} successful: ${response.status}`);
          consecutiveFailures = 0; // Reset failure counter on success
          return true;
        } else {
          console.warn(`[LanguageManager] Health check #${checkCount} failed with status: ${response.status}`);
          consecutiveFailures++;
          return false;
        }
      } catch (error) {
        console.error(`[LanguageManager] Health check #${checkCount} error: ${error instanceof Error ? error.message : String(error)}`);
        consecutiveFailures++;
        return false;
      }
    };

    const attemptServiceRecovery = async (): Promise<boolean> => {
      console.log(`[LanguageManager] Attempting recovery for Galatea service after ${consecutiveFailures} consecutive failed health checks`);

      try {
        // Step 1: Check if port 3051 is already in use
        const portCheckCommand = `lsof -i :${GALATEA_PORT} || netstat -tuln | grep ${GALATEA_PORT} || echo "PORT_FREE"`;
        const portCheckResult = await propsManager.executeCommand(userId, portCheckCommand);

        const isPortFree = portCheckResult.stdout?.includes('PORT_FREE') ||
          (!portCheckResult.stdout || portCheckResult.stdout.trim() === '');

        if (!isPortFree) {
          console.log(`[LanguageManager] Port ${GALATEA_PORT} appears to be in use:`);
          console.log(portCheckResult.stdout);
          
          // Try to identify the process using the port
          const findProcessCommand = `lsof -i :${GALATEA_PORT} -t || ps aux | grep galatea`;
          const findProcessResult = await propsManager.executeCommand(userId, findProcessCommand);
          console.log(`[LanguageManager] Process information for port ${GALATEA_PORT}:`);
          console.log(findProcessResult.stdout);
          
          // More aggressive process killing - first try a normal kill on all matching processes
          const killCommand = `pkill -f "galatea_for_linux" || true`;
          await propsManager.executeCommand(userId, killCommand);
          
          // Wait longer for processes to terminate
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Force kill any remaining processes using the port
          const forceKillCommand = `lsof -i :${GALATEA_PORT} -t | xargs kill -9 || true`;
          await propsManager.executeCommand(userId, forceKillCommand);
          
          // Wait again to ensure port is released by the OS
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Verify port is now free
          const verifyPortCommand = `lsof -i :${GALATEA_PORT} || echo "PORT_NOW_FREE"`;
          const verifyResult = await propsManager.executeCommand(userId, verifyPortCommand);
          
          if (!verifyResult.stdout?.includes('PORT_NOW_FREE') && 
              verifyResult.stdout && 
              verifyResult.stdout.trim() !== '') {
            console.error(`[LanguageManager] Failed to clear port ${GALATEA_PORT} after kill attempts`);
            console.log(verifyResult.stdout);
            return false;
          }
          
          console.log(`[LanguageManager] Successfully cleared port ${GALATEA_PORT}`);
        }

        // Step 2: Check if the binary exists, upload if necessary
        const remoteBinaryPath = '/home/devbox/galatea_for_linux';
        const fileCheckResult = await propsManager.executeCommand(
          userId,
          `test -f ${remoteBinaryPath} && echo "exists" || echo "not_exists"`
        );

        let binaryReady = false;
        if (fileCheckResult.success && fileCheckResult.stdout?.trim() === "exists") {
          // Check if executable
          const execCheckResult = await propsManager.executeCommand(
            userId,
            `test -x ${remoteBinaryPath} && echo "executable" || echo "not_executable"`
          );

          if (execCheckResult.success && execCheckResult.stdout?.trim() === "executable") {
            binaryReady = true;
          } else {
            // Make executable
            const chmodResult = await propsManager.executeCommand(userId, `chmod +x ${remoteBinaryPath}`);
            binaryReady = chmodResult.success;
          }
        } else {
          // Binary doesn't exist, upload it
          const uploadResult = await this.uploadGalateaToDev(userId, projectDetails);
          binaryReady = uploadResult.success;
        }

        if (!binaryReady) {
          console.error(`[LanguageManager] Failed to prepare Galatea binary during recovery`);
          return false;
        }

        // Step 3: Start the Galatea service
        const startResult = await this.startGalateaServer(userId, GALATEA_PORT, []);
        if (!startResult.success) {
          console.error(`[LanguageManager] Failed to start Galatea service during recovery: ${startResult.message}`);
          return false;
        }

        console.log(`[LanguageManager] Successfully recovered Galatea service`);
        return true;
      } catch (error) {
        console.error(`[LanguageManager] Error during service recovery: ${error instanceof Error ? error.message : String(error)}`);
        return false;
      }
    };

    // Setup health check and recovery loop
    const runMonitoringCycle = async () => {
      if (!isMonitoring) return;

      try {
        const isHealthy = await performHealthCheck();

        if (!isHealthy) {
          if (consecutiveFailures >= 2) { // Require at least 2 consecutive failures before attempting recovery
            let recoverySuccess = false;
            for (let retry = 0; retry < maxRetries && !recoverySuccess; retry++) {
              console.log(`[LanguageManager] Recovery attempt ${retry + 1}/${maxRetries}`);
              recoverySuccess = await attemptServiceRecovery();
              if (recoverySuccess) {
                console.log(`[LanguageManager] Recovery successful on attempt ${retry + 1}`);
                break;
              }

              // Wait between retry attempts
              if (retry < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, 5000));
              }
            }
          }
        }
      } catch (error) {
        console.error(`[LanguageManager] Error in monitoring cycle: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Schedule next check if still monitoring
      if (isMonitoring) {
        setTimeout(runMonitoringCycle, checkIntervalMs);
      }
    };

    // Start the monitoring loop
    runMonitoringCycle();

    // Return control to allow stopping monitoring
    const stopMonitoring = () => {
      if (isMonitoring) {
        console.log(`[LanguageManager] Stopping Galatea service monitoring for user ${userId}`);
        isMonitoring = false;
      }
    };

    return {
      success: true,
      message: `Galatea service monitoring started with ${checkIntervalMs}ms interval.`,
      monitoringStarted: true,
      stopMonitoring
    };
  }
}
