import { headers as getHeaders } from 'next/headers.js'
import Image from 'next/image'
import { getPayload } from 'payload'
import React from 'react'
import { Hero } from "@/components/blocks/hero"

import config from '@/payload.config'
import { redirect } from 'next/navigation'

export default async function Home() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  return (
    <Hero
      title="Counterfeit"
      subtitle="Hooray!"
      actions={[
        {
          label: "View Projects",
          href: "/projects",
          variant: "default"
        },
        {
          label: "Create New Project",
          href: "/projects/create",
          variant: "outline"
        }
      ]}
      titleClassName="text-5xl md:text-6xl font-extrabold"
      subtitleClassName="text-lg md:text-xl max-w-[600px]"
      actionsClassName="mt-8"
    />
  )
}
