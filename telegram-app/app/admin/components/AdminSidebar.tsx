'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Icon } from './ui'
import type { Tab } from '../types'

interface NavItem {
  key: Tab
  label: string
  icon: string
  badge?: number
  alert?: boolean
}

interface LinkItem {
  href: string
  label: string
  icon: string
  badge?: number
  external?: boolean
}

interface NavGroup {
  label: string
  items: NavItem[]
  links?: LinkItem[]
}

interface Props {
  tab: Tab
  onTabChange: (t: Tab) => void
  totalUsers: number
  totalDonations: number
  totalPurchases: number
  totalGameSessions: number
  suspiciousCount: number
  referralCount: number
  pendingWins: number
  newSuspiciousCount: number
}

export function AdminSidebar({
  tab, onTabChange,
  totalUsers, totalDonations, totalPurchases, totalGameSessions,
  suspiciousCount, referralCount, pendingWins, newSuspiciousCount,
}: Props) {
  const params = useSearchParams()
  const token = params.get('token') ?? ''

  const groups: NavGroup[] = [
    {
      label: 'Main',
      items: [
        { key: 'overview', label: 'Overview', icon: 'dashboard' },
      ],
    },
    {
      label: 'Data',
      items: [
        { key: 'users',     label: 'Users',     icon: 'group',              badge: totalUsers },
        { key: 'donations', label: 'Donations', icon: 'volunteer_activism', badge: totalDonations },
        { key: 'purchases', label: 'Purchases', icon: 'shopping_cart',      badge: totalPurchases },
      ],
    },
    {
      label: 'Tools',
      items: [
        { key: 'usersearch', label: 'User Search',  icon: 'person_search' },
        { key: 'broadcast',  label: 'Broadcast',    icon: 'campaign' },
        { key: 'activity',   label: 'Activity Log', icon: 'history' },
      ],
    },
    {
      label: 'Activity',
      items: [
        { key: 'game',      label: 'Game',      icon: 'sports_esports', badge: totalGameSessions },
        { key: 'access',    label: 'Access',    icon: 'manage_search',  badge: suspiciousCount > 0 ? suspiciousCount : undefined, alert: newSuspiciousCount > 0 },
        { key: 'referrals', label: 'Referrals', icon: 'group_add',      badge: referralCount > 0 ? referralCount : undefined },
        { key: 'trustline', label: 'Trustlines', icon: 'add_link' },
      ],
      links: [
        { href: `/admin/wins?token=${token}`, label: 'Game Wins', icon: 'emoji_events', badge: pendingWins > 0 ? pendingWins : undefined },
      ],
    },
  ]

  return (
    <aside className="hidden md:flex flex-col w-52 shrink-0 bg-[#0d1424] border-r border-white/8 min-h-screen sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto">
      <nav className="p-3 space-y-5 pt-4">
        {groups.map(group => (
          <div key={group.label}>
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-3 mb-1">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const isActive = tab === item.key
                return (
                  <button
                    key={item.key}
                    onClick={() => onTabChange(item.key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition relative ${
                      isActive
                        ? 'bg-[#D4AF37]/10 text-[#D4AF37]'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                    }`}
                  >
                    <Icon name={item.icon} className={`text-base ${isActive ? 'text-[#D4AF37]' : ''}`} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge !== undefined && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        isActive ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-white/8 text-gray-500'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                    {item.alert && tab !== item.key && (
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                    )}
                  </button>
                )
              })}
              {group.links?.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition text-gray-400 hover:text-gray-200 hover:bg-white/5"
                >
                  <Icon name={link.icon} className="text-base" />
                  <span className="flex-1">{link.label}</span>
                  {link.badge !== undefined && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
                      {link.badge}
                    </span>
                  )}
                  <Icon name="open_in_new" className="text-[11px] text-gray-600" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}
