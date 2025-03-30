'use client'

import {
  ChevronDown, Settings, Moon, Sun, Eye,
  SquareMousePointer, Gauge, Bird, MessageCircle, Book,
  TriangleDashed, Sparkle
} from "lucide-react"
import Link from "next/link"

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

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

import { Button } from "@/components/ui/button"

import { useTheme } from "@/components/theme-provider"
import { useServiceStore } from "@/store/service/serviceStore"
import { useEffect, useState } from "react"
import { useProviderStore } from "@/store/provider/providerStore"

const workspaceItems = [
  {
    title: "Chat",
    url: "/chat",
    icon: MessageCircle,
  },
  {
    title: "Automation",
    url: "/automation",
    icon: Bird,
  },
]

// Menu items.
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
  const [isLoading, setIsLoading] = useState(true);

  const loadServiceConfig = useServiceStore(state => state.loadServiceConfig);
  const loadProviderConfig = useProviderStore(state => state.loadProviderConfig);
  const providers = useProviderStore(state => state.providers);
  const selectedLLMModel = useProviderStore(state => state.selectedLLMModel);
  const selectedEmbeddingModel = useProviderStore(state => state.selectedEmbeddingModel);
  const setSelectedProvider = useProviderStore(state => state.setSelectedProvider);
  const setSelectedLLMModel = useProviderStore(state => state.setSelectedLLMModel);
  const setSelectedEmbeddingModel = useProviderStore(state => state.setSelectedEmbeddingModel);

  useEffect(() => {
    const initializeServices = async () => {
      try {
        await Promise.all([
          loadServiceConfig(),
          loadProviderConfig()
        ]);
      } catch (error) {
        console.error('Failed to load services or providers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeServices();
  }, [loadServiceConfig, loadProviderConfig]);

  if (isLoading) {
    return (
      <Sidebar variant="floating">
        <SidebarHeader>
          <div className="flex items-center justify-center h-full">
            <span>Loading services...</span>
          </div>
        </SidebarHeader>
      </Sidebar>
    );
  }

  return (
    <Sidebar variant="floating">

      <SidebarHeader className="pt-4">
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
                  {workspaceItems.map((item) => (
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
