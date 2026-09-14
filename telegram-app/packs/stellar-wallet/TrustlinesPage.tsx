'use client'
import { useRouter } from 'next/navigation'
import { useIdentityStore } from '@/hooks/useStore'
import { useStellarWalletStore } from './store'
import WalletGuard from '@/components/WalletGuard'
import BottomNav from '@/components/BottomNav'
import TrustlineModal from '@/components/TrustlineModal'
import FeatureRedirect from '@/components/FeatureRedirect'

function TrustlinesPage() {
  const router = useRouter()
  const stellarAddress = useStellarWalletStore(s => s.stellarAddress)
  const telegramUser = useIdentityStore(s => s.telegramUser)

  return (
    <WalletGuard>
      <div className="min-h-screen bg-background-dark" />
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

export default function TrustlinesPageRoute() {
  return <FeatureRedirect feature="stellar-wallet"><TrustlinesPage /></FeatureRedirect>
}
