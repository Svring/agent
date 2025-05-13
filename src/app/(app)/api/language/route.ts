import { NextRequest, NextResponse } from 'next/server';
import { LanguageManager } from '@/backstage/language-manager';
import { getAuthenticatedUserId } from '@/lib/auth-utils';
import { getProjectById } from '@/db/actions/projects-actions';
import { propsManager } from '@/backstage/props-manager';

export async function POST(req: NextRequest) {
  const languageManager = LanguageManager.getInstance();
  let body: any;
  let authenticatedUserId: string | null = null;
  let action: string | undefined = undefined;

  try {
    authenticatedUserId = await getAuthenticatedUserId(req.headers);
    body = await req.json();
    action = body.action;

    console.log(`[Language API] User [${authenticatedUserId || 'unknown'}] requested action: ${action}`);

    if (!authenticatedUserId) {
      return NextResponse.json({ message: 'Authentication required for this action.' }, { status: 401 });
    }

    switch (action) {
      case 'setActiveProject': {
        const { projectId } = body;
        if (!projectId) {
          return NextResponse.json({ message: 'projectId is required' }, { status: 400 });
        }
        
        languageManager.setActiveProject(authenticatedUserId, projectId.toString());
        return NextResponse.json({ 
          success: true, 
          message: `Active project set to ${projectId} for user ${authenticatedUserId}` 
        });
      }

      case 'getActiveProject': {
        const activeProjectId = languageManager.getActiveProject(authenticatedUserId);
        return NextResponse.json({
          success: true,
          projectId: activeProjectId
        });
      }

      case 'uploadGalatea': {
        const { projectId, executeAfterUpload = false, startServer = true, port = 8000, args = [] } = body;
        if (!projectId) {
          return NextResponse.json({ message: 'projectId is required' }, { status: 400 });
        }

        try {
          // Get project details first
          const project = await getProjectById(projectId);
          if (!project) {
            return NextResponse.json({ 
              success: false, 
              message: `Project with ID ${projectId} not found` 
            }, { status: 404 });
          }

          // Check if the file already exists on the remote server
          const remoteBinaryPath = '/home/devbox/galatea_for_linux';
          
          // First check if SSH is connected for this user
          if (!propsManager.isSSHConnected(authenticatedUserId)) {
            return NextResponse.json({
              success: false,
              message: 'SSH not connected. Please connect SSH first.'
            }, { status: 400 });
          }

          // Check if the file already exists
          const fileCheckResult = await propsManager.executeCommand(
            authenticatedUserId, 
            `test -f ${remoteBinaryPath} && echo "exists" || echo "not_exists"`
          );
          
          let binaryReady = false;
          
          if (fileCheckResult.success && fileCheckResult.stdout?.trim() === "exists") {
            console.log(`[Language API] Galatea binary already exists at ${remoteBinaryPath} for user ${authenticatedUserId}`);
            
            // Check if the file is executable
            const execCheckResult = await propsManager.executeCommand(
              authenticatedUserId, 
              `test -x ${remoteBinaryPath} && echo "executable" || echo "not_executable"`
            );
            
            if (execCheckResult.success && execCheckResult.stdout?.trim() === "not_executable") {
              // Make it executable if it's not
              const chmodResult = await propsManager.executeCommand(authenticatedUserId, `chmod +x ${remoteBinaryPath}`);
              if (chmodResult.success) {
                binaryReady = true;
                console.log(`[Language API] Galatea binary made executable for user ${authenticatedUserId}`);
              } else {
                return NextResponse.json({
                  success: true,
                  message: `Galatea binary already exists but failed to make it executable: ${chmodResult.stderr || 'Unknown error'}`,
                  fileExists: true,
                  madeExecutable: false
                });
              }
            } else if (execCheckResult.success && execCheckResult.stdout?.trim() === "executable") {
              // File exists and is already executable
              binaryReady = true;
              console.log(`[Language API] Galatea binary is already executable for user ${authenticatedUserId}`);
            }
          } else {
            // If we get here, the file doesn't exist, so upload it
            console.log(`[Language API] Galatea binary doesn't exist, uploading for user ${authenticatedUserId}`);
            const uploadResult = await languageManager.uploadGalateaToDev(authenticatedUserId, project);
            
            if (!uploadResult.success) {
              return NextResponse.json({
                success: false,
                message: uploadResult.message,
                fileExists: false,
                uploaded: false
              }, { status: 500 });
            }
            
            binaryReady = true;
            console.log(`[Language API] Galatea binary uploaded and ready for user ${authenticatedUserId}`);
          }

          // If binary is ready, decide what to do next based on parameters
          if (binaryReady) {
            // If startServer is true, start the server
            if (startServer) {
              console.log(`[Language API] Starting Galatea server for user ${authenticatedUserId} on port ${port}`);
              const serverResult = await languageManager.startGalateaServer(authenticatedUserId, port, []);
              
              return NextResponse.json({
                success: serverResult.success,
                message: serverResult.message,
                fileExists: fileCheckResult.success && fileCheckResult.stdout?.trim() === "exists",
                uploaded: !(fileCheckResult.success && fileCheckResult.stdout?.trim() === "exists"),
                serverStarted: serverResult.success,
                serverInfo: serverResult.serverInfo
              });
            }
            
            // If executeAfterUpload is true, execute the binary once
            if (executeAfterUpload) {
              console.log(`[Language API] Executing Galatea binary for user ${authenticatedUserId} with args:`, args);
              const executionResult = await languageManager.executeGalatea(authenticatedUserId, []);
              
              return NextResponse.json({
                success: true,
                message: 'Galatea binary is ready and executed',
                fileExists: fileCheckResult.success && fileCheckResult.stdout?.trim() === "exists",
                uploaded: !(fileCheckResult.success && fileCheckResult.stdout?.trim() === "exists"),
                executed: true,
                executionSuccess: executionResult.success,
                stdout: executionResult.stdout,
                stderr: executionResult.stderr
              });
            }
            
            // If we didn't execute or start server, just return the status
            return NextResponse.json({
              success: true,
              message: 'Galatea binary is ready',
              fileExists: fileCheckResult.success && fileCheckResult.stdout?.trim() === "exists",
              uploaded: !(fileCheckResult.success && fileCheckResult.stdout?.trim() === "exists"),
              executed: false,
              serverStarted: false
            });
          }
          
          return NextResponse.json({
            success: false,
            message: 'Failed to prepare Galatea binary',
            fileExists: false,
            uploaded: false
          }, { status: 500 });
        } catch (error) {
          console.error(`[Language API] Error handling Galatea:`, error);
          return NextResponse.json({
            success: false,
            message: `Error handling Galatea: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }
      }

      case 'executeGalatea': {
        // Extract arguments from request body
        const { args = [] } = body;
        
        if (!Array.isArray(args)) {
          return NextResponse.json({
            success: false,
            message: 'Args must be an array of strings'
          }, { status: 400 });
        }

        try {
          // Execute the binary and get the result
          const result = await languageManager.executeGalatea(authenticatedUserId, args);
          
          return NextResponse.json({
            success: result.success,
            message: result.message,
            stdout: result.stdout,
            stderr: result.stderr,
            executed: true
          }, { status: result.success ? 200 : 500 });
        } catch (error) {
          console.error(`[Language API] Error executing Galatea:`, error);
          return NextResponse.json({
            success: false,
            message: `Error executing Galatea: ${error instanceof Error ? error.message : String(error)}`,
            executed: false
          }, { status: 500 });
        }
      }

      case 'startGalateaServer': {
        const { port = 8000, args = [] } = body;
        
        if (!Array.isArray(args)) {
          return NextResponse.json({
            success: false,
            message: 'Args must be an array of strings'
          }, { status: 400 });
        }

        try {
          // Start the server
          const result = await languageManager.startGalateaServer(authenticatedUserId, port, args);
          
          return NextResponse.json({
            success: result.success,
            message: result.message,
            serverInfo: result.serverInfo,
            serverStarted: result.success
          }, { status: result.success ? 200 : 500 });
        } catch (error) {
          console.error(`[Language API] Error starting Galatea server:`, error);
          return NextResponse.json({
            success: false,
            message: `Error starting Galatea server: ${error instanceof Error ? error.message : String(error)}`,
            serverStarted: false
          }, { status: 500 });
        }
      }

      case 'stopGalateaServer': {
        try {
          // Stop the server
          const result = await languageManager.stopGalateaServer(authenticatedUserId);
          
          return NextResponse.json({
            success: result.success,
            message: result.message,
            serverStopped: result.success
          }, { status: result.success ? 200 : 500 });
        } catch (error) {
          console.error(`[Language API] Error stopping Galatea server:`, error);
          return NextResponse.json({
            success: false,
            message: `Error stopping Galatea server: ${error instanceof Error ? error.message : String(error)}`,
            serverStopped: false
          }, { status: 500 });
        }
      }

      case 'checkGalateaServerStatus': {
        try {
          // Check server status
          const result = await languageManager.checkGalateaServerStatus(authenticatedUserId);
          
          return NextResponse.json({
            success: result.success,
            message: result.message,
            serverInfo: result.serverInfo
          }, { status: result.success ? 200 : 500 });
        } catch (error) {
          console.error(`[Language API] Error checking Galatea server status:`, error);
          return NextResponse.json({
            success: false,
            message: `Error checking Galatea server status: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }
      }

      case 'getGalateaServerLogs': {
        const { lines = 100 } = body;
        
        try {
          // Get server logs
          const result = await languageManager.getGalateaServerLogs(authenticatedUserId, lines);
          
          return NextResponse.json({
            success: result.success,
            message: result.message,
            logs: result.logs
          }, { status: result.success ? 200 : 500 });
        } catch (error) {
          console.error(`[Language API] Error getting Galatea server logs:`, error);
          return NextResponse.json({
            success: false,
            message: `Error getting Galatea server logs: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }
      }

      case 'getLatestGalateaResult': {
        const result = languageManager.getLatestGalateaResult(authenticatedUserId);
        
        if (!result) {
          return NextResponse.json({
            success: false,
            message: 'No Galatea execution results found for this user'
          });
        }
        
        return NextResponse.json({
          success: true,
          result: result
        });
      }

      case 'configureNextJsRewriteAndTestGalatea': {
        const { galateaPort } = body; // Optional port from request
        try {
          const result = await languageManager.configureNextJsRewriteAndTestGalatea(
            authenticatedUserId,
            galateaPort // if undefined, manager method default will be used
          );
          return NextResponse.json(result, { status: result.success ? 200 : 500 });
        } catch (error) {
          console.error(`[Language API] Error configuring Next.js rewrite:`, error);
          return NextResponse.json({
            success: false,
            message: `Error configuring Next.js rewrite: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }
      }

      case 'monitorGalateaService': {
        const { checkIntervalMs = 30000, maxRetries = 3 } = body;
        try {
          console.log(`[Language API] Starting Galatea service monitoring for user ${authenticatedUserId}`);
          const result = await languageManager.monitorAndEnsureGalateaService(
            authenticatedUserId,
            checkIntervalMs,
            maxRetries
          );
          
          return NextResponse.json({
            success: result.success,
            message: result.message,
            monitoringStarted: result.monitoringStarted
          }, { status: result.success ? 200 : 500 });
        } catch (error) {
          console.error(`[Language API] Error starting Galatea service monitoring:`, error);
          return NextResponse.json({
            success: false,
            message: `Error starting Galatea service monitoring: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }
      }

      case 'checkGalateaFunctioning': {
        try {
          console.log(`[Language API] Checking Galatea functioning for user ${authenticatedUserId}`);
          const result = await languageManager.checkGalateaFunctioning(authenticatedUserId);
          
          return NextResponse.json({
            success: result.success,
            message: result.message,
            healthy: result.healthy,
            logs: result.logs
          }, { status: result.success ? 200 : 500 });
        } catch (error) {
          console.error(`[Language API] Error checking Galatea functioning:`, error);
          return NextResponse.json({
            success: false,
            message: `Error checking Galatea functioning: ${error instanceof Error ? error.message : String(error)}`,
            healthy: false
          }, { status: 500 });
        }
      }

      // === GALATEA API ENDPOINTS ===
      
      case 'galateaHealth': {
        try {
          const result = await languageManager.galateaHealth(authenticatedUserId);
          return NextResponse.json(result, { status: result.success ? 200 : 500 });
        } catch (error) {
          console.error(`[Language API] Error checking Galatea health:`, error);
          return NextResponse.json({
            success: false,
            message: `Error checking Galatea health: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }
      }

      case 'galateaFindFiles': {
        const { dir, suffixes, exclude_dirs } = body;
        
        if (!dir || !suffixes || !Array.isArray(suffixes)) {
          return NextResponse.json({
            success: false,
            message: 'Required parameters missing: dir (string) and suffixes (array)'
          }, { status: 400 });
        }
        
        try {
          const result = await languageManager.galateaFindFiles(authenticatedUserId, {
            dir,
            suffixes,
            exclude_dirs
          });
          return NextResponse.json(result, { status: result.success ? 200 : 500 });
        } catch (error) {
          console.error(`[Language API] Error finding files:`, error);
          return NextResponse.json({
            success: false,
            message: `Error finding files: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }
      }

      case 'galateaParseFile': {
        const { file_path, max_snippet_size } = body;
        
        if (!file_path) {
          return NextResponse.json({
            success: false,
            message: 'Required parameter missing: file_path (string)'
          }, { status: 400 });
        }
        
        try {
          const result = await languageManager.galateaParseFile(authenticatedUserId, {
            file_path,
            max_snippet_size
          });
          return NextResponse.json(result, { status: result.success ? 200 : 500 });
        } catch (error) {
          console.error(`[Language API] Error parsing file:`, error);
          return NextResponse.json({
            success: false,
            message: `Error parsing file: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }
      }

      case 'galateaParseDirectory': {
        const { dir, suffixes, exclude_dirs, max_snippet_size, granularity } = body;
        
        if (!dir || !suffixes || !Array.isArray(suffixes)) {
          return NextResponse.json({
            success: false,
            message: 'Required parameters missing: dir (string) and suffixes (array)'
          }, { status: 400 });
        }
        
        try {
          const result = await languageManager.galateaParseDirectory(authenticatedUserId, {
            dir,
            suffixes,
            exclude_dirs,
            max_snippet_size,
            granularity
          });
          return NextResponse.json(result, { status: result.success ? 200 : 500 });
        } catch (error) {
          console.error(`[Language API] Error parsing directory:`, error);
          return NextResponse.json({
            success: false,
            message: `Error parsing directory: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }
      }

      case 'query': {
        const { collection_name, query_text, model, api_key, api_base } = body;
        if (!collection_name || !query_text) {
          return NextResponse.json({
            success: false,
            message: 'Required parameters missing: collection_name (string) and query_text (string)'
          }, { status: 400 });
        }
        const result = await languageManager.galateaQuery(authenticatedUserId, {
          collection_name,
          query_text,
          model,
          api_key,
          api_base,
        });
        return NextResponse.json(result);
      }

      case 'generate-embeddings': {
        const { input_file, output_file, model, api_key, api_base } = body;
        
        if (!input_file || !output_file) {
          return NextResponse.json({
            success: false,
            message: 'Required parameters missing: input_file (string) and output_file (string)'
          }, { status: 400 });
        }
        
        try {
          const result = await languageManager.galateaGenerateEmbeddings(authenticatedUserId, {
            input_file,
            output_file,
            model,
            api_key,
            api_base
          });
          return NextResponse.json(result, { status: result.success ? 200 : 500 });
        } catch (error) {
          console.error(`[Language API] Error generating embeddings:`, error);
          return NextResponse.json({
            success: false,
            message: `Error generating embeddings: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }
      }

      case 'upsert-embeddings': {
        const { input_file, collection_name } = body;
        
        if (!input_file || !collection_name) {
          return NextResponse.json({
            success: false,
            message: 'Required parameters missing: input_file (string) and collection_name (string)'
          }, { status: 400 });
        }
        
        try {
          const result = await languageManager.galateaUpsertEmbeddings(authenticatedUserId, {
            input_file,
            collection_name,
          });
          return NextResponse.json(result, { status: result.success ? 200 : 500 });
        } catch (error) {
          console.error(`[Language API] Error upserting embeddings:`, error);
          return NextResponse.json({
            success: false,
            message: `Error upserting embeddings: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }
      }

      case 'build-index': {
        const {
          dir,
          suffixes,
          exclude_dirs,
          max_snippet_size,
          granularity,
          embedding_model,
          api_key,
          api_base,
          collection_name,
        } = body;
        
        if (!dir || !suffixes || !Array.isArray(suffixes) || !collection_name) {
          return NextResponse.json({
            success: false,
            message: 'Required parameters missing: dir (string), suffixes (array), and collection_name (string)'
          }, { status: 400 });
        }
        
        try {
          const result = await languageManager.galateaBuildIndex(authenticatedUserId, {
            dir,
            suffixes,
            exclude_dirs,
            max_snippet_size,
            granularity,
            embedding_model,
            api_key,
            api_base,
            collection_name,
          });
          return NextResponse.json(result, { status: result.success ? 200 : 500 });
        } catch (error) {
          console.error(`[Language API] Error building index:`, error);
          return NextResponse.json({
            success: false,
            message: `Error building index: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }
      }

      case 'galateaEditorCommand': {
        const { command, path, file_text, insert_line, new_str, old_str, view_range } = body;
        
        if (!command || !path) {
          return NextResponse.json({
            success: false,
            message: 'Required parameters missing: command (string) and path (string)'
          }, { status: 400 });
        }
        
        try {
          const result = await languageManager.galateaEditorCommand(authenticatedUserId, {
            command,
            path,
            file_text,
            insert_line,
            new_str,
            old_str,
            view_range
          });
          return NextResponse.json(result, { status: result.success ? 200 : 500 });
        } catch (error) {
          console.error(`[Language API] Error executing editor command:`, error);
          return NextResponse.json({
            success: false,
            message: `Error executing editor command: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }
      }

      case 'galateaLint': {
        const { paths } = body;
        
        if (!paths || !Array.isArray(paths)) {
          return NextResponse.json({
            success: false,
            message: 'Required parameter missing: paths (array)'
          }, { status: 400 });
        }
        
        try {
          const result = await languageManager.galateaLint(authenticatedUserId, { paths });
          return NextResponse.json(result, { status: result.success ? 200 : 500 });
        } catch (error) {
          console.error(`[Language API] Error linting files:`, error);
          return NextResponse.json({
            success: false,
            message: `Error linting files: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }
      }

      case 'galateaFormatCheck': {
        const { patterns } = body;
        
        if (!patterns || !Array.isArray(patterns)) {
          return NextResponse.json({
            success: false,
            message: 'Required parameter missing: patterns (array)'
          }, { status: 400 });
        }
        
        try {
          const result = await languageManager.galateaFormatCheck(authenticatedUserId, { patterns });
          return NextResponse.json(result, { status: result.success ? 200 : 500 });
        } catch (error) {
          console.error(`[Language API] Error checking formatting:`, error);
          return NextResponse.json({
            success: false,
            message: `Error checking formatting: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }
      }

      case 'galateaFormatWrite': {
        const { patterns } = body;
        
        if (!patterns || !Array.isArray(patterns)) {
          return NextResponse.json({
            success: false,
            message: 'Required parameter missing: patterns (array)'
          }, { status: 400 });
        }
        
        try {
          const result = await languageManager.galateaFormatWrite(authenticatedUserId, { patterns });
          return NextResponse.json(result, { status: result.success ? 200 : 500 });
        } catch (error) {
          console.error(`[Language API] Error formatting files:`, error);
          return NextResponse.json({
            success: false,
            message: `Error formatting files: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }
      }

      case 'galateaLspGotoDefinition': {
        const { uri, line, character } = body;
        
        if (!uri || line === undefined || character === undefined) {
          return NextResponse.json({
            success: false,
            message: 'Required parameters missing: uri (string), line (number), and character (number)'
          }, { status: 400 });
        }
        
        try {
          const result = await languageManager.galateaLspGotoDefinition(authenticatedUserId, {
            uri,
            line,
            character
          });
          return NextResponse.json(result, { status: result.success ? 200 : 500 });
        } catch (error) {
          console.error(`[Language API] Error getting definition:`, error);
          return NextResponse.json({
            success: false,
            message: `Error getting definition: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }
      }

      default:
        return NextResponse.json({ message: 'Invalid action specified' }, { status: 400 });
    }
  } catch (error) {
    console.error(`[Language API] User [${authenticatedUserId || 'unknown'}] Error for action [${action || 'unknown'}]:`, error);
    return NextResponse.json(
      { message: `Internal Server Error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const languageManager = LanguageManager.getInstance();
  try {
    const authenticatedUserId = await getAuthenticatedUserId(req.headers);

    if (!authenticatedUserId) {
      return NextResponse.json({ message: 'Authentication required for this action.' }, { status: 401 });
    }

    // Check URL parameters to determine what to return
    const url = new URL(req.url);
    
    // Check if we should return Galatea server status
    const getServerStatus = url.searchParams.get('serverStatus');
    if (getServerStatus === 'true') {
      const serverInfo = languageManager.getGalateaServerInfo(authenticatedUserId);
      
      // If we have server info, check if it's still running
      if (serverInfo && serverInfo.status === 'running' && serverInfo.pid) {
        const statusResult = await languageManager.checkGalateaServerStatus(authenticatedUserId);
        return NextResponse.json({
          success: statusResult.success,
          serverInfo: statusResult.serverInfo || serverInfo
        });
      }
      
      return NextResponse.json({
        success: !!serverInfo,
        serverInfo: serverInfo || { status: 'not_found', message: 'No server information found' }
      });
    }
    
    // Check if we should return server logs
    const getServerLogs = url.searchParams.get('serverLogs');
    if (getServerLogs === 'true') {
      const lines = parseInt(url.searchParams.get('lines') || '100', 10);
      const logsResult = await languageManager.getGalateaServerLogs(authenticatedUserId, lines);
      return NextResponse.json({
        success: logsResult.success,
        logs: logsResult.logs || 'No logs found',
        message: logsResult.message
      });
    }
    
    // Check if we should return Galatea execution results
    const getGalateaResult = url.searchParams.get('galateaResult');
    if (getGalateaResult === 'true') {
      const result = languageManager.getLatestGalateaResult(authenticatedUserId);
      return NextResponse.json({
        success: !!result,
        result: result || { message: 'No execution results found' }
      });
    }
    
    // Default: return active project
    const activeProjectId = languageManager.getActiveProject(authenticatedUserId);
    
    return NextResponse.json({
      success: true,
      activeProjectId: activeProjectId
    });
  } catch (error) {
    console.error(`[Language API] Error during GET:`, error);
    return NextResponse.json(
      { message: `Internal Server Error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
