'use client'

import { Button } from "@/components/ui/button"

export function SettingSidebar({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: string) => void }) {
  const settingsItems = [
    {
      title: "SSH Credentials",
      id: "ssh-credentials",
    },
    {
      title: "Model Credentials",
      id: "model-credentials",
    },
  ]

  return (
    <div className="w-60 border-r p-4 h-full flex flex-col space-y-2">
      {settingsItems.map((item) => (
        <Button
          key={item.id}
          variant={activeTab === item.id ? "secondary" : "ghost"}
          onClick={() => setActiveTab(item.id)}
          className="w-full justify-start"
        >
          {item.title}
        </Button>
      ))}
    </div>
  )
}
