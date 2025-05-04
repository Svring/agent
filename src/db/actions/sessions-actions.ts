'use server';

import { getPayload, type Where, type PaginatedDocs } from 'payload';
import configPromise from '@payload-config';
import type { Session, Project } from '@/payload-types'; // Import Project type
import { revalidatePath } from 'next/cache';
import { MessageSchema } from '@/app/(app)/api/opera/counterfeit/schemas';

const getPayloadClient = async () => {
  const payload = await getPayload({
    config: configPromise,
  });
  return payload;
};

/**
 * Create a new session and associate it with a project.
 */
export const createSessionForProject = async (projectId: string | number, sessionData: Partial<Omit<Session, 'id' | 'createdAt' | 'updatedAt'>> = {}): Promise<Session | null> => {
  try {
    const payload = await getPayloadClient();

    // 1. Create the new session
    const newSession = await payload.create({
      collection: 'sessions',
      data: {
        ...sessionData,
        name: sessionData.name || `Session ${new Date().toISOString()}`, // Default name
      } as any,
    });

    if (!newSession) {
      throw new Error('Failed to create session');
    }

    // 2. Get the project (type assertion might be needed after fetch)
    const project = await payload.findByID({
      collection: 'projects',
      id: projectId,
      depth: 0, // Don't need full depth here
    });

    if (!project) {
      // Optionally delete the orphaned session or just log an error
      console.error(`Project with ID ${projectId} not found after creating session ${newSession.id}`);
      throw new Error(`Project with ID ${projectId} not found.`);
    }

    // Cast project to Project type after fetching
    const typedProject = project as Project;

    // 3. Update the project's sessions relationship
    const existingSessions = Array.isArray(typedProject.sessions)
        ? typedProject.sessions.map((s: any) => (typeof s === 'object' && s !== null ? s.id : s)).filter(Boolean)
        : [];

    await payload.update({
      collection: 'projects',
      id: projectId,
      data: {
        sessions: [...existingSessions, newSession.id],
      },
    });

    // Revalidate project page
    revalidatePath(`/projects/${projectId}`);
    revalidatePath('/projects'); // Also revalidate the list page

    return newSession;
  } catch (error) {
    console.error('Error creating session for project:', error);
    return null;
  }
};

// Remove original createSession if it exists and is not needed
/*
export const createSession = async (data: Partial<Omit<Session, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Session | null> => {
  try {
    const payload = await getPayloadClient();
    const newSession = await payload.create({
      collection: 'sessions',
      data: data as any,
    });
    return newSession;
  } catch (error) {
    console.error('Error creating session:', error);
    return null;
  }
};
*/

export const getSessionById = async (id: string | number): Promise<Session | null> => {
  try {
    const payload = await getPayloadClient();
    const session = await payload.findByID({
      collection: 'sessions',
      id: id,
    });
    return session;
  } catch (error) {
    console.error(`Error fetching session with ID ${id}:`, error);
    return null;
  }
};

