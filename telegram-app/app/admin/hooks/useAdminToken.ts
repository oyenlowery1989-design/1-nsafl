'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export function useAdminToken() {
  const params = useSearchParams()
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const urlToken = params.get('token')
    if (urlToken) {
      localStorage.setItem('admin_token', urlToken)
      setToken(urlToken)
      return
    }
    const stored = localStorage.getItem('admin_token')
    setToken(stored ?? '')
  }, [params])

  return token
}
