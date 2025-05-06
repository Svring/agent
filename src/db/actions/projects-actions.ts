'use server';

import { getPayload, type Where, type PaginatedDocs } from 'payload';
import configPromise from '@payload-config';
import type { Project } from '@/payload-types'; // Assuming Project type is generated
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import type { User } from "@/payload-types";

const getPayloadClient = async () => {
  const payload = await getPayload({
    config: configPromise,
  });
  return payload;
};

/**
 * Create a new project and automatically associate it with the current user
 */
export const createProject = async (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project | null> => {
  try {
    const payload = await getPayloadClient();
    
    // Get the current authenticated user
    const headersList = await headers();
    const { user } = await payload.auth({ headers: headersList });
    
    if (!user) {
      throw new Error('You must be logged in to create a project');
    }
    
    // Create the project
    const newProject = await payload.create({
      collection: 'projects',
      data: data as any,
    });

    if (!newProject) {
      throw new Error('Failed to create the project');
    }
    
    // Get the user's current projects
    const currentUser = await payload.findByID({
      collection: 'users',
      id: user.id,
    });
    
    if (!currentUser) {
      throw new Error('Failed to find the current user');
    }
    
    // Associate the new project with the user
    const existingProjects = currentUser.projects || [];
    const projectIds = Array.isArray(existingProjects) 
      ? existingProjects.map(p => typeof p === 'object' && p !== null ? p.id : p)
        .filter(id => id !== undefined && id !== null)
      : [];
      
    // Add the new project ID if it's not already in the list
    if (!projectIds.includes(newProject.id)) {
      // Update the user with the new project
      await payload.update({
        collection: 'users',
        id: user.id,
        data: {
          projects: [...projectIds, newProject.id]
        }
      });
    }
    
    // Revalidate related pages
    revalidatePath('/projects');
    revalidatePath('/');
    
    return newProject;
  } catch (error) {
    console.error('Error creating project:', error);
    throw error; // Re-throw to allow form to handle the error
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

/**
 * Update an existing project.
 * @param projectId - The ID of the project to update.
 * @param data - The partial data to update (e.g., { name: 'New Name' }).
 * @returns The updated project or null if there's an error.
 */
export const updateProject = async (projectId: string | number, data: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Project | null> => {
  try {
    const payload = await getPayloadClient();
    const updatedProject = await payload.update({
      collection: 'projects',
      id: projectId,
      data: data as any, // Cast to any if needed for Payload compatibility
    });

    if (updatedProject) {
      // Revalidate the specific project page and the projects list page
      revalidatePath(`/projects/${projectId}`);
      revalidatePath('/projects');
    }

    return updatedProject;
  } catch (error) {
    console.error(`Error updating project with ID ${projectId}:`, error);
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
