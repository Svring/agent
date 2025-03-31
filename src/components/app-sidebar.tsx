'use client'

import {
  ChevronDown, Settings, Moon, Sun, Eye,
  SquareMousePointer, Gauge, Bird, MessageCircle, Book,
  TriangleDashed, Sparkle, Plus, Loader2
} from "lucide-react"
import Link from "next/link"
// import { useRouter } from 'next/navigation'; // Not needed for now

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

// Re-add necessary Dropdown imports for other parts of the sidebar
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  // DropdownMenuSeparator, // Separator only used in the removed automation dropdown
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"


import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import { useTheme } from "@/components/theme-provider"
import { useServiceStore } from "@/store/service/serviceStore"
import { useEffect, useState } from "react"
import { useProviderStore } from "@/store/provider/providerStore"
import type { Application } from '@/payload-types'

const workspaceChatItems = [
  {
    title: "Chat",
    url: "/chat",
    icon: MessageCircle,
  },
]

const servicesItems = [
  {
    title: "Dock",
    url: "/dock",
    icon: Gauge,
  },
  {
    title: "Omniparser",
    url: "/omniparser",
    icon: Eye,
  },
  {
    title: "Operator",
    url: "/operator",
    icon: SquareMousePointer,
  },
]

const knowledgeBaseItems = [
  {
    title: "Embeddings",
    url: "/embeddings",
    icon: Book,
  },
]

