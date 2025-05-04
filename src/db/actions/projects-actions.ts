'use server';

import { getPayload, type Where, type PaginatedDocs } from 'payload';
import configPromise from '@payload-config';
import type { Project } from '@/payload-types'; // Assuming Project type is generated

const getPayloadClient = async () => {
  const payload = await getPayload({
    config: configPromise,
  });
  return payload;
};

export const createProject = async (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project | null> => {
  try {
    const payload = await getPayloadClient();
    const newProject = await payload.create({
      collection: 'projects',
      data: data as any,
    });
    return newProject;
  } catch (error) {
    console.error('Error creating project:', error);
    return null;
  }
};

export const getProjectById = async (id: string | number): Promise<Project | null> => {
  try {
    const payload = await getPayloadClient();
    const project = await payload.findByID({
      collection: 'projects',
      id: id,
    });
    return project;
  } catch (error) {
    console.error(`Error fetching project with ID ${id}:`, error);
    return null;
  }
};

export const updateProject = async (id: string | number, data: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Project | null> => {
  try {
    const payload = await getPayloadClient();
    const updatedProject = await payload.update({
      collection: 'projects',
      id: id,
      data: data as any,
    });
    return updatedProject;
  } catch (error) {
    console.error(`Error updating project with ID ${id}:`, error);
    return null;
  }
};

export const deleteProject = async (id: string | number): Promise<boolean> => {
  try {
    const payload = await getPayloadClient();
    await payload.delete({
      collection: 'projects',
      id: id,
    });
    return true;
  } catch (error) {
    console.error(`Error deleting project with ID ${id}:`, error);
    return false;
  }
};

interface FindProjectsArgs {
  where?: Where;
  sort?: string;
  limit?: number;
  page?: number;
  depth?: number;
}

export const findProjects = async ({ where, sort, limit, page, depth }: FindProjectsArgs = {}): Promise<PaginatedDocs<Project> | null> => {
  try {
    const payload = await getPayloadClient();
    const results = await payload.find({
      collection: 'projects',
      where,
      sort,
      limit,
      page,
      depth,
    });
    return results;
  } catch (error) {
    console.error('Error finding projects:', error);
    return null;
  }
};
