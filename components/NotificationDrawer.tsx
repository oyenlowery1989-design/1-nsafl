'use client'
import { useEffect, useState, useCallback } from 'react'
import { getTelegramInitData } from '@/lib/telegram'

interface NotificationItem {
  id: string
  title: string
  body: string
  created_at: string
  read: boolean
}

interface Props {
  open: boolean
  onClose: () => void
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function NotificationDrawer({ open, onClose }: Props) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [telegramAlertsOptIn, setTelegramAlertsOptIn] = useState(false)
  const [togglingPref, setTogglingPref] = useState(false)

  const authHeaders = useCallback(
    () => ({ 'x-telegram-init-data': getTelegramInitData() }),
    []
  )

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications', { headers: authHeaders() })
      const json = await res.json()
      if (json.success) {
        setNotifications(json.data.notifications ?? [])
        setTelegramAlertsOptIn(json.data.telegramAlertsOptIn ?? false)
      }
    } catch {
      // silently ignore fetch errors — drawer still renders empty state
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  const markAllRead = useCallback(async () => {
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: authHeaders(),
      })
      // Optimistically mark all as read in local state
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch {
      // ignore
    }
  }, [authHeaders])

  useEffect(() => {
    if (!open) return
    fetchNotifications().then(() => {
      markAllRead()
    })
  }, [open, fetchNotifications, markAllRead])

  const handleTogglePref = async () => {
    const newValue = !telegramAlertsOptIn
    setTelegramAlertsOptIn(newValue)
    setTogglingPref(true)
    try {
      await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ optIn: newValue }),
      })
    } catch {
      // Revert on error
      setTelegramAlertsOptIn(!newValue)
    } finally {
      setTogglingPref(false)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel — slides down from below the header */}
      <div
        className="fixed top-[72px] left-0 right-0 z-50 mx-4 rounded-2xl shadow-2xl overflow-hidden"
        style={{
          background: '#0A0E1A',
          border: '1px solid rgba(255,255,255,0.1)',
          animation: 'notifSlideDown 0.22s cubic-bezier(0.16,1,0.3,1) both',
        }}
      >
        {/* Header row */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-base font-bold text-white">Notifications</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full glass-card flex items-center justify-center hover:bg-white/10 transition"
            aria-label="Close notifications"
          >
            <span className="material-symbols-outlined text-gray-400" style={{ fontSize: 18 }}>
              close
            </span>
          </button>
        </div>

        {/* Notification list */}
        <div className="max-h-[55dvh] overflow-y-auto no-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <span
                className="material-symbols-outlined text-[#D4AF37]"
                style={{ fontSize: 40, animation: 'spin 1.2s linear infinite' }}
              >
                sports_football
              </span>
              <p className="text-sm text-gray-500">Loading notifications…</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <span
                className="material-symbols-outlined text-[#D4AF37]/40"
                style={{ fontSize: 44 }}
              >
                sports_football
              </span>
              <p className="text-sm text-gray-500 font-medium">No notifications yet</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {notifications.map((n) => (
                <li key={n.id} className="flex items-start gap-3 px-5 py-4">
                  {/* Unread dot */}
                  <div className="mt-1.5 shrink-0">
                    {!n.read ? (
                      <span className="block w-2 h-2 rounded-full bg-[#D4AF37]" />
                    ) : (
                      <span className="block w-2 h-2 rounded-full bg-transparent" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white leading-snug">{n.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{n.body}</p>
                    <p className="text-[10px] text-gray-600 mt-1">
                      {formatDate(n.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer — Telegram alerts toggle */}
        <div className="px-5 py-4 border-t border-white/10 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Telegram alerts</p>
            <p className="text-xs text-gray-500">Receive push notifications via bot</p>
          </div>
          <button
            onClick={handleTogglePref}
            disabled={togglingPref}
            aria-label={telegramAlertsOptIn ? 'Disable Telegram alerts' : 'Enable Telegram alerts'}
            className="relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none"
            style={{
              background: telegramAlertsOptIn ? '#D4AF37' : 'rgba(255,255,255,0.1)',
            }}
          >
            <span
              className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
              style={{
                transform: telegramAlertsOptIn ? 'translateX(24px)' : 'translateX(0)',
              }}
            />
          </button>
        </div>
      </div>

      {/* Keyframe for slide-down animation — injected inline */}
      <style>{`
        @keyframes notifSlideDown {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
