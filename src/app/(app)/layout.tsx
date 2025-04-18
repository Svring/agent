import type { Metadata } from "next";
import "./globals.css";

import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner"

export const metadata: Metadata = {
  title: "Agent",
  description: "",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ThemeProvider>
      <html lang="en">
        <body
          className={`antialiased`}
        >
          <SidebarProvider className="border-4 border-muted rounded-lg">
            <AppSidebar />
            <SidebarInset className="border border-muted rounded-lg p-2 bg-card">
              <main className="py-1.5 flex flex-1 flex-col w-full h-screen rounded-lg">
                {children}
              </main>
            </SidebarInset>
            <Toaster />
          </SidebarProvider>
        </body>
      </html>
    </ThemeProvider>
  );
}
