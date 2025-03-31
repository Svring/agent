import { getPayload } from 'payload';
import config from '@payload-config'; // Assuming this alias points to your payload.config.ts
import type { Application } from '../../payload-types'; // Adjust path as needed

/**
 * Finds an application by its name.
 * @param name - The name of the application.
 * @returns The application document or null if not found.
 */
export async function findApplicationByName(name: string): Promise<Application | null> {
  const payload = await getPayload({ config }); // Correct payload initialization
  try {
    const result = await payload.find({
      collection: 'applications',
      where: {
        name: { equals: name },
      },
      limit: 1,
    });
    return result.docs.length > 0 ? result.docs[0] : null;
  } catch (error) {
    console.error('Error finding application by name:', error);
    return null;
  }
}

/**
 * Lists all available applications.
 * @returns An array of application documents.
 */
export async function listApplications(): Promise<Application[]> {
  const payload = await getPayload({ config }); // Correct payload initialization
  try {
    const result = await payload.find({
      collection: 'applications',
      limit: 100, // Adjust limit as needed
    });
    return result.docs;
  } catch (error) {
    console.error('Error listing applications:', error);
    return [];
  }
}

// Add create/update/delete functions here if needed for admin actions or specific workflows

/**
 * Creates a new application.
 * @param data - The data for the new application (name and description required).
 * @returns The newly created application document or null if creation fails.
 */
export async function createApplication(data: { name: string; description: string; version?: string }): Promise<Application | null> {
  const payload = await getPayload({ config }); // Correct payload initialization
  try {
    // Ensure required fields are present
    if (!data.name || !data.description) {
      throw new Error('Application name and description are required.');
    }

    const newApplication = await payload.create({
      collection: 'applications',
      data: {
        name: data.name,
        description: data.description,
        version: data.version, // Include version if provided
      },
    });
    return newApplication;
  } catch (error) {
    console.error('Error creating application:', error);
    // You might want to throw the error or return a more specific error object
    // depending on how you want to handle errors upstream.
    return null;
  }
}

/**
 * Gets application details including its chat sessions and workflows.
 * @param appId - The ID of the application.
 * @returns The application document with its related sessions and workflows, or null if not found.
 */
export async function getApplicationDetails(appId: string): Promise<{
  application: Application | null;
  chatSessions: any[];
  workflows: any[];
} | null> {
  const payload = await getPayload({ config });
  try {
    // Get the application
    const application = await payload.findByID({
      collection: 'applications',
      id: appId,
    });

    if (!application) {
      return null;
    }

    // Get related chat sessions
    const chatSessions = await payload.find({
      collection: 'chat_sessions',
      where: {
        application: { equals: appId },
      },
    });

    // Get related workflows
    const workflows = await payload.find({
      collection: 'workflows',
      where: {
        application: { equals: appId },
      },
    });

    return {
      application,
      chatSessions: chatSessions.docs,
      workflows: workflows.docs,
    };
  } catch (error) {
    console.error('Error getting application details:', error);
    return null;
  }
} 