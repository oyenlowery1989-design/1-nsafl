"use client"

import BottomNav from '@/components/BottomNav'
import * as AppConfig from '@/config/app'

function NeutralProfile() {
  return (
    <main aria-label="Profile" className="min-h-screen bg-background-dark px-4 py-8">
      <section className="bg-white/[0.03] backdrop-blur-[12px] border border-white/10 rounded-2xl p-5 text-center">
        <span className="material-symbols-outlined text-primary text-3xl">person</span>
        <h1 className="mt-3 font-serif text-xl font-bold text-white">Profile</h1>
        <p className="mt-2 text-sm text-gray-400">Profile features are unavailable in this app configuration.</p>
      </section>
      <BottomNav />
    </main>
  )
}

export default function ProfilePage() {
  const Contribution = AppConfig.getProfileContribution?.()
  return Contribution ? <Contribution /> : NeutralProfile()
}
