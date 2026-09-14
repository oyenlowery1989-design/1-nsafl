'use client'
import { useEffect, useState, Suspense } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { PRIMARY_CUSTOM_ASSET_CODE } from '@/lib/constants'
import { getAdminNavigationItems, isPackEnabled } from '@/config/app'
import { Icon } from './ui'

const NAV_GROUPS = [
  {
    label: 'Main',
    items: [
      { href: '/admin/overview',   label: 'Overview',      icon: 'dashboard' },
    ],
  },
  {
    label: 'Data',
    items: [
      { href: '/admin/users',      label: 'Users',         icon: 'group' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { href: '/admin/usersearch', label: 'User Search',   icon: 'person_search' },
      { href: '/admin/broadcast',  label: 'Broadcast',     icon: 'campaign' },
      { href: '/admin/settings',   label: 'Settings',      icon: 'settings' },
    ],
  },
  {
    label: 'Activity',
    items: [
      { href: '/admin/access',     label: 'Access',        icon: 'manage_search' },
      { href: '/admin/activity',   label: 'Activity Log',  icon: 'history' },
    ],
  },
  { label: 'Packs', items: getAdminNavigationItems() },
]

function AdminShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [pendingWins, setPendingWins] = useState(0)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Read token from localStorage only
  useEffect(() => {
    const stored = localStorage.getItem('admin_token')
    if (!stored && pathname !== '/admin') {
      router.push('/admin')
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe localStorage read; must run post-mount
    setToken(stored ?? '')
  }, [pathname, router])

  // Poll pending wins badge
  useEffect(() => {
    if (!token || !isPackEnabled('games')) return
    const poll = async () => {
      try {
        const res = await fetch('/api/admin/wins?status=pending&limit=1', { headers: { 'x-admin-token': token } })
        const j = await res.json()
        if (j.success) setPendingWins(j.data.counts?.pending ?? 0)
      } catch { /* ignore */ }
    }
    poll()
    const id = setInterval(poll, 60_000)
    return () => clearInterval(id)
  }, [token])

  // On login page — just render bare children
  if (pathname === '/admin') return <>{children}</>
  // Still loading token
  if (token === null) return (
    <div className="min-h-screen bg-background-dark flex items-center justify-center text-gray-600 text-sm">Loading…</div>
  )

  function logout() {
    localStorage.removeItem('admin_token')
    router.push('/admin')
  }

  return (
    <div className="min-h-screen bg-background-dark text-gray-100">
      {/* Header */}
      <header className="bg-surface border-b border-white/8 px-6 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="md:hidden p-2 rounded-lg text-gray-400 hover:bg-white/10 transition"
            aria-label="Toggle menu"
          >
            <Icon name={sidebarOpen ? 'close' : 'menu'} className="text-xl" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Icon name="sports_football" className="text-sm text-black" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">{PRIMARY_CUSTOM_ASSET_CODE} Admin</h1>
            <p className="text-[11px] text-gray-500 capitalize">{pathname.replace('/admin/', '') || 'Panel'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {confirmLogout ? (
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="text-gray-400">Log out?</span>
              <button onClick={logout} className="px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 font-semibold">Yes</button>
              <button onClick={() => setConfirmLogout(false)} className="px-2 py-1 rounded bg-white/10 text-gray-400 hover:bg-white/20 font-semibold">No</button>
            </span>
          ) : (
            <button onClick={() => setConfirmLogout(true)} className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 rounded-lg px-3 py-1.5 hover:bg-red-500/10 transition">
              Logout
            </button>
          )}
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <aside className="absolute left-0 top-[57px] bottom-0 w-64 bg-surface border-r border-white/8 overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
            <nav className="p-3 space-y-5 pt-4">
              {NAV_GROUPS.map(group => (
                <div key={group.label}>
                  <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-3 mb-1">{group.label}</p>
                  <div className="space-y-0.5">
                    {group.items.map(item => {
                      const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                      const isWins = item.href === '/admin/wins'
                      return (
                        <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${isActive ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
                        >
                          <Icon name={item.icon} className={`text-base ${isActive ? 'text-primary' : ''}`} />
                          <span className="flex-1">{item.label}</span>
                          {isWins && pendingWins > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400">{pendingWins}</span>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-52 shrink-0 bg-surface border-r border-white/8 min-h-screen sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto">
          <nav className="p-3 space-y-5 pt-4">
            {NAV_GROUPS.map(group => (
              <div key={group.label}>
                <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-3 mb-1">{group.label}</p>
                <div className="space-y-0.5">
                  {group.items.map(item => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                    const isWins = item.href === '/admin/wins'
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition relative ${
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                        }`}
                      >
                        <Icon name={item.icon} className={`text-base ${isActive ? 'text-primary' : ''}`} />
                        <span className="flex-1">{item.label}</span>
                        {isWins && pendingWins > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400">
                            {pendingWins}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 px-6 py-6 max-w-[1400px]">
          {children}
        </main>
      </div>
    </div>
  )
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <AdminShellInner>{children}</AdminShellInner>
    </Suspense>
  )
}
