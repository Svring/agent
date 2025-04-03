'use server'

import { getPayload } from 'payload'; // Adjust path as needed
import config from '@payload-config';
import { 
  Workflow, 
  WorkflowSchema, 
  WorkflowCreateInput, 
  WorkflowCreateInputSchema,
  WorkflowUpdateInput,
  WorkflowUpdateInputSchema
} from '../../tools/workflow-use/workflow-use-type';
import { z } from 'zod';
import type { Where } from 'payload'; // Corrected import path for Where

// Define input types derived from the main schema, omitting generated fields
// Moved to workflow-use-type.ts

/**
 * Creates a new workflow document.
 * @param data - The data for the new workflow, validated against the schema.
 * @returns The created workflow document.
 * @throws Throws an error if validation fails or Payload API request fails.
 */
export async function createWorkflow(data: WorkflowCreateInput): Promise<Workflow> {
  const payload = await getPayload({ config });
  try {
    // Validate input data
    const validatedData = WorkflowCreateInputSchema.parse(data);
    
    const workflow = await payload.create({
      collection: 'workflows',
      data: validatedData,
    });
    // Validate the output against the full schema to be sure
    return WorkflowSchema.parse(workflow) as Workflow;
  } catch (error) {
    console.error("Error creating workflow:", error);
    if (error instanceof z.ZodError) {
      throw new Error(`Workflow validation failed: ${error.errors.map(e => e.message).join(', ')}`);
    }
    // Re-throw other errors (e.g., Payload API errors)
    throw error;
  }
}

/**
 * Retrieves a workflow by its ID.
 * @param id - The ID of the workflow to retrieve.
 * @returns The workflow document or null if not found.
 * @throws Throws an error if the Payload API request fails.
 */
export async function getWorkflowById(id: string): Promise<Workflow | null> {
  const payload = await getPayload({ config });
  try {
    const workflow = await payload.findByID({
      collection: 'workflows',
      id: id,
    });
    // Validate the retrieved data
    return WorkflowSchema.parse(workflow) as Workflow;
  } catch (error: any) {
    // Payload throws specific error for Not Found
    if (error?.status === 404) {
        return null;
    }
    console.error(`Error fetching workflow with ID ${id}:`, error);
    // Re-throw other errors
    throw error;
  }
}

/**
 * Retrieves workflow documents, optionally filtered by application ID.
 * @param appId - Optional ID of the application to filter workflows for.
 * @returns An array of workflow documents.
 * @throws Throws an error if the Payload API request fails.
 */
export async function getAllWorkflows(appId?: number): Promise<Workflow[]> { // Add optional appId parameter
  const payload = await getPayload({ config });
  try {
    // Construct the where query based on the presence of appId
    const where: Where = {};
    if (appId !== undefined && appId !== null) {
      where.application = { equals: appId };
    }

    const results = await payload.find({
      collection: 'workflows',
      where, // Apply the where clause
      limit: 1000, // Adjust limit as needed or implement pagination
    });
    // Validate each document in the results
    return z.array(WorkflowSchema).parse(results.docs) as Workflow[];
  } catch (error) {
    console.error(`Error fetching workflows${appId ? ' for app ' + appId : ''}:`, error);
    throw error;
  }
}

/**
 * Updates an existing workflow document.
 * @param id - The ID of the workflow to update.
 * @param data - The partial data to update the workflow with, validated against the schema.
 * @returns The updated workflow document or null if not found.
 * @throws Throws an error if validation fails or Payload API request fails.
 */
export async function updateWorkflow(id: string, data: WorkflowUpdateInput): Promise<Workflow | null> {
  console.log(`[DEBUG] updateWorkflow called with ID: ${id} and data:`, JSON.stringify(data, null, 2));
  
  const payload = await getPayload({ config });
  try {
    // Debug log raw input data structure and types
    console.log(`[DEBUG] Raw data structure: ${typeof data}`);
    console.log(`[DEBUG] Data keys:`, Object.keys(data));
    
    // Check for nested objects and arrays
    if (data.steps) {
      console.log(`[DEBUG] Steps is an array with ${data.steps.length} items`);
      console.log(`[DEBUG] First step sample:`, JSON.stringify(data.steps[0], null, 2));
    }
    
    // Log nested properties, if any
    Object.entries(data).forEach(([key, value]) => {
      const valueType = typeof value;
      if (valueType === 'object' && value !== null) {
        console.log(`[DEBUG] Property '${key}' is an object:`, JSON.stringify(value, null, 2));
      } else {
        console.log(`[DEBUG] Property '${key}' is type '${valueType}' with value:`, value);
      }
    });
    
    // Validate input data
    console.log(`[DEBUG] Attempting to validate data against WorkflowUpdateInputSchema`);
    const validatedData = WorkflowUpdateInputSchema.parse(data);
    console.log(`[DEBUG] Validation successful. Validated data:`, JSON.stringify(validatedData, null, 2));

    if (Object.keys(validatedData).length === 0) {
        console.warn("[DEBUG] Update called with no data for workflow:", id);
        // Optionally return the existing document without making an API call
        return getWorkflowById(id);
    }

    console.log(`[DEBUG] Calling payload.update with data:`, JSON.stringify(validatedData, null, 2));
    const workflow = await payload.update({
      collection: 'workflows',
      id: id,
      data: validatedData,
    });
    
    console.log(`[DEBUG] payload.update successful, validating response`);
    // Validate the output against the full schema
    const validatedWorkflow = WorkflowSchema.parse(workflow) as Workflow;
    console.log(`[DEBUG] Response validation successful, returning workflow`);
    return validatedWorkflow;
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      console.error(`[DEBUG] Zod validation error:`, error.errors);
      console.error(`[DEBUG] Validation error details:`, JSON.stringify(error.format(), null, 2));
      throw new Error(`Workflow update validation failed: ${error.errors.map(e => e.message).join(', ')}`);
    }
    // Payload throws specific error for Not Found
    if (error?.status === 404) {
      console.error(`[DEBUG] Workflow not found with ID ${id}`);
      return null;
    }
    console.error(`[DEBUG] Error updating workflow with ID ${id}:`, error);
    console.error(`[DEBUG] Error stack:`, error.stack);
    throw error;
  }
}

/**
 * Deletes a workflow document by its ID.
 * @param id - The ID of the workflow to delete.
 * @returns True if deletion was successful, false if the document was not found.
 * @throws Throws an error if the Payload API request fails for reasons other than not found.
 */
export async function deleteWorkflow(id: string): Promise<boolean> {
  const payload = await getPayload({ config });
  try {
    await payload.delete({
      collection: 'workflows',
      id: id,
    });
    return true;
  } catch (error: any) {
     // Payload throws specific error for Not Found
    if (error?.status === 404) {
        console.warn(`Workflow with ID ${id} not found for deletion.`);
        return false;
    }
    console.error(`Error deleting workflow with ID ${id}:`, error);
    throw error; // Re-throw unexpected errors
  }
}
