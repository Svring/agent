import { z } from 'zod';
import { tool } from 'ai';
import { LanguageManager } from '@/backstage/language-manager';

export const coderFindFiles = tool({
  description: 'Find files in the project matching specific suffixes and excluding directories.',
  parameters: z.object({
    userId: z.string().describe("The ID of the user whose project is being accessed."),
    dir: z.string().describe("Directory path to search from (relative to project root)."),
    suffixes: z.array(z.string()).describe("File extensions to search for (e.g., ['ts', 'tsx', 'js'])."),
    exclude_dirs: z.array(z.string()).optional().describe("Directories to exclude (e.g., ['node_modules', 'dist'])."),
  }),
  execute: async ({ userId, dir, suffixes, exclude_dirs }) => {
    try {
      const result = await LanguageManager.getInstance().galateaFindFiles(userId, { 
        dir, 
        suffixes, 
        exclude_dirs 
      });
      
      if (!result.success) {
        return { success: false, error: result.message || "Failed to find files" };
      }
      
      return { 
        success: true, 
        files: result.data?.files || [],
        message: `Found ${result.data?.files?.length || 0} files matching criteria` 
      };
    } catch (error: any) {
      return { success: false, error: `Failed to find files: ${error.message}` };
    }
  }
});

export const coderParseFile = tool({
  description: 'Parse a single file and extract code entities (functions, classes, etc.).',
  parameters: z.object({
    userId: z.string().describe("The ID of the user whose project is being accessed."),
    file_path: z.string().describe("Path to the file to parse (relative to project root)."),
    max_snippet_size: z.number().optional().describe("Maximum size of code snippets to extract."),
  }),
  execute: async ({ userId, file_path, max_snippet_size }) => {
    try {
      const result = await LanguageManager.getInstance().galateaParseFile(userId, { 
        file_path, 
        max_snippet_size 
      });
      
      if (!result.success) {
        return { success: false, error: result.message || "Failed to parse file" };
      }
      
      return { 
        success: true, 
        entities: result.data || [],
        message: `Parsed ${file_path}, found ${result.data?.length || 0} code entities` 
      };
    } catch (error: any) {
      return { success: false, error: `Failed to parse file ${file_path}: ${error.message}` };
    }
  }
});

export const coderParseDirectory = tool({
  description: 'Parse a directory of files and extract code entities (functions, classes, etc.).',
  parameters: z.object({
    userId: z.string().describe("The ID of the user whose project is being accessed."),
    dir: z.string().describe("Directory path to parse (relative to project root)."),
    suffixes: z.array(z.string()).describe("File extensions to parse (e.g., ['ts', 'tsx', 'js'])."),
    exclude_dirs: z.array(z.string()).optional().describe("Directories to exclude (e.g., ['node_modules', 'dist'])."),
    max_snippet_size: z.number().optional().describe("Maximum size of code snippets to extract."),
    granularity: z.enum(["fine", "medium", "coarse"]).optional().describe("Level of detail for parsing."),
  }),
  execute: async ({ userId, dir, suffixes, exclude_dirs, max_snippet_size, granularity }) => {
    try {
      const result = await LanguageManager.getInstance().galateaParseDirectory(userId, { 
        dir, 
        suffixes, 
        exclude_dirs,
        max_snippet_size,
        granularity
      });
      
      if (!result.success) {
        return { success: false, error: result.message || "Failed to parse directory" };
      }
      
      return { 
        success: true, 
        entities: result.data || [],
        message: `Parsed directory ${dir}, found ${result.data?.length || 0} code entities` 
      };
    } catch (error: any) {
      return { success: false, error: `Failed to parse directory ${dir}: ${error.message}` };
    }
  }
});

export const coderSemanticQuery = tool({
  description: 'Search codebase for entities matching a semantic query.',
  parameters: z.object({
    userId: z.string().describe("The ID of the user whose project is being accessed."),
    collection_name: z.string().describe("Name of the vector collection to search."),
    query_text: z.string().describe("Natural language query to search for (e.g., 'function that handles user authentication')."),
    model: z.string().optional().describe("Optional embedding model to use."),
  }),
  execute: async ({ userId, collection_name, query_text, model }) => {
    try {
      const result = await LanguageManager.getInstance().galateaQuery(userId, { 
        collection_name, 
        query_text,
        model
      });
      
      if (!result.success) {
        return { success: false, error: result.message || "Failed to search code" };
      }
      
      return { 
        success: true, 
        matches: result.data || [],
        message: `Found ${result.data?.length || 0} code entities matching "${query_text}"` 
      };
    } catch (error: any) {
      return { success: false, error: `Failed to search code: ${error.message}` };
    }
  }
});