export function AppSidebar() {
  const { theme, setTheme } = useTheme();
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoadingApps, setIsLoadingApps] = useState(true);
  const [isAppsCollapsibleOpen, setIsAppsCollapsibleOpen] = useState(true);
  
  // New state variables for application creation
  const [addAppOpen, setAddAppOpen] = useState(false);
  const [newAppName, setNewAppName] = useState('');
  const [newAppDescription, setNewAppDescription] = useState('');
  const [newAppVersion, setNewAppVersion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadServiceConfig = useServiceStore(state => state.loadServiceConfig);
  const loadProviderConfig = useProviderStore(state => state.loadProviderConfig);
  const providers = useProviderStore(state => state.providers);
  const selectedLLMModel = useProviderStore(state => state.selectedLLMModel);
  const selectedEmbeddingModel = useProviderStore(state => state.selectedEmbeddingModel);
  const setSelectedProvider = useProviderStore(state => state.setSelectedProvider);
  const setSelectedLLMModel = useProviderStore(state => state.setSelectedLLMModel);
  const setSelectedEmbeddingModel = useProviderStore(state => state.setSelectedEmbeddingModel);

  // Refactored application fetching into separate function for reuse
  const fetchApplications = async () => {
    setIsLoadingApps(true);
    try {
      const response = await fetch('/api/applications');
      if (!response.ok) {
        throw new Error(`Failed to fetch applications: ${response.statusText}`);
      }
      const data: Application[] = await response.json();
      setApplications(data);
    } catch (error) {
      console.error('Failed to fetch applications:', error);
      setApplications([]);
    } finally {
      setIsLoadingApps(false);
    }
  };

  useEffect(() => {
    const initializeServices = async () => {
      setIsLoadingServices(true);
      try {
        await Promise.all([
          loadServiceConfig(),
          loadProviderConfig()
        ]);
      } catch (error) {
        console.error('Failed to load services or providers:', error);
      } finally {
        setIsLoadingServices(false);
      }
    };

    initializeServices();
    fetchApplications();
  }, [loadServiceConfig, loadProviderConfig]);

  const isLoading = isLoadingServices || isLoadingApps;

  // New function to handle application creation
  const handleCreateApplication = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!newAppName || !newAppDescription) {
      return; // Don't submit if required fields are empty
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newAppName,
          description: newAppDescription,
          version: newAppVersion || undefined, // Only include if not empty
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create application');
      }
      
      // Clear form and close popover on success
      setNewAppName('');
      setNewAppDescription('');
      setNewAppVersion('');
      setAddAppOpen(false);
      
      // Refresh the application list
      await fetchApplications();
      
    } catch (error) {
      console.error('Error creating application:', error);
      alert(error instanceof Error ? error.message : 'Failed to create application');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewApplication = (event: React.MouseEvent) => {
    event.stopPropagation();
    // No longer need this function to do anything as popover handles the state
  };

  if (isLoading) {
    return (
      <Sidebar variant="floating">
        <SidebarHeader>
          <div className="flex items-center justify-center h-full">
            <span>Loading config & apps...</span>
          </div>
        </SidebarHeader>
      </Sidebar>
    );
  }

  return (
    <Sidebar variant="floating">

      <SidebarHeader className="pt-4 select-none">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 ml-1 flex items-center gap-1">
              <Sparkle className="h-3.5 w-3.5" />
              LLM Model
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="w-full justify-between text-sm cursor-pointer">
                  <span className="truncate">{selectedLLMModel || "Select Model"}</span>
                  <ChevronDown className="h-4 w-4 opacity-70" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[220px] max-h-[300px] overflow-y-auto">
                {Object.values(providers)
                  .filter(provider => provider.models.some(model => model.category === 'llm'))
                  .map(provider => (
                    <div key={provider.providerName}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {provider.providerName.toUpperCase()}
                      </div>
                      {provider.models
                        .filter(model => model.category === 'llm')
                        .map(model => (
                          <DropdownMenuItem
                            key={`${provider.providerName}-${model.name}`}
                            onClick={() => {
                              setSelectedProvider(provider.providerName);
                              setSelectedLLMModel(model.name);
                            }}
                            className="text-sm"
                          >
                            <span className="truncate">{model.name}</span>
                          </DropdownMenuItem>
                        ))
                      }
                    </div>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 ml-1 flex items-center gap-1">
              <TriangleDashed className="h-3.5 w-3.5" />
              Embedding Model
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="w-full justify-between text-sm cursor-pointer">
                  <span className="truncate">{selectedEmbeddingModel || "Select Model"}</span>
                  <ChevronDown className="h-4 w-4 opacity-70" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[220px] max-h-[300px] overflow-y-auto">
                {Object.values(providers)
                  .filter(provider => provider.models.some(model => model.category === 'embedding'))
                  .map(provider => (
                    <div key={provider.providerName}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {provider.providerName.toUpperCase()}
                      </div>
                      {provider.models
                        .filter(model => model.category === 'embedding')
                        .map(model => (
                          <DropdownMenuItem
                            key={`${provider.providerName}-${model.name}`}
                            onClick={() => {
                              setSelectedProvider(provider.providerName);
                              setSelectedEmbeddingModel(model.name);
                            }}
                            className="text-sm"
                          >
                            <span className="truncate">{model.name}</span>
                          </DropdownMenuItem>
                        ))
                      }
                    </div>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                Workspace
                <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {workspaceChatItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <Link href={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}

                  <SidebarMenuItem className="p-0">
                    <Collapsible
                      open={isAppsCollapsibleOpen}
                      onOpenChange={setIsAppsCollapsibleOpen}
                      className="w-full ring-1 ring-muted rounded-md"
                    >
                      <CollapsibleTrigger className="w-full rounded-md" asChild>
                        <div className="flex items-center justify-between cursor-pointer  rounded-md px-1 py-1 transition-colors">
                          <div className="flex items-center gap-2">
                            <Bird className="h-5 w-5" />
                            <span className="text-sm font-medium select-none">Automation</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Popover open={addAppOpen} onOpenChange={setAddAppOpen}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 rounded-full hover:bg-muted hover:ring-1 hover:ring-muted cursor-pointer"
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label="New Application"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-72" onClick={(e) => e.stopPropagation()}>
                                <form onSubmit={handleCreateApplication}>
                                  <div className="space-y-4">
                                    <h3 className="font-semibold">Create New Application</h3>
                                    
                                    <div className="space-y-2">
                                      <Label htmlFor="app-name">Name *</Label>
                                      <Input 
                                        id="app-name"
                                        value={newAppName}
                                        onChange={(e) => setNewAppName(e.target.value)}
                                        placeholder="Application name"
                                        required
                                      />
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <Label htmlFor="app-description">Description *</Label>
                                      <Textarea 
                                        id="app-description"
                                        value={newAppDescription}
                                        onChange={(e) => setNewAppDescription(e.target.value)}
                                        placeholder="Describe the purpose of this application"
                                        required
                                        rows={3}
                                      />
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <Label htmlFor="app-version">Version</Label>
                                      <Input 
                                        id="app-version"
                                        value={newAppVersion}
                                        onChange={(e) => setNewAppVersion(e.target.value)}
                                        placeholder="e.g. 1.0.0 (optional)"
                                      />
                                    </div>
                                    
                                    <div className="flex justify-end">
                                      <Button 
                                        type="submit"
                                        disabled={!newAppName || !newAppDescription || isSubmitting}
                                        className="w-full"
                                      >
                                        {isSubmitting ? (
                                          <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Creating...
                                          </>
                                        ) : (
                                          'Create Application'
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                </form>
                              </PopoverContent>
                            </Popover>
                            <ChevronDown className="h-4 w-4 mr-1 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="pl-6 pr-2 pt-1 pb-1">
                          <SidebarMenu className="flex flex-col gap-0.5">
                            {isLoadingApps ? (
                              <SidebarMenuItem>
                                <SidebarMenuButton disabled className="text-sm text-muted-foreground justify-start w-full h-auto py-1 px-1 rounded-md font-normal">
                                  Loading...
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            ) : applications.length > 0 ? (
                              applications.map((app) => {
                                const appUrlName = app.name.toLowerCase().replace(/\s+/g, '-');
                                return (
                                  <SidebarMenuItem key={app.id} className="p-0">
                                    <SidebarMenuButton asChild className="text-sm justify-start w-full h-auto py-1 px-1 font-normal rounded-md">
                                      <Link href={`/automation/${appUrlName}`}>
                                        <span className="truncate">{app.name}</span>
                                      </Link>
                                    </SidebarMenuButton>
                                  </SidebarMenuItem>
                                );
                              })
                            ) : (
                              <SidebarMenuItem className="p-0">
                                <SidebarMenuButton disabled className="text-sm text-muted-foreground justify-start w-full h-auto py-1 px-1 rounded-md font-normal">
                                  No applications found
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            )}
                          </SidebarMenu>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                Services
                <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {servicesItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
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

        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                Knowledge Base
                <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {knowledgeBaseItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
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
      </SidebarContent>

      <SidebarFooter>
        <div className="flex flex-row justify-between w-full">
          <Button variant="ghost" size="icon" className="rounded-full">
            <Settings />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-[1.2rem] w-[1.2rem]" /> : <Moon className="h-[1.2rem] w-[1.2rem]" />}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
