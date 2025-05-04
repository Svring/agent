'use client'

import {
  ChevronDown, Settings, Moon, Sun, MessageCircle,
  Globe, SquareChevronRight, File,
  Terminal, Image, CheckCircle, XCircle,
  User as UserIcon, LogOut, ChevronUp,
  KeyRound,
  DatabaseZap
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

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

// Import generated types and server actions
import { User } from '@/payload-types'
import { getCurrentUser, logoutUser } from '@/db/actions/users-actions'

const workspaceChatItems = [
  {
    title: "Opera",
    url: "/opera",
    icon: MessageCircle,
  },
  {
    title: "Browser",
    url: "trials/browser",
    icon: Globe,
  },
  {
    title: "Explorer",
    url: "trials/explorer",
    icon: File,
  },
  {
    title: "Terminal",
    url: "trials/terminal",
    icon: Terminal,
  },
  {
    title: "Gallery",
    url: "trials/gallery",
    icon: Image,
  },
]

// Define navigation items for settings
const settingsNavItems = [
  {
    title: "SSH Credentials",
    url: "/settings/ssh", // Assuming this is the desired path
    icon: KeyRound,
  },
  {
    title: "Provider",
    url: "/settings/provider", // Assuming this is the desired path
    icon: DatabaseZap,
  },
];

export function AppSidebar() {
  const { theme, setTheme } = useTheme();
  const { state } = useSidebar();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const router = useRouter();
  
  // Use the imported User type for state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(true);

  // Updated useEffect to use server action
  useEffect(() => {
    async function fetchUser() {
      try {
        setUserLoading(true);
        const user = await getCurrentUser();
        setCurrentUser(user);
      } catch (error) {
        console.error('Failed to load user data:', error);
        setCurrentUser(null);
      } finally {
        setUserLoading(false);
      }
    }

    fetchUser();
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
    // Remove firstName/lastName logic as they don't exist on the type
    // (currentUser.firstName || currentUser.lastName) ? 
    //  `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() : 
      currentUser.email.split('@')[0] : 
    '';

  return (
    <Sidebar collapsible="icon" variant="inset" className="ml-1">
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
        {/* User Info Section wrapped in Collapsible */}
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
