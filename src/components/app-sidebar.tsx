'use client'

import {
  ChevronDown, Settings, Moon, Sun, MessageCircle,
  Globe, SquareChevronRight
} from "lucide-react"
import Link from "next/link"

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
} from "@/components/ui/sidebar"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"


import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"

const workspaceChatItems = [
  {
    title: "Opera",
    url: "/opera",
    icon: MessageCircle,
  },
  {
    title: "Playwright",
    url: "/playwright",
    icon: Globe,
  },
  {
    title: "Props",
    url: "/props",
    icon: SquareChevronRight,
  }
]

export function AppSidebar() {
  const { theme, setTheme } = useTheme();

  return (
    <Sidebar collapsible="icon" variant="inset">
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
