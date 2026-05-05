'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// /dashboard → /cafe (canonical app dashboard location)
export default function DashboardRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/cafe') }, [router])
  return null
}
