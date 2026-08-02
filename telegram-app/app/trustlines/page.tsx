'use client'
import { useRouter } from 'next/navigation'
import { useWalletStore } from '@/hooks/useStore'
import WalletGuard from '@/components/WalletGuard'
import BottomNav from '@/components/BottomNav'
import TrustlineModal from '@/components/TrustlineModal'

export default function TrustlinesPage() {
  const router = useRouter()
  const stellarAddress = useWalletStore(s => s.stellarAddress)
  const telegramUser   = useWalletStore(s => s.telegramUser)

  return (
    <WalletGuard>
      <div className="min-h-screen bg-[#0A0E1A]" />
      <BottomNav />
      {stellarAddress && (
        <TrustlineModal
          open
          onClose={() => router.back()}
          stellarAddress={stellarAddress}
          telegramUsername={telegramUser?.username ?? null}
        />
      )}
    </WalletGuard>
  )
}
