'use client'
import { Component, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { crashed: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false }

  static getDerivedStateFromError(): State {
    return { crashed: true }
  }

  componentDidCatch(error: Error) {
    // Fire-and-forget to trap endpoint so we know about crashes
    fetch('/api/trap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsError: error.message, url: window.location.href }),
    }).catch(() => null)
  }

  render() {
    if (this.state.crashed) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#0A0E1A] px-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-red-400 text-3xl">error</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white">Something went wrong</h1>
            <p className="text-sm text-gray-400">The app encountered an unexpected error.</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-xl bg-[#D4AF37] text-black text-sm font-bold uppercase tracking-wide"
          >
            Reload App
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
