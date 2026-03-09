'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS } from '@/lib/constants'

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 w-full bg-[#0A0E1A]/90 backdrop-blur-xl border-t border-white/10 pb-safe pt-3 px-6 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
      <div className="flex justify-between items-center pb-5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          if (item.isCenter) {
            return (
              <div key={item.href} className="relative -top-6">
                <Link href={item.href}>
                  <button className="w-14 h-14 bg-[#D4AF37] text-black rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.8)] border-4 border-[#0A0E1A] transition transform active:scale-95">
                    <span className="material-symbols-outlined text-3xl animate-pulse">
                      sports_football
                    </span>
                  </button>
                </Link>
              </div>
            )
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center space-y-1 transition ${
                isActive ? 'text-[#D4AF37]' : 'text-gray-500 hover:text-[#D4AF37]'
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="text-[10px] font-medium tracking-wide uppercase">
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
