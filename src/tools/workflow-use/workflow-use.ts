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
  description: `Manages workflows for automation tasks. Can create, read, modify, and delete workflows and their steps.`,
  parameters: z.object({
    action: WorkflowActionEnum.describe('The action to perform on workflows'),
    workflowId: z.string().optional().describe('The ID of the workflow to get, update, or delete (required for get, update, delete actions)'),
    applicationId: z.number().optional().describe('The ID of the application to filter workflows by or associate a new workflow with (required for create action)'),
    data: WorkflowCreateInputSchema.or(WorkflowUpdateInputSchema).optional().describe(`Data for creating or updating a workflow (should match WorkflowCreateInput or WorkflowUpdateInput schema)

    WORKFLOW ACTIONS:
    - 'get': Retrieves a workflow by ID. Requires workflowId.
    - 'list': Lists all workflows, optionally filtered by applicationId.
    - 'create': Creates a new workflow. Requires applicationId and data with name, description, and optionally steps.
    - 'update': Updates an existing workflow. Requires workflowId and data containing fields to update.
    - 'delete': Deletes a workflow. Requires workflowId.

    WORKFLOW STEPS:
    Each workflow consists of multiple steps that define specific actions. When creating steps, the following fields apply:

    Action Types and Required Fields:
    - screenshot: Only 'action' and 'description' required. Captures current screen state.
    - left_click: Requires 'coordinates' with valid x,y values. Performs a single left mouse click.
    - right_click: Requires 'coordinates' with valid x,y values. Performs a single right mouse click.
    - middle_click: Requires 'coordinates' with valid x,y values. Performs a middle mouse button click.
    - double_click: Requires 'coordinates' with valid x,y values. Performs a double left mouse click.
    - left_click_drag: Requires both 'coordinates' (start) and 'endCoordinates' (end) with valid x,y values. Performs click-and-drag.
    - mouse_move: Requires 'coordinates' with valid x,y values. Moves mouse pointer without clicking.
    - type: Requires 'text' field containing the text to type. Types text at current cursor position.
    - key: Requires 'text' field specifying the key to press (e.g., 'enter', 'tab', 'escape'). Presses a keyboard key.
    - cursor_position: No additional fields required. Returns current mouse cursor position.

    Optional fields for all steps: delay (milliseconds), condition (prerequisite), onError (error handling).

    EXAMPLE USAGE:
    1. Create workflow: action='create', applicationId=123, data={name:'Login Flow', description:'Automates login', steps:[{action:'screenshot', description:'Initial state'}]}
    2. Add click step: action='update', workflowId='123', data={steps:[existing_steps..., {action:'left_click', description:'Click login button', coordinates:{x:100, y:200}}]}
    3. Get workflow: action='get', workflowId='123'
    4. Delete workflow: action='delete', workflowId='123'
  `),
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
