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