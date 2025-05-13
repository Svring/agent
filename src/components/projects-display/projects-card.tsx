'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server, Globe, FolderGit2, ExternalLink, Database } from 'lucide-react';
import type { Project } from '@/payload-types';

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  // Basic error handling if project data is incomplete
  if (!project || typeof project !== 'object') {
    return (
      // Use bg-card and border for theme consistency
      <Card className="mb-4 bg-card border">
        <CardHeader>
          {/* Use text-destructive for error text */}
          <CardTitle className="text-destructive">Error</CardTitle>
          <CardDescription>Invalid project data</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { id, name, production_address, dev_address = [], vector_store_address } = project;
  const hasDevEnvironments = Array.isArray(dev_address) && dev_address.length > 0;
  const hasProductionAddress = !!production_address;
  const hasVectorStoreAddress = !!vector_store_address;

  return (
    // Use bg-card and border for theme consistency
    // Removed backdrop-blur and explicit opacity for simplicity, can be added back if needed
    <Card className="mb-4 w-full bg-card border hover:shadow-md transition-shadow duration-200 p-4">
      <Link href={`/projects/${id}`} className="block hover:no-underline">
        <CardHeader className="pb-2">
          <div className="flex items-center space-x-3">
             <FolderGit2 className="h-6 w-6 text-primary" />
             {/* Use text-foreground */}
             <CardTitle className="text-lg font-semibold text-foreground truncate">{name || 'Untitled Project'}</CardTitle>
          </div>
        </CardHeader>
        
        <CardContent className="pb-4">
          <div className="grid gap-2">
            {/* Production Environment */}
            <div className="flex items-start">
              <Globe className="h-4 w-4 text-muted-foreground mr-2 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Production</p>
                {hasProductionAddress ? (
                  <div className="flex items-center mt-1">
                    <p className="text-xs text-muted-foreground">{production_address}</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No production address set</p>
                )}
              </div>
            </div>

            {/* Dev Environments */}
            <div className="flex items-start">
              <Server className="h-4 w-4 text-muted-foreground mr-2 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Development</p>
                {hasDevEnvironments ? (
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    {dev_address.length === 1 ? (
                      <p className="text-xs text-muted-foreground">
                        {dev_address[0].address}
                        {dev_address[0].port ? `:${dev_address[0].port}` : ''}
                      </p>
                    ) : (
                      <Badge variant="outline" className="text-xs px-2 py-0">
                        {dev_address.length} environments
                      </Badge>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No dev environments configured</p>
                )}
              </div>
            </div>

            {/* Vector Store Address */}
            <div className="flex items-start">
              <Database className="h-4 w-4 text-muted-foreground mr-2 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Vector Store</p>
                {hasVectorStoreAddress ? (
                  <div className="flex items-center mt-1">
                    <p className="text-xs text-muted-foreground truncate" title={vector_store_address}>{vector_store_address}</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Not configured</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="pt-0 pb-3">
          <p className="text-xs text-muted-foreground flex items-center">
            <ExternalLink className="h-3 w-3 mr-1" /> 
            View details
          </p>
        </CardFooter>
      </Link>
    </Card>
  );
}