export const updateSession = async (id: string | number, data: Partial<Omit<Session, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Session | null> => {
  try {
    const payload = await getPayloadClient();
    const updatedSession = await payload.update({
      collection: 'sessions',
      id: id,
      data: data as any,
    });
    return updatedSession;
  } catch (error) {
    console.error(`Error updating session with ID ${id}:`, error);
    return null;
  }
};

export const deleteSession = async (id: string | number): Promise<boolean> => {
  try {
    const payload = await getPayloadClient();
    await payload.delete({
      collection: 'sessions',
      id: id,
    });
    return true;
  } catch (error) {
    console.error(`Error deleting session with ID ${id}:`, error);
    return false;
  }
};

interface FindSessionsArgs {
  where?: Where;
  sort?: string;
  limit?: number;
  page?: number;
  depth?: number;
}

export const findSessions = async ({ where, sort, limit, page, depth }: FindSessionsArgs = {}): Promise<PaginatedDocs<Session> | null> => {
  try {
    const payload = await getPayloadClient();
    const results = await payload.find({
      collection: 'sessions',
      where,
      sort,
      limit,
      page,
      depth,
    });
    return results;
  } catch (error) {
    console.error('Error finding sessions:', error);
    return null;
  }
};

/**
 * Fetch all messages for a specific session, formatted for chat initialization.
 * @param sessionId - The ID of the session to fetch messages for.
 * @returns An array of messages formatted according to MessageSchema, or null if there's an error.
 */
export const getSessionMessagesForChat = async (sessionId: string | number): Promise<any[] | null> => {
  try {
    const payload = await getPayloadClient();
    const messagesResult = await payload.find({
      collection: 'messages',
      where: {
        session: {
          equals: sessionId,
        },
      },
      sort: 'createdAt',
      depth: 0,
    });

    if (!messagesResult.docs || messagesResult.docs.length === 0) {
      return [];
    }

    // Format messages according to MessageSchema and validate
    const formattedMessages = messagesResult.docs
      .map((msg: any) => {
        // Create a formatted message object
        const formattedMessage = {
          id: msg.messageId || msg.id.toString(),
          content: msg.content || '',
          role: msg.role || 'assistant',
          parts: msg.parts || [],
          annotations: msg.annotations || [],
          createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined,
        };

        // Try to use rawData if available as it already might be properly formatted
        if (msg.rawData) {
          // If rawData exists and is already validated by the schema (during save)
          return msg.rawData;
        }

        // Validate against MessageSchema
        const validationResult = MessageSchema.safeParse(formattedMessage);
        if (!validationResult.success) {
          console.warn(`Message ${msg.id} failed validation:`, validationResult.error);
          return null; // Skip invalid messages
        }

        return validationResult.data;
      })
      .filter(Boolean); // Remove null entries (failed validation)

    return formattedMessages;
  } catch (error) {
    console.error(`Error fetching messages for session ${sessionId}:`, error);
    return null;
  }
};

/**
 * Saves or updates messages for a specific session and updates the session's message list.
 * @param sessionId - The ID of the session.
 * @param messages - An array of messages conforming to the Message schema.
 * @returns True if successful, false otherwise.
 */
export const saveSessionMessages = async (sessionId: string | number, messages: any[]): Promise<boolean> => {
  let success = true; // Track overall success
  const processedMessageDbIds = new Set<string | number>(); // Store DB IDs of processed messages

  try {
    const payload = await getPayloadClient();

    const numericSessionId = typeof sessionId === 'string' ? parseInt(sessionId, 10) : sessionId;
    if (isNaN(numericSessionId)) {
      console.error(`[ERROR] Invalid session ID after parsing: ${sessionId} -> ${numericSessionId}`);
      return false;
    }
    console.log(`[DEBUG] Using numericSessionId: ${numericSessionId} (${typeof numericSessionId}) for all operations.`);

    // --- Verify Session Existence --- 
    let existingSession: any;
    try {
      existingSession = await payload.findByID({
        collection: 'sessions',
        id: numericSessionId,
        depth: 0, // Don't need message details here
      });
      if (!existingSession) {
        console.error(`[ERROR] Session with numeric ID ${numericSessionId} not found. Cannot save messages.`);
        return false;
      }
      console.log(`[DEBUG] Session found, current message count (if populated): ${existingSession.messages?.length ?? 0}`);
    } catch (sessionCheckError) {
      console.error(`[DEBUG] Error checking session existence:`, sessionCheckError);
      return false;
    }
    // --- End Session Verification ---

    // --- Process Each Message --- 
    for (const message of messages) {
      const { session: _messageSession, ...messageWithoutSession } = message;
      const validationResult = MessageSchema.safeParse(messageWithoutSession);
      if (!validationResult.success) {
        console.warn(`Skipping save for invalid message structure in session ${sessionId}:`, validationResult.error.flatten());
        continue; 
      }
      const validMessage = validationResult.data;
      const dbMessageData = {
        messageId: validMessage.id,
        content: validMessage.content,
        role: validMessage.role,
        parts: validMessage.parts,
        annotations: validMessage.annotations,
        createdAt: validMessage.createdAt,
        session: numericSessionId,
        rawData: validMessage,
      };

      try {
        const existing = await payload.find({
          collection: 'messages',
          where: {
            messageId: { equals: validMessage.id },
            session: { equals: numericSessionId }, 
          },
          limit: 1,
          depth: 0,
        });

        let savedMessageDbId: string | number;
        if (existing.docs.length > 0) {
          savedMessageDbId = existing.docs[0].id;
          console.log(`[DEBUG] Updating existing message with DB ID: ${savedMessageDbId}`);
          await payload.update({
            collection: 'messages',
            id: savedMessageDbId,
            data: dbMessageData as any,
          });
          console.log(`[DEBUG] Successfully updated message ${validMessage.id}`);
        } else {
          console.log(`[DEBUG] Creating new message with messageId: ${validMessage.id}`);
          const createdMessage = await payload.create({
            collection: 'messages',
            data: dbMessageData as any,
          });
          savedMessageDbId = createdMessage.id;
          console.log(`[DEBUG] Successfully created message, DB ID: ${savedMessageDbId}`);
        }
        processedMessageDbIds.add(savedMessageDbId); // Add the DB ID of the processed message

      } catch (dbError) {
        console.error(`[ERROR] Failed to save message ${validMessage.id} for session ${sessionId}: ${(dbError as Error).message}`);
        success = false; // Mark failure if any message save fails
        // Continue processing other messages
      }
    }
    // --- End Message Processing --- 

    // --- Update Session's Message List --- 
    try {
      console.log(`[DEBUG] Updating session ${numericSessionId} message list.`);
      // Get current message IDs stored ON the session document (might be empty or just IDs)
      const currentSessionMessageIds = new Set(
         (existingSession.messages || []).map((m: any) => typeof m === 'object' ? m.id : m)
       );
       
      // Combine existing and newly processed IDs
      processedMessageDbIds.forEach(id => currentSessionMessageIds.add(id));
      const finalMessageIds = Array.from(currentSessionMessageIds);
      
      // Only update if the list has changed (or maybe always update to be safe?)
      // For simplicity, let's always update if we processed messages
      if (processedMessageDbIds.size > 0) {
         console.log(`[DEBUG] Final message ID list for session ${numericSessionId}:`, finalMessageIds);
          await payload.update({
            collection: 'sessions',
            id: numericSessionId,
            data: {
              // Cast to any[] to satisfy TS strictness, Payload handles ID arrays correctly
              messages: finalMessageIds as any[], 
            },
          });
          console.log(`[DEBUG] Successfully updated session ${numericSessionId} with ${finalMessageIds.length} message relationships.`);
      } else {
         console.log(`[DEBUG] Session ${numericSessionId} did not require message list update.`);
      }
    } catch (sessionUpdateError) {
      console.error(`[ERROR] Failed to update session ${numericSessionId} message list:`, sessionUpdateError);
      success = false; // Mark failure if session update fails
    }
    // --- End Session Update --- 

    return success; // Return true only if all steps succeeded

  } catch (error) {
    console.error(`[ERROR] General error in saveSessionMessages for session ${sessionId}: ${(error as Error).message}`);
    return false;
  }
};

// Add functions for managing messages in a session if needed, e.g.:
// export const addMessageToSession = async (sessionId: string | number, messageId: string | number): Promise<Session | null> => { ... };
// export const removeMessageFromSession = async (sessionId: string | number, messageId: string | number): Promise<Session | null> => { ... };
