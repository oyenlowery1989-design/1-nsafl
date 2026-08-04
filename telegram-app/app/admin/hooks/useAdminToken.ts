'use client'
import { useEffect, useState } from 'react'

export function useAdminToken() {
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('admin_token')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe localStorage read; must run post-mount
    setToken(stored ?? '')
  }, [])

  return token
}
