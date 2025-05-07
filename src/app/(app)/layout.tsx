import type { Metadata } from "next";
import "./globals.css";
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'
import { redirect } from 'next/navigation'

import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner"
import { DebugProvider } from '@/context/DebugContext';

import config from '@/payload.config'

export const metadata: Metadata = {
  title: "Agent",
  description: "",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  // --- Authentication Check Start ---
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const { user } = await payload.auth({ headers })

  if (!user) {
    // Get the original requested path to redirect back after login
    // Using 'x-pathname' header which is usually set by Next.js middleware or Vercel
    // Fallback to '/' if header is not present
    const currentPath = headers.get('x-pathname') || '/'
    
    // Check if we're already on the login page to prevent redirect loops
    if (!currentPath.includes('/login')) {
      redirect(
        `/login?error=${encodeURIComponent('You must be logged in.')}&redirect=${encodeURIComponent(currentPath)}`,
      )
    }
  }
  // --- Authentication Check End ---

  return (
    <ThemeProvider>
      <html lang="en">
        <body
          className={`antialiased h-screen w-screen`}
        >
          <DebugProvider>
            <SidebarProvider defaultOpen={true} className="border-4 border-muted rounded-lg w-full h-full">
              <AppSidebar />
              <SidebarInset className="border border-muted rounded-lg">
                <main className="py-1.5 flex flex-1 flex-col w-full h-full rounded-lg">
                  {children}
                </main>
              </SidebarInset>
              <Toaster />
            </SidebarProvider>
          </DebugProvider>
        </body>
      </html>
    </ThemeProvider>
  );
}
