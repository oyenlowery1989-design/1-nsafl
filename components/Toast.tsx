'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

type Listener = (item: ToastItem) => void

// ── Singleton event bus ───────────────────────────────────────────────────────
let nextId = 0
const listeners: Set<Listener> = new Set()

export const toast = {
  success: (message: string) => emit(message, 'success'),
  error: (message: string) => emit(message, 'error'),
  info: (message: string) => emit(message, 'info'),
  warning: (message: string) => emit(message, 'warning'),
}

function emit(message: string, type: ToastType) {
  const item: ToastItem = { id: ++nextId, message, type }
  listeners.forEach((fn) => fn(item))
}

// ── Icon + color map ──────────────────────────────────────────────────────────
const CONFIG: Record<ToastType, { icon: string; border: string; text: string; bg: string }> = {
  success: { icon: 'check_circle', border: 'border-green-500/40', text: 'text-green-300', bg: 'bg-green-500/10' },
  error:   { icon: 'error',        border: 'border-red-500/40',   text: 'text-red-300',   bg: 'bg-red-500/10'   },
  info:    { icon: 'info',         border: 'border-blue-500/40',  text: 'text-blue-300',  bg: 'bg-blue-500/10'  },
  warning: { icon: 'warning',      border: 'border-amber-500/40', text: 'text-amber-300', bg: 'bg-amber-500/10' },
}

// ── Single toast item ─────────────────────────────────────────────────────────
function ToastBubble({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  const cfg = CONFIG[item.type]
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger enter animation
    const enter = requestAnimationFrame(() => setVisible(true))
    // Auto-dismiss after 3.5 s
    const dismiss = setTimeout(() => setVisible(false), 3500)
    const remove = setTimeout(() => onDone(item.id), 3900) // after exit anim
    return () => {
      cancelAnimationFrame(enter)
      clearTimeout(dismiss)
      clearTimeout(remove)
    }
  }, [item.id, onDone])

  return (
    <div
      className={`flex items-center space-x-2.5 px-4 py-3 rounded-xl border backdrop-blur-md shadow-lg transition-all duration-300 ${cfg.bg} ${cfg.border} ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <span
        className={`material-symbols-outlined text-base flex-shrink-0 ${cfg.text}`}
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        {cfg.icon}
      </span>
      <span className={`text-sm font-medium ${cfg.text}`}>{item.message}</span>
    </div>
  )
}

// ── Toast container — mount once in layout ────────────────────────────────────
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [mounted, setMounted] = useState(false)

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    setMounted(true)
    const add: Listener = (item) => setToasts((prev) => [...prev.slice(-3), item])
    listeners.add(add)
    return () => { listeners.delete(add) }
  }, [])

  if (!mounted || toasts.length === 0) return null

  return createPortal(
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-[calc(100vw-2rem)] max-w-sm space-y-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastBubble key={t.id} item={t} onDone={remove} />
      ))}
    </div>,
    document.body,
  )
}