export const coderViewFile = tool({
  description: 'View the content of a file or a specific range of lines.',
  parameters: z.object({
    userId: z.string().describe("The ID of the user whose project is being accessed."),
    path: z.string().describe("Path to the file to view (relative to project root)."),
    view_range: z.array(z.number()).optional().describe("Optional line range to view [start_line, end_line] (1-indexed, -1 for end of file)."),
  }),
  execute: async ({ userId, path, view_range }) => {
    try {
      const result = await LanguageManager.getInstance().galateaEditorCommand(userId, {
        command: "view",
        path,
        view_range
      });
      
      if (!result.success) {
        return { success: false, error: result.message || "Failed to view file" };
      }
      
      return { 
        success: true, 
        content: result.data?.content || "",
        message: `Retrieved content for ${path}` 
      };
    } catch (error: any) {
      return { success: false, error: `Failed to view file ${path}: ${error.message}` };
    }
  }
});

export const coderCreateFile = tool({
  description: 'Create a new file with specified content.',
  parameters: z.object({
    userId: z.string().describe("The ID of the user whose project is being accessed."),
    path: z.string().describe("Path where to create the file (relative to project root)."),
    file_text: z.string().describe("Content to write to the file."),
  }),
  execute: async ({ userId, path, file_text }) => {
    try {
      const result = await LanguageManager.getInstance().galateaEditorCommand(userId, {
        command: "create",
        path,
        file_text
      });
      
      if (!result.success) {
        return { success: false, error: result.message || "Failed to create file" };
      }
      
      return { 
        success: true, 
        message: `Created file at ${path}`,
        file_path: result.data?.file_path || path,
        line_count: result.data?.line_count || 0,
        content: result.data?.content || null,
        modified_at: result.data?.modified_at || null
      };
    } catch (error: any) {
      return { success: false, error: `Failed to create file ${path}: ${error.message}` };
    }
  }
});

export const coderReplaceString = tool({
  description: 'Replace a string in a file with a new string.',
  parameters: z.object({
    userId: z.string().describe("The ID of the user whose project is being accessed."),
    path: z.string().describe("Path to the file to edit (relative to project root)."),
    old_str: z.string().describe("Exact string to replace (must match exactly)."),
    new_str: z.string().describe("New string to replace with."),
  }),
  execute: async ({ userId, path, old_str, new_str }) => {
    try {
      // console.log("Replacing text in file:", {
      //   path,
      //   old_str: {
      //     content: old_str,
      //     length: old_str.length,
      //     type: typeof old_str,
      //     hasNewlines: old_str.includes('\n'),
      //     isWhitespace: /^\s*$/.test(old_str)
      //   },
      //   new_str: {
      //     content: new_str,
      //     length: new_str.length,
      //     type: typeof new_str,
      //     hasNewlines: new_str.includes('\n'),
      //     isWhitespace: /^\s*$/.test(new_str)
      //   }
      // });
      const result = await LanguageManager.getInstance().galateaEditorCommand(userId, {
        command: "str_replace",
        path,
        old_str,
        new_str
      });
      
      if (!result.success) {
        return { success: false, error: result.message || "Failed to replace text" };
      }
      
      return { 
        success: true, 
        message: `Successfully replaced text in ${path}`,
        file_path: result.data?.file_path || path,
        content: result.data?.content || null,
        line_count: result.data?.line_count || 0,
        modified_lines: result.data?.modified_lines || [],
        modified_at: result.data?.modified_at || null
      };
    } catch (error: any) {
      return { success: false, error: `Failed to replace text in ${path}: ${error.message}` };
    }
  }
});

export const coderInsertAtLine = tool({
  description: 'Insert text at a specific line in a file.',
  parameters: z.object({
    userId: z.string().describe("The ID of the user whose project is being accessed."),
    path: z.string().describe("Path to the file to edit (relative to project root)."),
    insert_line: z.number().describe("Line number where to insert the text (1-indexed)."),
    new_str: z.string().describe("Text to insert at the specified line."),
  }),
  execute: async ({ userId, path, insert_line, new_str }) => {
    try {
      const result = await LanguageManager.getInstance().galateaEditorCommand(userId, {
        command: "insert",
        path,
        insert_line,
        new_str
      });
      
      if (!result.success) {
        return { success: false, error: result.message || "Failed to insert text" };
      }
      
      return { 
        success: true, 
        message: `Successfully inserted text at line ${insert_line} in ${path}`,
        file_path: result.data?.file_path || path,
        content: result.data?.content || null,
        line_count: result.data?.line_count || 0,
        modified_lines: result.data?.modified_lines || [insert_line],
        modified_at: result.data?.modified_at || null
      };
    } catch (error: any) {
      return { success: false, error: `Failed to insert text in ${path}: ${error.message}` };
    }
  }
});

export const coderUndoEdit = tool({
  description: 'Undo the last edit operation to a file.',
  parameters: z.object({
    userId: z.string().describe("The ID of the user whose project is being accessed."),
    path: z.string().describe("Path to the file for which to undo the last edit."),
  }),
  execute: async ({ userId, path }) => {
    try {
      const result = await LanguageManager.getInstance().galateaEditorCommand(userId, {
        command: "undo_edit",
        path
      });
      
      if (!result.success) {
        return { success: false, error: result.message || "Failed to undo edit" };
      }
      
      return { 
        success: true, 
        message: `Successfully undid last edit to ${path}` 
      };
    } catch (error: any) {
      return { success: false, error: `Failed to undo edit for ${path}: ${error.message}` };
    }
  }
});

