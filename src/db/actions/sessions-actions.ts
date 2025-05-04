'use server';

import { getPayload, type Where, type PaginatedDocs } from 'payload';
import configPromise from '@payload-config';
import type { Session } from '@/payload-types'; // Assuming Session type is generated

const getPayloadClient = async () => {
  const payload = await getPayload({
    config: configPromise,
  });
  return payload;
};

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

// Add functions for managing messages in a session if needed, e.g.:
// export const addMessageToSession = async (sessionId: string | number, messageId: string | number): Promise<Session | null> => { ... };
// export const removeMessageFromSession = async (sessionId: string | number, messageId: string | number): Promise<Session | null> => { ... };
