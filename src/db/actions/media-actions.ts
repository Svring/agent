'use server';

import { getPayload, type Where, type PaginatedDocs } from 'payload';
import configPromise from '@payload-config';
import type { Media } from '@/payload-types'; // Assuming Media type is generated

// NOTE: Actual file uploads require handling multipart/form-data
// and potentially using Payload's specific upload mechanisms or storage adapters.
// These functions primarily manage the Media document metadata.

const getPayloadClient = async () => {
  const payload = await getPayload({
    config: configPromise,
  });
  return payload;
};

// Placeholder for creating media metadata (actual upload handled separately)
export const createMediaMetadata = async (data: Omit<Media, 'id' | 'createdAt' | 'updatedAt' | 'url' | 'thumbnailURL' | 'filesize' | 'mimeType' | 'width' | 'height'>): Promise<Media | null> => {
  try {
    const payload = await getPayloadClient();
    // Ensure required fields like 'alt' are provided
    if (!data.alt) {
        throw new Error('Alt text is required for media');
    }
    const newMedia = await payload.create({
      collection: 'media',
      data: data as any, 
      // Note: You might need to pass file data here if not using separate upload flow
      // filePath: ..., 
    });
    return newMedia;
  } catch (error) {
    console.error('Error creating media metadata:', error);
    return null;
  }
};

export const getMediaById = async (id: string | number): Promise<Media | null> => {
  try {
    const payload = await getPayloadClient();
    const media = await payload.findByID({
      collection: 'media',
      id: id,
    });
    return media;
  } catch (error) {
    console.error(`Error fetching media with ID ${id}:`, error);
    return null;
  }
};

export const updateMediaMetadata = async (id: string | number, data: Partial<Omit<Media, 'id' | 'createdAt' | 'updatedAt' | 'url' | 'thumbnailURL' | 'filesize' | 'mimeType' | 'width' | 'height'>>): Promise<Media | null> => {
  try {
    const payload = await getPayloadClient();
    const updatedMedia = await payload.update({
      collection: 'media',
      id: id,
      data: data as any,
    });
    return updatedMedia;
  } catch (error) {
    console.error(`Error updating media metadata with ID ${id}:`, error);
    return null;
  }
};

export const deleteMedia = async (id: string | number): Promise<boolean> => {
  try {
    const payload = await getPayloadClient();
    await payload.delete({
      collection: 'media',
      id: id,
    });
    return true;
  } catch (error) {
    console.error(`Error deleting media with ID ${id}:`, error);
    return false;
  }
};

interface FindMediaArgs {
  where?: Where;
  sort?: string;
  limit?: number;
  page?: number;
  depth?: number;
}

export const findMedia = async ({ where, sort, limit, page, depth }: FindMediaArgs = {}): Promise<PaginatedDocs<Media> | null> => {
  try {
    const payload = await getPayloadClient();
    const results = await payload.find({
      collection: 'media',
      where,
      sort,
      limit,
      page,
      depth,
    });
    return results;
  } catch (error) {
    console.error('Error finding media:', error);
    return null;
  }
};
