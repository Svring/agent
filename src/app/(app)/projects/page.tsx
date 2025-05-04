import React from 'react';
import { getCurrentUser } from '@/db/actions/users-actions';
// Remove findProjects import as we get projects from the user object
// import { findProjects } from '@/db/actions/projects-actions'; 
import { ProjectsBanner } from '@/components/projects-display/projects-banner';
import { ProjectCard } from '@/components/projects-display/projects-card';
import type { User, Project } from '@/payload-types';
import { redirect } from 'next/navigation';

export default async function ProjectsPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    // Redirect to login if user is not found
    redirect('/login');
  }

  // Extract projects. Payload relationship fields can be an array of IDs or populated objects.
  // We need to handle both cases. Let's assume for now it might be populated.
  const projects: Project[] = (currentUser.projects || [])
    .map(proj => (typeof proj === 'object' ? proj : null))
    .filter((p): p is Project => p !== null);

  // TODO: If currentUser.projects is only IDs (e.g., string[] or number[]),
  // you'll need an additional fetch:
  // const projectIds = (currentUser.projects || []).filter(id => typeof id === 'string' || typeof id === 'number');
  // if (projectIds.length > 0) {
  //   const fetchedProjectsData = await findProjects({ where: { id: { in: projectIds } } });
  //   projects = fetchedProjectsData?.docs || [];
  // }

  return (
    <div className="h-full w-full bg-gradient-to-b rounded-lg p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <ProjectsBanner />

        {projects.length > 0 ? (
          <div className="flex flex-col space-y-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-10">
            <p>You haven't been assigned to any projects yet.</p>
            {/* Optionally add a button/link to create a project if applicable */}
          </div>
        )}
      </div>
    </div>
  );
}
