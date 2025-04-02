import { tool } from 'ai';
import { z } from 'zod';
import {
  getWorkflowById,
  getAllWorkflows,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow
} from '@/db/actions/Workflows';
import {
  WorkflowCreateInputSchema,
  WorkflowUpdateInputSchema,
} from './workflow-use-type';

const WorkflowActionEnum = z.enum([
  'get',     // Get a specific workflow by ID
  'list',    // List all workflows (optionally filtered by application ID)
  'create',  // Create a new workflow
  'update',  // Update an existing workflow
  'delete',  // Delete a workflow
]);

export const workflowUseTool = tool({
  description: `Manages workflows for automation tasks. Can create, read, modify, and delete workflows and their steps. 
  Use this tool to interact with the workflow system when the user wants to create or manipulate automation sequences.`,
  parameters: z.object({
    action: WorkflowActionEnum.describe('The action to perform on workflows'),
    workflowId: z.string().optional().describe('The ID of the workflow to get, update, or delete (required for get, update, delete actions)'),
    applicationId: z.number().optional().describe('The ID of the application to filter workflows by or associate a new workflow with (required for create action)'),
    data: WorkflowCreateInputSchema.or(WorkflowUpdateInputSchema).optional().describe('Data for creating or updating a workflow (should match WorkflowCreateInput or WorkflowUpdateInput schema)'),
  }),
  execute: async ({ action, workflowId, applicationId, data }) => {
    try {
      switch (action) {
        case 'get': {
          if (!workflowId) {
            throw new Error('Workflow ID is required for get action');
          }
          const workflow = await getWorkflowById(workflowId);
          if (!workflow) {
            return { success: false, message: 'Workflow not found' };
          }
          return { success: true, workflow };
        }

        case 'list': {
          const workflows = await getAllWorkflows(applicationId);
          return { success: true, workflows };
        }

        case 'create': {
          if (!data || !applicationId) {
            throw new Error('Both data and applicationId are required for create action');
          }

          try {
            // Validate data against the schema
            const validatedData = WorkflowCreateInputSchema.parse({
              ...data,
              application: applicationId,
            });

            // Ensure we have at least one step if none was provided
            if (!validatedData.steps || validatedData.steps.length === 0) {
              validatedData.steps = [
                { action: 'screenshot', description: 'Initial screenshot step' }
              ];
            }

            const newWorkflow = await createWorkflow(validatedData);
            return { success: true, workflow: newWorkflow };
          } catch (err) {
            if (err instanceof z.ZodError) {
              return {
                success: false,
                message: 'Invalid workflow data',
                validationErrors: err.errors
              };
            }
            throw err;
          }
        }

        case 'update': {
          if (!workflowId || !data) {
            throw new Error('Both workflowId and data are required for update action');
          }

          try {
            // Validate data against the update schema
            const validatedData = WorkflowUpdateInputSchema.parse(data);

            const updatedWorkflow = await updateWorkflow(workflowId, validatedData);
            if (!updatedWorkflow) {
              return { success: false, message: 'Workflow not found or update failed' };
            }
            return { success: true, workflow: updatedWorkflow };
          } catch (err) {
            if (err instanceof z.ZodError) {
              return {
                success: false,
                message: 'Invalid workflow update data',
                validationErrors: err.errors
              };
            }
            throw err;
          }
        }

        case 'delete': {
          if (!workflowId) {
            throw new Error('Workflow ID is required for delete action');
          }

          const success = await deleteWorkflow(workflowId);
          return { success, message: success ? 'Workflow deleted successfully' : 'Failed to delete workflow' };
        }

        default:
          return { success: false, message: `Unknown action: ${action}` };
      }
    } catch (error) {
      console.error('Error in workflowUseTool:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      };
    }
  },
});
