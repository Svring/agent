import { useState, useEffect } from 'react';
import { Project } from '@/payload-types';
import { getProjectById } from '@/db/actions/projects-actions';

export function useProjectDetails(projectId: string | undefined | null, userId: string | undefined | null) {
  const [projectDetails, setProjectDetails] = useState<Project | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const [projectError, setProjectError] = useState<string | null>(null);

  useEffect(() => {
    if (projectId && userId) {
      setIsLoadingProject(true);
      setProjectError(null);
      getProjectById(projectId)
        .then(data => {
          if (data) {
            setProjectDetails(data);
            // Set this project as active for the current user when project details load
            if (userId && data.id) {
              console.log(`[useProjectDetails] Setting active project ${data.id} for user ${userId} via API`);
              fetch('/api/language', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'setActiveProject',
                  projectId: data.id.toString()
                })
              })
                .then(response => response.json())
                .then(result => {
                  if (result.success) {
                    console.log("[useProjectDetails] Active project set successfully");
                  } else {
                    console.error("[useProjectDetails] Failed to set active project:", result.message);
                  }
                })
                .catch(err => {
                  console.error("[useProjectDetails] Error setting active project:", err);
                });
            }
          } else {
            const errMsg = `Project details not found for ID: ${projectId}`;
            console.error(`[useProjectDetails] ${errMsg}`);
            setProjectError(errMsg);
            setProjectDetails(null);
          }
        })
        .catch(err => {
          const errMsg = `Error fetching project details: ${err instanceof Error ? err.message : String(err)}`;
          console.error(`[useProjectDetails] ${errMsg}`);
          setProjectError(errMsg);
          setProjectDetails(null);
        })
        .finally(() => {
          setIsLoadingProject(false);
        });
    } else {
      setProjectDetails(null);
      setIsLoadingProject(false);
      if (!projectId && userId) setProjectError("Project ID is missing.");
      // else if (projectId && !userId) setProjectError("User ID is missing for project details."); // Less likely scenario if auth is checked first
    }
  }, [projectId, userId]);

  return { projectDetails, isLoadingProject, projectError };
} 