'use server';

import { getPayload, type Where, type PaginatedDocs } from 'payload';
import configPromise from '@payload-config';
import type { Message } from '@/payload-types'; // Assuming Message type is generated
import type { PlanStep } from '@/models/chatSchemas';

const getPayloadClient = async () => {
  const payload = await getPayload({
    config: configPromise,
  });
  return payload;
};

export const createMessage = async (data: Omit<Message, 'id' | 'createdAt' | 'updatedAt'>): Promise<Message | null> => {
  try {
    const payload = await getPayloadClient();
    const newMessage = await payload.create({
      collection: 'messages',
      data: data as any, // Cast might be needed depending on exact type match
    });
    return newMessage;
  } catch (error) {
    console.error('Error creating message:', error);
    return null;
  }
};

export const getMessageById = async (id: string | number): Promise<Message | null> => {
  try {
    const payload = await getPayloadClient();
    const message = await payload.findByID({
      collection: 'messages',
      id: id,
    });
    return message;
  } catch (error) {
    console.error(`Error fetching message with ID ${id}:`, error);
    return null;
  }
};

export const updateMessage = async (id: string | number, data: Partial<Omit<Message, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Message | null> => {
  try {
    const payload = await getPayloadClient();
    const updatedMessage = await payload.update({
      collection: 'messages',
      id: id,
      data: data as any, // Cast might be needed
    });
    return updatedMessage;
  } catch (error) {
    console.error(`Error updating message with ID ${id}:`, error);
    return null;
  }
};

export const deleteMessage = async (id: string | number): Promise<boolean> => {
  try {
    const payload = await getPayloadClient();
    await payload.delete({
      collection: 'messages',
      id: id,
    });
    return true;
  } catch (error) {
    console.error(`Error deleting message with ID ${id}:`, error);
    return false;
  }
};

export const addPlanToMessage = async (messageId: string | number, plan: PlanStep[]): Promise<Message | null> => {
  try {
    const payload = await getPayloadClient();
    const updatedMessage = await payload.update({
      collection: 'messages',
      id: messageId,
      data: { 
        plan: plan as any, // Cast to any if PlanStep[] isn't directly assignable to the expected type by payload
      },
    });
    return updatedMessage;
  } catch (error) {
    console.error(`Error adding plan to message with ID ${messageId}:`, error);
    return null;
  }
};

interface FindMessagesArgs {
  where?: Where;
  sort?: string;
  limit?: number;
  page?: number;
  depth?: number;
}

export const findMessages = async ({ where, sort, limit, page, depth }: FindMessagesArgs = {}): Promise<PaginatedDocs<Message> | null> => {
  try {
    const payload = await getPayloadClient();
    const results = await payload.find({
      collection: 'messages',
      where,
      sort,
      limit,
      page,
      depth,
    });
    return results;
  } catch (error) {
    console.error('Error finding messages:', error);
    return null;
  }
};
