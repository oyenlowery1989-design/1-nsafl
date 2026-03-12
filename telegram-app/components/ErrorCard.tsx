'use client'
import { useState } from 'react'

interface ErrorCardProps {
  error: string
  context?: string   // which page/feature this came from
  onRetry?: () => void
}

export default function ErrorCard({ error, context, onRetry }: ErrorCardProps) {
  const [copied, setCopied] = useState(false)

  const errorReport = [
    `Error: ${error}`,
    context ? `Context: ${context}` : null,
    `Time: ${new Date().toISOString()}`,
    `UA: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'}`,
  ].filter(Boolean).join('\n')

  function copyToClipboard() {
    navigator.clipboard.writeText(errorReport).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="glass-card rounded-xl p-4 border border-red-500/30 bg-red-500/5 space-y-3">
      {/* Header */}
      <div className="flex items-start space-x-2.5">
        <span className="material-symbols-outlined text-red-400 text-xl flex-shrink-0 mt-0.5"
          style={{ fontVariationSettings: "'FILL' 1" }}>
          error
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-red-300">Something went wrong</p>
          <p className="text-xs text-red-400/80 mt-0.5 leading-relaxed break-words">{error}</p>
          {context && (
            <p className="text-[10px] text-gray-500 mt-1">in {context}</p>
          )}
        </div>
      </div>

      {/* Support note */}
      <p className="text-[10px] text-gray-500 leading-relaxed">
        Please copy the error details and send to support so we can investigate.
      </p>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={copyToClipboard}
          className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-xl border text-xs font-semibold transition ${
            copied
              ? 'bg-green-500/20 border-green-500/40 text-green-400'
              : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
          }`}
        >
          <span className="material-symbols-outlined text-[13px]">
            {copied ? 'check' : 'content_copy'}
          </span>
          <span>{copied ? 'Copied!' : 'Copy error'}</span>
        </button>

        {onRetry && (
          <button
            onClick={onRetry}
            className="flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37] text-xs font-semibold hover:bg-[#D4AF37]/20 transition"
          >
            <span className="material-symbols-outlined text-[13px]">refresh</span>
            <span>Retry</span>
          </button>
        )}
      </div>
    </div>
  )
}
