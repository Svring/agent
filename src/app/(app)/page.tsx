import { headers as getHeaders } from 'next/headers.js'
import Image from 'next/image'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'

export default async function Home() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  return (
    <div>
      <h1>Hello World</h1>
    </div>
  )
}
