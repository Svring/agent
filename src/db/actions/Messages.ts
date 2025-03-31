import { getPayload } from 'payload';
import config from '@payload-config';
import type { Message as PayloadMessage, ChatSession } from '../../payload-types';
import type { Message as VercelAIMessage } from 'ai'; // Import Vercel AI Message type

// Define a more specific type for our messages that includes tool properties
// This extends the base VercelAIMessage type with the additional fields we need
interface EnhancedMessage extends VercelAIMessage {
  toolCallId?: string;
  toolName?: string;
  parts?: any[];
}

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
      const message: EnhancedMessage = {
        id: doc.id.toString(), // Ensure ID is a string
        role: doc.role as VercelAIMessage['role'], // Cast to compatible role
        createdAt: new Date(doc.createdAt),
        content: '', // Initialize with empty content as required by VercelAIMessage
      };

      // Add parts array if it exists
      if (doc.parts && Array.isArray(doc.parts)) {
        message.parts = doc.parts;
      }

      // Add tool-specific fields if present
      if (doc.toolCallId) message.toolCallId = doc.toolCallId;
      if (doc.toolName) message.toolName = doc.toolName;

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
      // Cast the message to our enhanced type to access toolCallId and toolName
      const enhancedMessage = message as EnhancedMessage;
      
      // Build message data for Payload
      const messageData: any = {
        chatSession: chatSession.id,
        role: message.role,
      };

      // Add parts if they exist
      if ('parts' in enhancedMessage && enhancedMessage.parts) {
        messageData.parts = enhancedMessage.parts;
      }

      // Add tool-specific fields if they exist
      if ('toolCallId' in enhancedMessage && enhancedMessage.toolCallId) {
        messageData.toolCallId = enhancedMessage.toolCallId;
      }
      
      if ('toolName' in enhancedMessage && enhancedMessage.toolName) {
        messageData.toolName = enhancedMessage.toolName;
      }

      await payload.create({
        collection: 'messages',
        data: messageData,
      });
    }

    console.log(`Saved ${messages.length} messages for chat session ${id}`);
  } catch (error) {
    console.error(`Error saving chat messages for ID ${id}:`, error);
    throw new Error(`Failed to save chat: ${error}`);
  }
} 