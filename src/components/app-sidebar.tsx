'use client'

import { ChevronDown, Settings, Moon, Sun, Eye, SquareMousePointer, Gauge, Bird, MessageCircle, Book } from "lucide-react"
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
const toolsItems = [
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
  const services = useServiceStore(state => state.services);

  useEffect(() => {
    const initializeServices = async () => {
      try {
        await loadServiceConfig();
      } catch (error) {
        console.error('Failed to load services:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeServices();
  }, [loadServiceConfig]);

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

      <SidebarHeader>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton>
              Select LLM
              <ChevronDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-fit">
            <DropdownMenuItem>
              <span>Claude-3-7</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <span>GPT-4o</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
                Tools
                <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {toolsItems.map((item) => (
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
