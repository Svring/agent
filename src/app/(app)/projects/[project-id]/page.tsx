'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { notFound, useParams } from 'next/navigation';
import { getProjectById, updateProject } from '@/db/actions/projects-actions';
import { Project } from '@/payload-types'; // Keep Project type
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { FolderGit2, Globe, Server, Calendar, FolderOpen, Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';
import { CreateSessionButton } from '@/components/projects-display/create-session-button';
import { Skeleton } from "@/components/ui/skeleton"; // For loading state

// Define DevAddress type locally based on Projects collection
interface DevAddress {
  id?: string | null; // id might be present from Payload
  address?: string | null;
  port?: number | null;
  username?: string | null;
  password?: string | null;
}

// Define a type for the dev environment being edited, including the temporary _id
interface EditingDevEnv extends DevAddress { 
  _id?: string; // Temporary ID for mapping/keys
}

export default function ProjectDetailPage() {
  const params = useParams<{ 'project-id': string }>();
  const projectId = params['project-id'];

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Editing state
  const [isEditingProd, setIsEditingProd] = useState(false);
  const [editingProdValue, setEditingProdValue] = useState<string>("");
  const [isEditingDev, setIsEditingDev] = useState(false);
  const [editingDevValues, setEditingDevValues] = useState<EditingDevEnv[]>([]);

  // Fetch project data
  useEffect(() => {
    if (!projectId) return;
    setIsLoading(true);
    getProjectById(projectId)
      .then((data) => {
        if (!data) {
          notFound(); // Or handle appropriately
        } else {
          setProject(data);
        }
      })
      .catch(err => {
        console.error("Failed to load project:", err);
        toast.error("Failed to load project details.");
        // Optionally redirect or show error state
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [projectId]);

  // --- Edit Handlers ---

  // Production Env
  const handleEditProdClick = () => {
    setEditingProdValue(project?.production_address || "");
    setIsEditingProd(true);
  };

  const handleCancelProd = () => {
    setIsEditingProd(false);
    setEditingProdValue(""); // Reset
  };

  const handleSaveProd = async () => {
    if (!project) return;
    try {
      const updated = await updateProject(project.id, { production_address: editingProdValue.trim() });
      if (updated) {
        setProject(updated); // Update local state
        toast.success("Production address updated.");
        handleCancelProd(); // Exit edit mode
      } else {
        toast.error("Failed to update production address.");
      }
    } catch (error) {
      toast.error("An error occurred while saving.");
      console.error(error);
    }
  };

  // Development Env
  const handleEditDevClick = () => {
    const initialDevValues = (project?.dev_address || []).map((env, index) => ({
      ...(env as DevAddress), // Cast to ensure type compatibility
      _id: env?.id || `temp-${index}-${Date.now()}`,
    }));
    setEditingDevValues(initialDevValues);
    setIsEditingDev(true);
  };

  const handleCancelDev = () => {
    setIsEditingDev(false);
    setEditingDevValues([]); // Reset
  };

  const handleDevInputChange = (index: number, field: keyof Omit<DevAddress, 'id'>, value: string | number | null) => {
    setEditingDevValues(current => 
      current.map((env, i) => 
        i === index ? { ...env, [field]: value } : env
      )
    );
  };

  const handleAddDevEnv = () => {
    setEditingDevValues(current => [...current, { _id: `temp-new-${Date.now()}` }]);
  };

  const handleRemoveDevEnv = (index: number) => {
    setEditingDevValues(current => current.filter((_, i) => i !== index));
  };

  const handleSaveDev = async () => {
    if (!project) return;
    // Prepare data for saving: remove temporary _id and convert fields if necessary
    const devDataToSave: DevAddress[] = editingDevValues.map(({ _id, id, ...rest }) => ({
        id: typeof id === 'string' && id.startsWith('temp-') ? undefined : id, // Keep original id if exists, discard temp id
        ...rest,
        port: rest.port ? Number(rest.port) : null, // Ensure port is number or null
        address: rest.address || null,
        username: rest.username || null,
        password: rest.password || null,
    }));
    
    try {
      const updated = await updateProject(project.id, { dev_address: devDataToSave });
      if (updated) {
        setProject(updated); // Update local state
        toast.success("Development environments updated.");
        handleCancelDev(); // Exit edit mode
      } else {
        toast.error("Failed to update development environments.");
      }
    } catch (error) {
      toast.error("An error occurred while saving.");
      console.error(error);
    }
  };

  // --- Loading State --- 
  if (isLoading) {
    return (
      <div className="container mx-auto py-6 max-w-4xl space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // --- Project Not Found (after loading) --- 
  if (!project) {
    // This case might be handled by the initial notFound() but added for robustness
    return (
       <div className="container mx-auto py-10 text-center">
          <h1 className="text-xl font-semibold">Project not found</h1>
          <Link href="/projects">
             <Button variant="link" className="mt-4">Go back to projects</Button>
          </Link>
       </div>
    );
  }

  // --- Display Logic --- 
  const { name, production_address, dev_address = [], sessions = [] } = project;
  const createdAt = project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'Unknown';
  const hasSessions = Array.isArray(sessions) && sessions.length > 0;

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      {/* Project Header - Basic, renaming handled in sidebar */} 
      <div className="flex items-center justify-between mb-6">
         {/* ... header content ... */}
         <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-full">
            <FolderGit2 className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{name}</h1>
            <p className="text-sm text-muted-foreground flex items-center mt-1">
              <Calendar className="h-3.5 w-3.5 mr-1" /> Created on {createdAt}
            </p>
          </div>
        </div>
        <Link href="/projects">
          <Button variant="outline">Back to Projects</Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        {/* Main Content */} 
        <div className="md:col-span-8 space-y-6">
          {/* Production Environment Card */} 
          <Card className="p-4">
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-0 px-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  Production Environment
                </CardTitle>
                <CardDescription>The primary deployment address</CardDescription>
              </div>
              {!isEditingProd && (
                <Button variant="ghost" size="icon" onClick={handleEditProdClick} className="h-7 w-7">
                  <Edit className="h-4 w-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isEditingProd ? (
                <div className="space-y-3">
                  <Label htmlFor="prod-address">Address</Label>
                  <Input 
                    id="prod-address"
                    value={editingProdValue}
                    onChange={(e) => setEditingProdValue(e.target.value)}
                    placeholder="e.g., myapp.com or 192.168.1.100"
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <Button variant="ghost" size="sm" onClick={handleCancelProd}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveProd}>Save</Button>
                  </div>
                </div>
              ) : (
                production_address ? (
                  <div className="p-3 bg-muted/50 border rounded-md">
                    <p className="font-mono text-sm truncate">{production_address}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Not configured.</p>
                )
              )}
            </CardContent>
          </Card>

          {/* Development Environments Card */} 
          <Card className="p-4">
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-0 px-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-primary" />
                  Development Environments
                </CardTitle>
                <CardDescription>Dev/testing environment details</CardDescription>
              </div>
              {!isEditingDev && (
                <Button variant="ghost" size="icon" onClick={handleEditDevClick} className="h-7 w-7">
                  <Edit className="h-4 w-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isEditingDev ? (
                <div className="space-y-4">
                  {editingDevValues.map((env, index) => (
                    <div key={env._id || index} className="p-3 border rounded-md space-y-2 relative group">
                       <Button 
                         variant="destructive"
                         size="icon"
                         className="absolute top-1 right-1 h-6 w-6 text-destructive-foreground hover:bg-destructive/90 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                         onClick={() => handleRemoveDevEnv(index)}
                         title="Remove Environment"
                       >
                         <Trash2 className="h-3.5 w-3.5" />
                       </Button>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                         <div>
                            <Label htmlFor={`dev-addr-${index}`}>Address</Label>
                            <Input 
                               id={`dev-addr-${index}`}
                               value={env.address || ''}
                               onChange={(e) => handleDevInputChange(index, 'address', e.target.value || null)}
                               placeholder="e.g., dev.myapp.com or IP"
                            />
                         </div>
                         <div>
                            <Label htmlFor={`dev-port-${index}`}>Port</Label>
                            <Input 
                               id={`dev-port-${index}`}
                               type="number"
                               value={env.port || ''}
                               onChange={(e) => handleDevInputChange(index, 'port', e.target.value ? parseInt(e.target.value, 10) : null)}
                               placeholder="e.g., 8080"
                            />
                         </div>
                      </div>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                         <div>
                            <Label htmlFor={`dev-user-${index}`}>Username <span className="text-xs text-muted-foreground">(Optional)</span></Label>
                            <Input 
                               id={`dev-user-${index}`}
                               value={env.username || ''}
                               onChange={(e) => handleDevInputChange(index, 'username', e.target.value || null)}
                               placeholder="Username"
                            />
                         </div>
                         <div>
                            <Label htmlFor={`dev-pass-${index}`}>Password <span className="text-xs text-muted-foreground">(Optional)</span></Label>
                            <Input 
                               id={`dev-pass-${index}`}
                               type="password"
                               value={env.password || ''}
                               onChange={(e) => handleDevInputChange(index, 'password', e.target.value || null)}
                               placeholder="Password"
                            />
                         </div>
                       </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={handleAddDevEnv} className="mt-2">
                     <Plus className="mr-2 h-4 w-4" /> Add Environment
                  </Button>
                  <div className="flex justify-end gap-2 mt-4 border-t pt-4">
                    <Button variant="ghost" size="sm" onClick={handleCancelDev}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveDev}>Save Dev Environments</Button>
                  </div>
                </div>
              ) : (
                dev_address && dev_address.length > 0 ? (
                  <div className="space-y-3">
                    {(dev_address as DevAddress[]).map((env, index) => ( // Cast for type safety
                      <div key={env.id || index} className="p-3 bg-muted/50 border rounded-md">
                        <div className="flex flex-col gap-1">
                           <div className="flex items-center justify-between">
                             <p className="font-mono text-sm">
                               {env.address}
                               {env.port ? `:${env.port}` : ''}
                             </p>
                             <Badge variant="outline" className="text-xs">{index === 0 ? 'Primary Dev' : `Dev ${index + 1}`}</Badge>
                           </div>
                           {(env.username || env.password) && (
                             <div className="grid grid-cols-2 gap-3 mt-2 text-xs text-muted-foreground/80">
                               {env.username && (
                                 <div>
                                   <span className="font-medium">Username:</span> {env.username}
                                 </div>
                               )}
                               {env.password && (
                                 <div>
                                   <span className="font-medium">Password:</span> <span className='italic'>••••••••</span>
                                 </div>
                               )}
                             </div>
                           )}
                         </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No development environments configured.</p>
                )
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */} 
        <div className="md:col-span-4 space-y-6">
           {/* Sessions Card - Minimal change, links to session page */}
           <Card className="p-4">
            <CardHeader className="pb-2 pt-0 px-0">
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-primary" />
                Sessions
              </CardTitle>
              <CardDescription>Work sessions for this project</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {hasSessions ? (
                <div className="space-y-2">
                  {Array.isArray(sessions) && sessions.slice(0, 5).map((session, index) => {
                    const sessionName = typeof session === 'object' && session !== null && session.name
                      ? session.name
                      : `Session ${index + 1}`;
                    const sessionId = typeof session === 'object' && session !== null && session.id
                      ? session.id
                      : session;
                      
                    return (
                      <Link href={`/projects/${projectId}/${sessionId}`} key={index}>
                        <div className="p-2 hover:bg-muted rounded-md transition-colors cursor-pointer flex items-center justify-between">
                          <span className="text-sm truncate">{sessionName}</span>
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {typeof session === 'object' && session !== null && session.createdAt
                              ? new Date(session.createdAt).toLocaleDateString()
                              : 'Unknown date'}
                          </Badge>
                        </div>
                      </Link>
                    );
                  })}
                  
                  {sessions.length > 5 && (
                    <div className="pt-2">
                      <Separator />
                      <div className="pt-2 text-center">
                        <Link href={`/projects/${projectId}/sessions`} className="text-xs text-primary hover:underline">
                          View all {sessions.length} sessions
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground italic mb-4">No sessions found.</p>
                  <CreateSessionButton projectId={projectId} className="w-full">
                    <Plus className="mr-2 h-4 w-4" /> Create First Session
                  </CreateSessionButton>
                </>
              )}
               {/* Add Create Session button even if sessions exist */}
               {hasSessions && (
                   <div className="mt-4 pt-4 border-t">
                       <CreateSessionButton projectId={projectId} variant="outline" className="w-full">
                           <Plus className="mr-2 h-4 w-4" /> New Session
                       </CreateSessionButton>
                   </div>
               )}
            </CardContent>
          </Card>

           {/* Removed old Action Buttons card */}
        </div>
      </div>
    </div>
  );
}

