'use server';

import { getPayload } from 'payload';
import config from '@payload-config'; // Assuming this alias points to your payload.config.ts
import { generateId } from 'ai'; // Keep using generateId from ai

/**
 * Creates a new chat session with a unique ID.
 * Replaces the file-based implementation with a database storage method.
 * Requires an application to associate with the chat.
 * @param applicationId The numeric ID of the application to associate with the chat.
 * @returns The generated ID (used as the chat session name/identifier).
 */
export async function createChat(applicationId: number): Promise<string> {
  const payload = await getPayload({ config });
  try {
    const generatedId = generateId();

    // Create a new chat session in the database
    const result = await payload.create({
      collection: 'chat_sessions',
      data: {
        name: generatedId, 
        application: applicationId, // Pass the numeric ID directly (assuming Payload handles number IDs)
      },
    });
    
    console.log(`Created new chat session with DB ID: ${result.id}, session name: ${generatedId}`);
    // Return the generated ID used as the name/identifier
    return generatedId; 
  } catch (error) {
    console.error('Error creating new chat session:', error);
    // Re-throw the error so the caller can handle it
    throw new Error(`Failed to create chat session: ${error}`);
  }
}

/**
 * Deletes a chat session by its ID.
 * @param chatId The ID of the chat session to delete.
 * @returns True if deletion was successful, or an object with an error message if it failed.
 */
export async function deleteChatSession(chatId: string): Promise<boolean | { error: string }> {
  const payload = await getPayload({ config });
  try {
    const result = await payload.delete({
      collection: 'chat_sessions',
      id: chatId,
    });

    if (!result) {
      // This might happen if the ID doesn't exist, but payload.delete might throw instead.
      // Depending on Payload version, error handling might differ.
      console.warn(`Chat session with ID ${chatId} not found for deletion.`);
      return { error: 'Chat session not found.' }; 
    }

    console.log(`Deleted chat session with ID: ${chatId}`);
    return true;
  } catch (error) {
    console.error(`Error deleting chat session ${chatId}:`, error);
    // Return a generic error or potentially more specific info if available
    return { error: `Failed to delete chat session: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}
