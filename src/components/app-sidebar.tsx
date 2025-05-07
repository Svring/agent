'use client'

import {
  ChevronDown, Settings, Moon, Sun, MessageCircle,
  Globe, SquareChevronRight, File,
  Terminal, Image, CheckCircle, XCircle,
  User as UserIcon, LogOut, ChevronUp,
  KeyRound,
  DatabaseZap,
  FolderGit2,
  Plus,
  ArrowLeft,
  FolderOpen,
  Loader2,
  Database,
  Bug,
  Trash2
} from "lucide-react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
  SidebarProvider
} from "@/components/ui/sidebar"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"
import { useEffect, useState, useRef, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { useDebug } from '@/context/DebugContext'

// Import generated types and server actions
import { User, Project } from '@/payload-types'
import { getCurrentUser, logoutUser } from '@/db/actions/users-actions'
import { findProjects, getProjectById, updateProject } from '@/db/actions/projects-actions'
import { createSessionForProject, updateSession, deleteSession } from '@/db/actions/sessions-actions'
import { toast } from 'sonner'

const workspaceChatItems = [
  {
    title: "Opera",
    url: "/opera",
    icon: MessageCircle,
  },
  {
    title: "Browser",
    url: "/trials/browser",
    icon: Globe,
  },
  {
    title: "Explorer",
    url: "/trials/explorer",
    icon: File,
  },
  {
    title: "Terminal",
    url: "/trials/terminal",
    icon: Terminal,
  },
  {
    title: "Gallery",
    url: "/trials/gallery",
    icon: Image,
  },
  {
    title: "Indexer",
    url: "/trials/indexer",
    icon: Database,
  },
]

// Define navigation items for settings
const settingsNavItems = [
  {
    title: "Provider",
    url: "/settings/provider",
    icon: DatabaseZap,
  },
];

export function AppSidebar() {
  const { theme, setTheme } = useTheme();
  const { state } = useSidebar();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { isDebugMode, setIsDebugMode } = useDebug();
  
  // Use the imported User type for state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [userLoading, setUserLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(false);
  
  // State for the current project detail view
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projectSessions, setProjectSessions] = useState<any[]>([]);
  const [isProjectDetailView, setIsProjectDetailView] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | number | null>(null);
  const [editingSessionName, setEditingSessionName] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Refs for the chevron icon and add button to differentiate clicks
  const projectsChevronRef = useRef<SVGSVGElement>(null);
  const addProjectButtonRef = useRef<HTMLButtonElement>(null);
  const addSessionButtonRef = useRef<HTMLButtonElement>(null);

  // NEW state for project renaming
  const [editingProjectId, setEditingProjectId] = useState<string | number | null>(null);
  const [editingProjectName, setEditingProjectName] = useState<string>("");
  const projectInputRef = useRef<HTMLInputElement>(null); // Ref for project input

  // Added new state for deleting a session
  const [deletingSessionId, setDeletingSessionId] = useState<string | number | null>(null);

  // Check if we're on a project detail page
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/^\/projects\/([^/]+)(?:\/.*)?$/);
      if (match && match[1] !== 'create') {
        setIsProjectDetailView(true);
        setProjectId(match[1]);
        setEditingProjectId(null); 
        setEditingSessionId(null); 
      } else {
        setIsProjectDetailView(false);
        setProjectId(null);
        setCurrentProject(null);
        setEditingProjectId(null); 
        setEditingSessionId(null);
      }
    }
  }, [pathname]);

  // Fetch project details if we're on a project detail page
  useEffect(() => {
    if (isProjectDetailView && projectId) {
      const fetchProjectDetails = async () => {
        try {
          const project = await getProjectById(projectId);
          if (project) {
            setCurrentProject(project);
            
            // Extract sessions
            const sessions = Array.isArray(project.sessions) ? project.sessions : [];
            setProjectSessions(sessions);
          } else {
            // Handle project not found, maybe redirect?
            setCurrentProject(null);
            setProjectSessions([]);
          }
        } catch (error) {
          console.error('Failed to load project details:', error);
          setCurrentProject(null);
          setProjectSessions([]);
        }
      };
      
      fetchProjectDetails();
    }
  }, [isProjectDetailView, projectId]);

  // Updated useEffect to use server action and fetch projects
  useEffect(() => {
    async function fetchUserAndProjects() {
      try {
        setUserLoading(true);
        setProjectsLoading(true);
        const user = await getCurrentUser();
        setCurrentUser(user);

        if (user && user.projects && user.projects.length > 0) {
          const projectIds = user.projects
            .map(proj => (typeof proj === 'string' || typeof proj === 'number' ? proj : proj?.id))
            .filter(id => id !== undefined && id !== null) as (string | number)[];
          
          const firstProject = user.projects[0];
          if (typeof firstProject === 'object' && firstProject?.id) {
             setUserProjects(user.projects.filter((p): p is Project => typeof p === 'object' && p !== null));
          } else if (projectIds.length > 0) {
            const projectsData = await findProjects({ 
              where: { id: { in: projectIds } },
              limit: 100 
            });
            setUserProjects(projectsData?.docs || []);
          } else {
             setUserProjects([]);
          }
        } else {
          setUserProjects([]);
        }
      } catch (error) {
        console.error('Failed to load user or project data:', error);
        setCurrentUser(null);
        setUserProjects([]);
      } finally {
        setUserLoading(false);
        setProjectsLoading(false);
      }
    }

    fetchUserAndProjects();
  }, []);

  // Updated logout handler using server action
  const handleLogout = async () => {
    try {
      setUserLoading(true);
      const result = await logoutUser();
      
      if (result.success) {
        // Force reload to clear client state
        router.push('/login');
        router.refresh();
      } else {
        console.error('Logout failed:', result.error);
      }
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      setUserLoading(false);
    }
  };

  // Get username from user data - use User type
  const username = currentUser ? 
    currentUser.username || 
    currentUser.email.split('@')[0] : 
    '';

  // Updated Click handler for the Projects label trigger
  const handleProjectsLabelClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const target = event.target as Node;
    // Ignore clicks on the chevron wrapper or the add button wrapper
    if (
      (projectsChevronRef.current && projectsChevronRef.current.closest('span')?.contains(target)) ||
      (addProjectButtonRef.current && addProjectButtonRef.current.contains(target))
    ) {
      return; // Let default behavior (toggle or add button click) handle it
    } else {
      // Click was on the text part, prevent toggle and navigate
      event.preventDefault(); 
      event.stopPropagation(); 
      router.push('/projects');
    }
  };

  // Click handler for the add project button
  const handleAddProjectClick = (event: React.MouseEvent<HTMLButtonElement>) => {
     event.stopPropagation(); // Prevent the label click handler
     router.push('/projects/create');
  };

  // Session Creation Handler
  const handleCreateSession = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation(); // Prevent potential parent handlers
    if (!projectId) return;

    setIsCreatingSession(true);
    try {
      const newSession = await createSessionForProject(projectId);
      if (newSession) {
        toast.success('New session created!');
        router.push(`/projects/${projectId}/${newSession.id}`);
        // Manually update state to reflect the new session immediately
        setProjectSessions(prev => [...prev, newSession]); 
      } else {
        toast.error('Failed to create session.');
      }
    } catch (error) {
      console.error("Error creating session:", error);
      toast.error('An error occurred while creating the session.');
    } finally {
      setIsCreatingSession(false);
    }
  };

  // Function to initiate renaming
  const handleSessionClick = (event: React.MouseEvent, session: any) => {
    const sessionId = typeof session === 'object' && session !== null ? session.id : session;
    const sessionName = typeof session === 'object' && session !== null && session.name ? session.name : '';
    const sessionPath = `/projects/${projectId}/${sessionId}`;

    if (pathname === sessionPath) {
      event.preventDefault(); // Prevent navigation
      setEditingProjectId(null); // Ensure project editing is off
      setEditingSessionId(sessionId);
      setEditingSessionName(sessionName || `Session ${projectSessions.findIndex(s => (typeof s === 'object' ? s.id : s) === sessionId) + 1}`);
      // Focus the input field after state updates
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      // Allow navigation if it's not the active session
      router.push(sessionPath);
    }
  };

  // Function to save the renamed session
  const handleRenameSession = async () => {
    if (!editingSessionId || !editingSessionName.trim()) {
      setEditingSessionId(null); // Cancel editing if name is empty
      return;
    }

    try {
      const updatedSession = await updateSession(editingSessionId, { name: editingSessionName.trim() });
      if (updatedSession) {
        toast.success('Session renamed successfully!');
        // Update local state to reflect the change
        setProjectSessions(prevSessions =>
          prevSessions.map(session => {
            const currentId = typeof session === 'object' && session !== null ? session.id : session;
            if (currentId === editingSessionId) {
              // Ensure we return the full object structure if needed, or update name
              if (typeof session === 'object' && session !== null) {
                return { ...session, name: updatedSession.name };
              }
              // This case might need adjustment based on how sessions are stored initially
              return updatedSession; 
            }
            return session;
          })
        );
        // Update current project state if its sessions list might include the renamed one
        if (currentProject && String(currentProject.id) === projectId) {
            // Check if sessions are populated objects in currentProject
            if (Array.isArray(currentProject.sessions)) {
                setCurrentProject(prev => prev ? {
                     ...prev,
                     sessions: prev.sessions?.map(s => {
                         const sId = typeof s === 'object' && s !== null ? s.id : s;
                         return sId === editingSessionId && typeof s === 'object' && s !== null
                             ? { ...s, name: updatedSession.name }
                             : s;
                     })
                } : null);
            }
        }
      } else {
        toast.error('Failed to rename session.');
      }
    } catch (error) {
      console.error("Error renaming session:", error);
      toast.error('An error occurred while renaming the session.');
    } finally {
      setEditingSessionId(null); // Exit editing mode
    }
  };

  // Handle input changes
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEditingSessionName(event.target.value);
  };

  // Handle Enter key press
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleRenameSession();
    } else if (event.key === 'Escape') {
       setEditingSessionId(null); // Cancel editing on Escape
    }
  };

  // --- Project Renaming Handlers ---
  const handleProjectNameClick = (event: React.MouseEvent) => {
     if (currentProject) {
       event.preventDefault(); 
       setEditingSessionId(null); // Ensure session editing is off
       setEditingProjectId(currentProject.id);
       setEditingProjectName(currentProject.name || "");
       setTimeout(() => projectInputRef.current?.focus(), 0);
     }
  };

  const handleRenameProject = async () => {
    if (!editingProjectId || !editingProjectName.trim() || !currentProject) {
      setEditingProjectId(null);
      return;
    }
    if (editingProjectName.trim() === currentProject.name) {
       setEditingProjectId(null);
       return;
    }

    try {
      const updatedProject = await updateProject(editingProjectId, { name: editingProjectName.trim() });
      if (updatedProject) {
        toast.success('Project renamed successfully!');
        setCurrentProject(prev => prev ? { ...prev, name: updatedProject.name } : null);
        setUserProjects(prevProjects => 
            prevProjects.map(p => p.id === editingProjectId ? { ...p, name: updatedProject.name } : p)
        );
      } else {
        toast.error('Failed to rename project.');
      }
    } catch (error) {
      console.error("Error renaming project:", error);
      toast.error('An error occurred while renaming the project.');
    } finally {
      setEditingProjectId(null);
    }
  };

  const handleProjectInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
     setEditingProjectName(event.target.value);
  };

  const handleProjectKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleRenameProject();
    } else if (event.key === 'Escape') {
       setEditingProjectId(null);
    }
  };
  // --- End Project Renaming Handlers ---

  // Handler for deleting a session
  const handleDeleteSession = async (sessionIdToDelete: string | number, sessionName: string) => {
    if (deletingSessionId === sessionIdToDelete) return;

    setDeletingSessionId(sessionIdToDelete);
    try {
      const success = await deleteSession(sessionIdToDelete); // Expects boolean return
      if (success) {
        toast.success(`Session "${sessionName}" deleted successfully!`);
        setProjectSessions(prevSessions => prevSessions.filter(s => (typeof s === 'object' && s !== null ? s.id : s) !== sessionIdToDelete));
        
        if (pathname === `/projects/${projectId}/${sessionIdToDelete}`) {
          router.push(`/projects/${projectId}`);
        }
      } else {
        // If deleteSession returns false, it implies a failure but not an exception.
        toast.error(`Failed to delete session "${sessionName}".`); 
      }
    } catch (error: any) { // Catch block can specify error type
      console.error("Error deleting session:", error);
      // Attempt to get a message from the error object, otherwise generic message
      const errorMessage = error?.message || 'An unknown error occurred while deleting the session.';
      toast.error(errorMessage); 
    } finally {
      setDeletingSessionId(null);
    }
  };

  return (
    <Sidebar collapsible="icon" variant="inset" className="ml-1">
      <SidebarContent>
        {/* Special Back Nav + Project Detail View */}
        {isProjectDetailView && currentProject && (
          <>
            {/* Back to Projects link */}
            <div className="flex items-center py-1.5 px-2 mt-1 mx-2 hover:bg-muted/50 rounded-md transition-colors">
              <Link href="/projects" className="flex items-center text-sm font-medium">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Projects
              </Link>
            </div>
            
            {/* Current Project Section */}
            <SidebarGroup className="mt-2">
              {/* Project Header (Name or Input) */}
              <div className="flex items-center space-x-2 px-2 py-1.5 rounded-md text-sm font-medium hover:bg-muted/50 transition-colors group/projName">
                <FolderGit2 className="h-4 w-4 text-primary flex-shrink-0" />
                {editingProjectId === currentProject.id ? (
                   <Input
                      ref={projectInputRef}
                      type="text"
                      value={editingProjectName}
                      onChange={handleProjectInputChange}
                      onKeyDown={handleProjectKeyDown}
                      onBlur={handleRenameProject}
                      className="h-6 px-1 py-0 text-sm rounded-sm flex-1 bg-background focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-ring"
                   />
                ) : (
                  <div 
                    className="truncate flex-1 cursor-text" 
                    title="Click to rename project" 
                    onClick={handleProjectNameClick}
                  >
                    {currentProject.name}
                  </div>
                )}
              </div>

              {/* Project Menu Items */}
              <SidebarGroupContent className="list-none mt-1">
                <SidebarMenu className="list-none">
                  {/* Project Overview Link */}
                  <SidebarMenuItem className="list-none">
                    <SidebarMenuButton asChild>
                      <Link href={`/projects/${projectId}`} className={`${pathname === `/projects/${projectId}` ? "text-primary font-medium bg-accent" : "hover:bg-muted/50"}`}>
                        <span className="truncate">Overview</span> 
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  
                  {/* Sessions Header with Add Button */}
                  <div className="flex items-center justify-between px-2 group/sessionsHeader">
                    <p className="text-xs font-medium text-muted-foreground">Sessions</p> 
                    <Button 
                      ref={addSessionButtonRef} 
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 p-0 opacity-0 group-hover/sessionsHeader:opacity-100 transition-opacity hover:bg-primary/10"
                      onClick={handleCreateSession}
                      title="Create new session"
                      aria-label="Create new session"
                      disabled={isCreatingSession}
                    >
                      {isCreatingSession ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} 
                    </Button>
                  </div>
                  
                  {/* Sessions List - Corrected Hover Logic Here */}
                  {projectSessions.length > 0 ? (
                    projectSessions.map((session, index) => {
                      const sessionIdVal = typeof session === 'object' && session !== null && session.id ? session.id : session;
                      const sessionNameVal = typeof session === 'object' && session !== null && session.name ? session.name : `Session ${index + 1}`;
                      const sessionPath = `/projects/${projectId}/${sessionIdVal}`;
                      const isActive = pathname === sessionPath;
                      const isEditingSession = editingSessionId === sessionIdVal;
                      const isDeletingThisSession = deletingSessionId === sessionIdVal;

                      return (
                        // Ensure `group` class is on THIS SidebarMenuItem for individual hover
                        <SidebarMenuItem key={sessionIdVal || index} className="list-none group/session relative">
                          {isEditingSession ? (
                             <Input
                                ref={inputRef}
                                type="text"
                                value={editingSessionName}
                                onChange={handleInputChange} 
                                onKeyDown={handleKeyDown}    
                                onBlur={handleRenameSession} 
                                className="h-7 px-2 py-1 text-sm rounded-md bg-background focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-ring"
                              />
                          ) : (
                            <SidebarMenuButton 
                              asChild={!isActive} 
                              onClick={isActive ? (e) => handleSessionClick(e, session) : undefined}
                              // The pr-8 (padding-right) on the button makes space for the delete icon
                              className={`${isActive ? "text-primary font-medium bg-accent" : ""} ${isActive ? "cursor-text hover:bg-accent" : "hover:bg-muted/50"} w-full justify-start pr-8`}
                              title={isActive ? "Click to rename" : sessionNameVal}
                            >
                              {isActive ? (
                                <div className="flex items-center w-full">
                                  <FolderOpen className="h-4 w-4 mr-2 opacity-70 flex-shrink-0" />
                                  <span className="truncate" title={sessionNameVal}>{sessionNameVal}</span>
                                </div>
                              ) : (
                                <Link href={sessionPath} className="flex items-center w-full">
                                  <FolderOpen className="h-4 w-4 mr-2 opacity-70 flex-shrink-0" />
                                  <span className="truncate" title={sessionNameVal}>{sessionNameVal}</span>
                                </Link>
                              )}
                            </SidebarMenuButton>
                          )}
                          {/* Delete Button - appears on hover of its parent SidebarMenuItem */}
                          {!isEditingSession && (
                            <Button
                              variant="ghost"
                              size="icon"
                              // Positioned absolutely within the relative parent (SidebarMenuItem)
                              // Translates to center itself vertically, and sits on the right
                              // opacity-0 by default, group-hover:opacity-100 makes it appear on parent hover
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 opacity-0 group-hover/session:opacity-100 focus-visible:opacity-100 hover:bg-destructive/10 text-destructive/70 hover:text-destructive transition-opacity"
                              onClick={() => handleDeleteSession(sessionIdVal, sessionNameVal)}
                              disabled={isDeletingThisSession}
                              title={`Delete session "${sessionNameVal}"`}
                            >
                              {isDeletingThisSession ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                            </Button>
                          )}
                        </SidebarMenuItem>
                      );
                    })
                  ) : (
                    <SidebarMenuItem className="list-none pl-6"> 
                      <SidebarMenuButton onClick={handleCreateSession} disabled={isCreatingSession} className="w-full justify-start">
                        {isCreatingSession ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />} 
                        <span>{isCreatingSession ? 'Creating...' : 'Create Session'}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
        
        {/* Standard Navigation - only show when not in project detail view */}
        {!isProjectDetailView && (
          <>
            {/* Projects Collapsible Section */}
            {!userLoading && currentUser && (
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarGroup>
                  <SidebarGroupLabel asChild>
                    <CollapsibleTrigger 
                      onClick={handleProjectsLabelClick} 
                      className="flex items-center justify-between w-full px-2 py-1.5 rounded-md text-sm font-medium hover:bg-muted/50 transition-colors cursor-pointer group/trigger"
                    >
                      <span className="mr-auto">Projects</span>
                      <div className="flex items-center ml-1 shrink-0">
                        <Button 
                          ref={addProjectButtonRef}
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 p-0 opacity-0 group-hover/trigger:opacity-100 transition-opacity hover:bg-primary/10 mr-1"
                          onClick={handleAddProjectClick}
                          title="Create new project"
                          aria-label="Create new project"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <span className="p-1 -mr-1 rounded hover:ring-1 hover:ring-primary/10 cursor-pointer"> 
                          <ChevronDown 
                            ref={projectsChevronRef}
                            className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180 cursor-default" 
                          />
                        </span>
                      </div>
                    </CollapsibleTrigger>
                  </SidebarGroupLabel>
                  <CollapsibleContent>
                    <SidebarGroupContent className="list-none">
                      {projectsLoading ? (
                        <SidebarMenuItem className="list-none">
                          <SidebarMenuButton disabled className="opacity-50 cursor-default">
                            <span className="text-xs text-muted-foreground">Loading projects...</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ) : userProjects.length > 0 ? (
                        <SidebarMenu className="list-none">
                          {userProjects.map((project) => (
                            <SidebarMenuItem key={project.id} className="list-none">
                              <SidebarMenuButton asChild>
                                <Link href={`/projects/${project.id}`}>
                                  <FolderGit2 className="h-4 w-4" />
                                  <span className="truncate" title={project.name}>{project.name || 'Untitled Project'}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </SidebarMenu>
                      ) : (
                        <SidebarMenuItem className="list-none">
                          <SidebarMenuButton disabled className="opacity-50 cursor-default">
                            <span className="text-xs text-muted-foreground">No projects found.</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )}
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            )}

            {/* Workspace Collapsible Section */}
            <Collapsible defaultOpen className="group/collapsible">
              <SidebarGroup>
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger>
                    Workspace
                    <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent className="list-none">
                    <SidebarMenu className="list-none">
                      {workspaceChatItems.map((item) => (
                        <SidebarMenuItem key={item.title} className="list-none">
                          <SidebarMenuButton asChild>
                            <Link href={item.url}>
                              <item.icon />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          </>
        )}
      </SidebarContent>

      <SidebarFooter>
        {/* User Info Section wrapped in Collapsible - always show this */}
        {!userLoading && currentUser && (
          <Collapsible 
            open={isUserMenuOpen} 
            onOpenChange={setIsUserMenuOpen} 
            className="w-full group/usercollapsible"
          >
            {/* Collapsible Content: Settings Links, Theme, Logout */}
            <CollapsibleContent className="border-b w-full">
              <div className="flex flex-col w-full p-1">
                
                {/* Settings Navigation Links */}
                {settingsNavItems.map((item) => (
                  <SidebarMenuItem key={item.title} className="p-0 list-none">
                    <SidebarMenuButton asChild className="w-full justify-start px-2 py-1.5 text-sm">
                      <Link href={item.url} title={item.title}>
                        <item.icon className="mr-2 h-4 w-4"/>
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                
                {/* Theme Toggle Button */}
                <Button
                  variant="ghost"
                  className="w-full justify-start px-2 py-1.5 text-sm"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  aria-label="Toggle theme"
                  title="Toggle theme"
                >
                  {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                  <span>Theme ({theme === 'dark' ? 'Dark' : 'Light'})</span>
                </Button>

                {/* Debug Mode Toggle */}
                <div className="flex items-center justify-between px-2 py-1.5 text-sm hover:bg-muted/50 rounded-md transition-colors cursor-pointer">
                  <Label htmlFor="debug-mode-toggle" className="flex items-center gap-2 cursor-pointer">
                    <Bug size={16} /> 
                    <span>Debug Mode</span>
                  </Label>
                  <Switch
                    id="debug-mode-toggle"
                    checked={isDebugMode}
                    onCheckedChange={setIsDebugMode}
                    className="scale-75"
                  />
                </div>

                {/* Logout Button */}
                <Button
                    variant="ghost"
                    className="w-full justify-start px-2 py-1.5 text-sm text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    onClick={handleLogout}
                    title="Logout"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                </Button>
              </div>
            </CollapsibleContent>
            
            {/* Trigger - User Info Button */}
            <SidebarMenu className="mt-0">
              <SidebarMenuItem className="p-0">
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton 
                    className="opacity-100 cursor-pointer flex items-center justify-between w-full h-auto py-1.5 px-2 data-[state=open]:bg-muted/50" 
                  >
                    <div className="flex items-center flex-1 min-w-0">
                      <Avatar className="h-6 w-6 mr-2 shrink-0">
                        {(typeof currentUser.avatar === 'object' && currentUser.avatar?.url) ? (
                          <AvatarImage src={currentUser.avatar.url} alt={currentUser.avatar.alt || username} />
                        ) : (
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {currentUser.email?.[0]?.toUpperCase() || <UserIcon size={12} />}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      {state !== 'collapsed' && (
                        <div className="flex flex-col items-start min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium truncate" title={username}>
                              {username}
                            </span>
                            {currentUser.role && (
                              <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-medium text-primary shrink-0">
                                {currentUser.role}
                              </span>
                            )}
                          </div>
                          <span className="mt-0.5 text-[10px] text-muted-foreground truncate" title={currentUser.email}>
                            {currentUser.email}
                          </span>
                        </div>
                      )}
                    </div>
                    {state !== 'collapsed' && (
                       <ChevronUp className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=closed]/usercollapsible:rotate-180 shrink-0 ml-1" />
                    )}
                  </SidebarMenuButton>
                </CollapsibleTrigger>
              </SidebarMenuItem>
            </SidebarMenu>
            
          </Collapsible>
        )}
        {/* End User Info Section */}
      </SidebarFooter>
    </Sidebar>
  )
}
