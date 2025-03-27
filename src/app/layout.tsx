import type { Metadata } from "next";
import "./globals.css";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { ThemeProvider } from "@/components/theme-provider";

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
            <main className="flex flex-col w-full h-full rounded-lg">
              <div className="flex flex-row px-1 items-center w-fullrounded-lg">
                <SidebarTrigger />
              </div>
              <div className="flex flex-1 w-full rounded-lg">
                {children}
              </div>
            </main>
          </SidebarProvider>
        </body>
      </html>
    </ThemeProvider>
  );
}