export const coderLintFiles = tool({
  description: 'Lint the entire project using ESLint to find potential problems.',
  parameters: z.object({
    userId: z.string().describe("The ID of the user whose project is being accessed."),
  }),
  execute: async ({ userId }) => {
    try {
      const result = await LanguageManager.getInstance().galateaLint(userId, {});
      
      if (!result.success) {
        return { success: false, error: result.message || "Failed to lint project" };
      }
      
      return { 
        success: true, 
        results: result.data?.results || [],
        message: result.data?.results?.length > 0 ? `Linting found issues in the project.` : `Project linted successfully. No issues found.` 
      };
    } catch (error: any) {
      return { success: false, error: `Failed to lint project: ${error.message}` };
    }
  }
});

export const coderFormat = tool({
  description: 'Format the entire project using Prettier and write the changes.',
  parameters: z.object({
    userId: z.string().describe("The ID of the user whose project is being accessed."),
    // patterns: z.array(z.string()).describe("Array of file patterns to format (e.g., ['src/**/*.ts', 'src/**/*.tsx'])."), // Parameter removed
  }),
  execute: async ({ userId /*, patterns */ }) => { // patterns commented out
    try {
      // Galatea's watcher.rs for format_with_prettier already formats ./src, ignoring input patterns.
      // So, sending an empty array or any specific pattern here has no effect on what Galatea does.
      const result = await LanguageManager.getInstance().galateaFormat(userId, { patterns: [] }); 
      
      if (!result.success) {
        return { success: false, error: result.message || "Failed to format project" };
      }
      
      // The Galatea API for formatWrite currently returns formatted_files which might be empty
      // because it runs `npm run format` which doesn't list changed files like `prettier --write --list-different` would.
      // The message should reflect that the command was run.
      return { 
        success: true, 
        formatted_files: result.data?.formatted_files || [], // This might often be empty from current Galatea impl
        message: `Format command executed for the project. Check files for changes.`
      };
    } catch (error: any) {
      return { success: false, error: `Failed to format project: ${error.message}` };
    }
  }
});

export const coderGotoDefinition = tool({
  description: 'Find the definition location of a symbol in the code.',
  parameters: z.object({
    userId: z.string().describe("The ID of the user whose project is being accessed."),
    uri: z.string().describe("File URI (e.g., 'file:///project/src/app.ts')."),
    line: z.number().describe("Line number of the symbol (0-indexed)."),
    character: z.number().describe("Character position of the symbol (0-indexed)."),
  }),
  execute: async ({ userId, uri, line, character }) => {
    try {
      const result = await LanguageManager.getInstance().galateaLspGotoDefinition(userId, { 
        uri, 
        line, 
        character 
      });
      
      if (!result.success) {
        return { success: false, error: result.message || "Failed to find definition" };
      }
      
      return { 
        success: true, 
        locations: result.data?.locations || null,
        message: `Found definition locations for symbol at ${uri}:${line}:${character}` 
      };
    } catch (error: any) {
      return { success: false, error: `Failed to find definition: ${error.message}` };
    }
  }
});

export const coderBuildIndex = tool({
  description: 'Build a semantic search index for the codebase.',
  parameters: z.object({
    userId: z.string().describe("The ID of the user whose project is being accessed."),
    dir: z.string().describe("Directory to index (relative to project root)."),
    suffixes: z.array(z.string()).describe("File extensions to index (e.g., ['ts', 'tsx', 'js'])."),
    collection_name: z.string().describe("Name for the index collection."),
    exclude_dirs: z.array(z.string()).optional().describe("Directories to exclude (e.g., ['node_modules', 'dist'])."),
    granularity: z.enum(["fine", "medium", "coarse"]).optional().describe("Level of detail for indexing."),
    max_snippet_size: z.number().optional().describe("Maximum size of code snippets to index."),
    api_key: z.string().optional().describe("Optional API key for embedding service."),
  }),
  execute: async ({ userId, dir, suffixes, collection_name, exclude_dirs, granularity, max_snippet_size, api_key }) => {
    try {
      const result = await LanguageManager.getInstance().galateaBuildIndex(userId, { 
        dir, 
        suffixes, 
        collection_name,
        exclude_dirs,
        granularity,
        max_snippet_size,
        api_key
      });
      
      if (!result.success) {
        return { success: false, error: result.message || "Failed to build index" };
      }
      
      return { 
        success: true, 
        message: result.data?.message || `Started building index for ${dir} into collection ${collection_name}` 
      };
    } catch (error: any) {
      return { success: false, error: `Failed to build index: ${error.message}` };
    }
  }
});

// Group all coder tools for easy import and registration
export const coderTools = {
  coderFindFiles,
  coderParseFile,
  coderParseDirectory,
  coderSemanticQuery,
  coderViewFile,
  coderCreateFile,
  coderReplaceString,
  coderInsertAtLine,
  coderUndoEdit,
  coderLintFiles,
  coderFormat,
  coderGotoDefinition,
  coderBuildIndex
};

export default coderTools;
