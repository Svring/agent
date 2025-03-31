import { getPayload } from 'payload';
import config from '@payload-config'; // Assuming this alias points to your payload.config.ts
import { generateId } from 'ai'; // Keep using generateId from ai
import type { ChatSession, Application } from '../../payload-types'; // Adjust path as needed

/**
 * Creates a new chat session with a unique ID.
 * Replaces the file-based implementation with a database storage method.
 * @param application Optional application ID or document to associate with the chat.
 * @returns The ID of the newly created chat session.
 */
export async function createChat(application?: Application | string): Promise<string> {
  const payload = await getPayload({ config });
  try {
    const generatedId = generateId(); // Generate a unique ID like the original
    
    // Create a new chat session in the database
    const result = await payload.create({
      collection: 'chat_sessions',
      data: {
        name: generatedId, // Use 'name' field to store the generated ID
        application: application ? (typeof application === 'string' ? application : application.id) as any : undefined,
      },
    });
    
    // For compatibility with original function, we'll return the generated ID
    console.log(`Created new chat session with DB ID: ${result.id}, session name: ${generatedId}`);
    return generatedId;
  } catch (error) {
    console.error('Error creating new chat session:', error);
    throw new Error(`Failed to create chat session: ${error}`);
  }
}

/**
 * Creates a new chat session for a given application.
 * @param application The application document or its ID.
 * @param name Optional name for the session.
 * @returns The newly created chat session document or null on error.
 */
export async function createChatSession(
  application: Application | string,
  name?: string
): Promise<ChatSession | null> {
  const payload = await getPayload({ config });
  try {
    const appId = typeof application === 'string' ? application : application.id;
    const result = await payload.create({
      collection: 'chat_sessions',
      data: {
        application: appId as any,
        ...(name && { name }),
      },
    });
    console.log(`Created chat session ${result.id} for app ${appId}`);
    return result;
  } catch (error) {
    console.error('Error creating chat session:', error);
    return null;
  }
}

/**
 * Finds a chat session by its ID.
 * @param sessionId The ID of the chat session.
 * @param depth Optional depth for populating relationships.
 * @returns The chat session document or null if not found.
 */
export async function findChatSessionById(
  sessionId: string,
  depth: number = 0
): Promise<ChatSession | null> {
  const payload = await getPayload({ config });
  try {
    const result = await payload.findByID({
      collection: 'chat_sessions',
      id: sessionId,
      depth: depth,
    });
    return result;
  } catch (error) {
    console.error(`Error finding chat session by ID ${sessionId}:`, error);
    return null;
  }
}

// Add functions to list sessions for an app, delete sessions etc. if needed 