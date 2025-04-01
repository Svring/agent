'use server';

import { getPayload } from 'payload';
import config from '@payload-config';
import type { Message as PayloadMessage, ChatSession } from '../../payload-types';
import type { Message as VercelAIMessage, TextPart, ToolInvocation } from 'ai';

// Remove the specific EnhancedMessage interface, VercelAIMessage should be sufficient
// interface EnhancedMessage extends VercelAIMessage {
//   toolCallId?: string;
//   toolName?: string;
//   parts?: any[];
// }

// Find a chat session by the name field (which stores the original generatedId)
async function findChatSessionByName(chatId: string): Promise<ChatSession | null> {
  const payload = await getPayload({ config });
  try {
    const result = await payload.find({
      collection: 'chat_sessions',
      where: {
        name: { equals: chatId },
      },
      limit: 1,
    });
    return result.docs.length > 0 ? result.docs[0] : null;
  } catch (error) {
    console.error(`Error finding chat session by name ${chatId}:`, error);
    return null;
  }
}

/**
 * Loads messages for a chat session identified by its ID.
 * Replaces the file-based implementation with a database storage method.
 * 
 * @param id The unique chat ID (name of the chat session)
 * @returns Array of Vercel AI SDK compatible Message objects
 */
export async function loadChat(id: string): Promise<VercelAIMessage[]> {
  const payload = await getPayload({ config });
  try {
    // First, find the chat session by its name (which contains the original ID)
    const chatSession = await findChatSessionByName(id);
    if (!chatSession) {
      console.warn(`Chat session with name ${id} not found`);
      return []; // Return empty array if chat session not found
    }

    // Then, find all messages for this chat session
    const result = await payload.find({
      collection: 'messages',
      where: {
        chatSession: { equals: chatSession.id },
      },
      sort: 'createdAt', // Order by creation time
      limit: 1000, // Adjust as needed
    });

    // Convert Payload messages to Vercel AI messages
    const aiMessages: VercelAIMessage[] = result.docs.map((doc: PayloadMessage) => {
      // Create base message with common properties
      const message: VercelAIMessage = {
        id: doc.id.toString(), // Ensure ID is a string
        role: doc.role as VercelAIMessage['role'], // Cast to compatible role
        createdAt: new Date(doc.createdAt),
        content: doc.content || '', // Use the top-level content field from DB
        parts: (doc.parts || []) as any, // Cast parts to any to avoid type conflicts
      };

      return message;
    });

    return aiMessages;
  } catch (error) {
    console.error(`Error loading chat messages for ID ${id}:`, error);
    return []; // Return empty array on error
  }
}

/**
 * Saves messages for a chat session.
 * Replaces the file-based implementation with a database storage method.
 * 
 * @param id The unique chat ID (name of the chat session)
 * @param messages Array of Vercel AI SDK Message objects to save
 */
export async function saveChat({
  id,
  messages,
}: {
  id: string;
  messages: VercelAIMessage[];
}): Promise<void> {
  const payload = await getPayload({ config });
  try {
    // Find the chat session by its name field
    const chatSession = await findChatSessionByName(id);
    if (!chatSession) {
      throw new Error(`Chat session with name ${id} not found`);
    }

    // Delete existing messages for this chat session
    // This is a simple approach - a more sophisticated one might update existing messages
    await payload.delete({
      collection: 'messages',
      where: {
        chatSession: { equals: chatSession.id },
      },
    });

    // Create new messages
    for (const message of messages) {
      // Define roles compatible with our Payload schema
      const payloadRoles: PayloadMessage['role'][] = ['user', 'assistant', 'tool'];
      if (!payloadRoles.includes(message.role as any)) {
        console.warn(`[saveChat] Skipping message with role not in Payload schema: ${message.role}`);
        continue; // Skip roles not defined in Payload
      }
      
      // Build message data for Payload
      const messageData: Partial<PayloadMessage> = {
        chatSession: chatSession.id,
        role: message.role as 'user' | 'assistant' | 'tool',
        content: message.content,
        parts: (message.parts || []) as any, // Cast parts to any to avoid type conflicts
      };

      await payload.create({
        collection: 'messages',
        data: messageData as Omit<PayloadMessage, 'id' | 'updatedAt' | 'createdAt'>,
      });
    }

    console.log(`Saved ${messages.length} messages for chat session ${id}`);
  } catch (error) {
    console.error(`Error saving chat messages for ID ${id}:`, error);
    throw new Error(`Failed to save chat: ${error}`);
  }
} 