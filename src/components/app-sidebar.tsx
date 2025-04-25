'use client'

import {
  ChevronDown, Settings, Moon, Sun, MessageCircle,
  Globe, SquareChevronRight, File,
  Terminal
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
import { useEffect, useState, useRef } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SettingSidebar } from "@/components/setting-sidebar"

const workspaceChatItems = [
  {
    title: "Opera",
    url: "/opera",
    icon: MessageCircle,
  },
  {
    title: "Browser",
    url: "/browser",
    icon: Globe,
  },
  {
    title: "Explorer",
    url: "/explorer",
    icon: File,
  },
  {
    title: "Terminal",
    url: "/terminal",
    icon: Terminal,
  }
]

export function AppSidebar() {
  const { theme, setTheme } = useTheme();
  const { state } = useSidebar();
  const [sshHost, setSshHost] = useState('');
  const [sshUsername, setSshUsername] = useState('');
  const [sshPort, setSshPort] = useState('');
  const [sshPrivateKeyPath, setSshPrivateKeyPath] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState('ssh-credentials');

  useEffect(() => {
    // Load initial credentials from API
    fetch('/api/props')
      .then(response => response.json())
      .then(data => {
        if (data.credentials) {
          setSshHost(data.credentials.host);
          setSshUsername(data.credentials.username);
          setSshPort(data.credentials.port.toString());
          setSshPrivateKeyPath(data.credentials.privateKeyPath);
        }
      })
      .catch(error => console.error('Failed to load SSH credentials:', error));
  }, []);

  const handleSaveCredentials = async () => {
    setIsLoading(true);
    try {
      const credentials = {
        host: sshHost,
        username: sshUsername,
        port: parseInt(sshPort, 10),
        privateKeyPath: sshPrivateKeyPath
      };
      const response = await fetch('/api/props', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'updateCredentials',
          credentials: credentials
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        console.error('Failed to save SSH credentials:', result.message);
      }
    } catch (error) {
      console.error('Error saving SSH credentials:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Upload the file to the backend
      const formData = new FormData();
      formData.append('file', file);
      try {
        const response = await fetch('/api/props/upload-key', {
          method: 'POST',
          body: formData,
        });
        const result = await response.json();
        if (response.ok && result.path) {
          setSshPrivateKeyPath(result.path);
        } else {
          console.error('Failed to upload private key:', result.message);
        }
      } catch (error) {
        console.error('Error uploading private key:', error);
      }
    }
  };

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
        <div className={`flex ${state === 'collapsed' ? 'flex-col' : 'flex-row justify-between'} w-full`}>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Settings />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="p-2 h-full w-full border rounded-md">
              <SheetHeader>
                <SheetTitle>Settings</SheetTitle>
              </SheetHeader>
              <div className="flex h-full">
                <SettingSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
                <main className="flex-1 overflow-auto p-4">
                  {activeTab === 'ssh-credentials' && (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="sshHost">Host</Label>
                        <Input id="sshHost" value={sshHost} onChange={(e) => setSshHost(e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="sshUsername">Username</Label>
                        <Input id="sshUsername" value={sshUsername} onChange={(e) => setSshUsername(e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="sshPort">Port</Label>
                        <Input id="sshPort" value={sshPort} onChange={(e) => setSshPort(e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="sshPrivateKeyPath">Private Key Path</Label>
                        <Button variant="outline" size="sm" onClick={handleFileSelect}>
                          Browse
                        </Button>
                        <input
                          type="file"
                          ref={fileInputRef}
                          style={{ display: 'none' }}
                          onChange={handleFileChange}
                        // accept any file type
                        />
                      </div>
                      <Button onClick={handleSaveCredentials} disabled={isLoading}>
                        {isLoading ? 'Saving...' : 'Save Credentials'}
                      </Button>
                    </div>
                  )}
                  {activeTab === 'model-credentials' && (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="modelApiKey">API Key</Label>
                        <Input id="modelApiKey" placeholder="Enter your API key" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="modelEndpoint">Endpoint</Label>
                        <Input id="modelEndpoint" placeholder="Enter model endpoint" />
                      </div>
                      <Button>Save Model Credentials</Button>
                    </div>
                  )}
                </main>
              </div>
            </SheetContent>
          </Sheet>
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
