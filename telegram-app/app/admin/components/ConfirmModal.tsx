'use client'
import { Icon } from './ui'

interface ConfirmModalProps {
  type: 'logout' | 'delete' | 'block' | 'unblock'
  name: string
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
}

const CONFIG = {
  logout:  { icon: 'logout',       color: 'text-blue-400',   btnClass: 'bg-blue-600 hover:bg-blue-700',   label: 'Log out user',  body: 'Disconnects all wallets. The user keeps their account and can reconnect on next open.' },
  delete:  { icon: 'delete',       color: 'text-red-400',    btnClass: 'bg-red-600 hover:bg-red-700',     label: 'Delete user',   body: 'Wipes all data and removes the account. They can return as a brand new user — not blocked.' },
  block:   { icon: 'block',        color: 'text-orange-400', btnClass: 'bg-orange-600 hover:bg-orange-700', label: 'Block user',  body: 'User will immediately lose access to the app and see a generic error screen.' },
  unblock: { icon: 'check_circle', color: 'text-green-400',  btnClass: 'bg-green-600 hover:bg-green-700', label: 'Unblock user',  body: 'Restores full app access for this user.' },
}

export function ConfirmModal({ type, name, loading, onConfirm, onCancel }: ConfirmModalProps) {
  const cfg = CONFIG[type]
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <span className={`text-2xl ${cfg.color}`}>
            <Icon name={cfg.icon} className="text-2xl" />
          </span>
          <div>
            <p className="text-white font-semibold text-sm">{cfg.label}</p>
            <p className="text-gray-400 text-xs">{name}</p>
          </div>
        </div>
        <p className="text-gray-300 text-sm">{cfg.body}</p>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 border border-white/10 text-gray-300 text-sm rounded-lg py-2 hover:bg-white/5 transition disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 text-sm font-semibold rounded-lg py-2 transition disabled:opacity-40 text-white ${cfg.btnClass}`}
          >
            {loading ? '…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
