'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useStellarWalletStore } from '@/packs/stellar-wallet/store'

export default function WalletGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const isConnected = useStellarWalletStore((s) => s.isConnected)

  useEffect(() => {
    if (!isConnected) {
      router.replace('/')
    }
  }, [isConnected, router])

  if (!isConnected) return null

  return <>{children}</>
}
