'use client'
import { useEffect, useState } from 'react'

export function useAdminToken() {
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('admin_token')
    setToken(stored ?? '')
  }, [])

  return token
}
