'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWalletStore } from '@/hooks/useStore'

export default function WalletGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const isConnected = useWalletStore((s) => s.isConnected)

  useEffect(() => {
    if (!isConnected) {
      router.replace('/')
    }
  }, [isConnected, router])

  if (!isConnected) return null

  return <>{children}</>
}
