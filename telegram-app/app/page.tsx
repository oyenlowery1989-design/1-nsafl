import { getHomeContribution } from '@/config/app'
import { BRANDING } from '@/config/branding'

function NeutralHome() {
  return (
    <main className="min-h-screen px-6 py-12 flex items-center justify-center">
      <section className="glass-card rounded-2xl p-8 max-w-sm text-center space-y-3">
        <span className="material-symbols-outlined text-4xl text-primary">apps</span>
        <h1 className="text-3xl text-white">{BRANDING.appName}</h1>
        <p className="text-sm text-gray-400">Choose domain packs in config/app.ts to build this app.</p>
      </section>
    </main>
  )
}

const HomeContribution = getHomeContribution()

export default function HomePage() {
  return HomeContribution ? <HomeContribution /> : <NeutralHome />
}
