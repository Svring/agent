import { headers as getHeaders } from 'next/headers.js'
import Image from 'next/image'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { redirect } from 'next/navigation'

export default async function Home() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const { permissions, user } = await payload.auth({ headers })

  // if (!user) {
  //   redirect(
  //     `/login?error=${encodeURIComponent('You must be logged in to access your account.')}&redirect=/account`,
  //   )
  // }

  return (
    <div>
      <h1>Hello World</h1>
    </div>
  )
}
