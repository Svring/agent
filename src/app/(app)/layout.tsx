import type { Metadata } from "next";
import "./globals.css";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
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
          <SidebarProvider>
            <AppSidebar />
            <main className="py-1.5 flex flex-1 flex-col w-full h-screen rounded-lg">
              <div className="flex flex-row px-1 items-center w-full rounded-lg">
                <SidebarTrigger />
              </div>
              <div className="flex-1 w-full rounded-lg overflow-auto">
                {children}
              </div>
            </main>
            <Toaster />
          </SidebarProvider>
        </body>
      </html>
    </ThemeProvider>
  );
}
