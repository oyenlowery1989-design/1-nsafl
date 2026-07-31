'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Badge, Card, Th, Td, Icon } from '../components/ui'
import { dt } from '../utils'
import type { AdminData, TrustlineSubmission } from '../types'

function TrustlinePageInner() {
  const params = useSearchParams()
  const [token, setToken] = useState<string | null>(null)
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const urlToken = params.get('token')
    if (urlToken) {
      localStorage.setItem('admin_token', urlToken)
      setToken(urlToken)
    } else {
      setToken(localStorage.getItem('admin_token') ?? '')
    }
  }, [params])

  useEffect(() => {
    if (token === null || token === '') return
    fetch('/api/admin', { headers: { 'x-admin-token': token } })
      .then(r => r.json())
      .then(res => {
        if (!res.success) throw new Error(res.error ?? 'Failed to load')
        setData(res.data)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin h-8 w-8 border-2 border-[#D4AF37] border-t-transparent rounded-full" /></div>
  if (error) return <div className="text-red-400 text-center py-20">{error}</div>
  if (!data) return null

  const all = data.trustlineSubmissions ?? []

  return (
    <div className="space-y-4 p-4 sm:p-6 min-h-screen bg-[#0a0f1e]">
      <div className="flex items-center gap-2 mb-2">
        <Icon name="link" className="text-xl text-[#D4AF37]" />
        <h1 className="text-lg font-bold text-white">Trustline Submissions</h1>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Badge color="gray">{all.length} submissions (last 50)</Badge>
        <Badge color="blue">{all.filter(s => s.type === 'trustline').length} trustline</Badge>
        <Badge color="yellow">{all.filter(s => s.type === 'purchase').length} purchase</Badge>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/3"><tr>
              <Th>ID</Th><Th>Type</Th><Th>IP</Th><Th>Result</Th><Th>TX Hash</Th><Th>Wallet / XDR</Th><Th>When</Th>
            </tr></thead>
            <tbody className="divide-y divide-white/4">
              {all.length === 0
                ? <tr><td colSpan={7} className="text-center text-gray-600 text-sm py-10">No submissions yet</td></tr>
                : all.map(s => {
                  const isBypass = s.xdr?.startsWith('BYPASS_TEST')
                  const walletMatch = isBypass ? s.xdr?.match(/wallet: (\S+)/) : null
                  const walletAddr = walletMatch?.[1] ?? null
                  return (
                    <tr key={s.id} className="hover:bg-white/3 transition-colors">
                      <Td mono><span className="text-gray-500">{s.id}</span></Td>
                      <Td>
                        <div className="flex flex-col gap-1">
                          {s.type === 'purchase' ? <Badge color="yellow">Purchase</Badge> : <Badge color="blue">Trustline</Badge>}
                          {isBypass && <Badge color="gray">TEST</Badge>}
                        </div>
                      </Td>
                      <Td mono><span className="text-gray-300">{s.ip ?? '—'}</span></Td>
                      <Td>{s.success ? <Badge color="green">Success</Badge> : <Badge color="red">Failed</Badge>}</Td>
                      <Td mono>
                        {s.tx_hash
                          ? <a
                              href={`https://stellar.expert/explorer/public/tx/${s.tx_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[#D4AF37] hover:underline"
                              title={s.tx_hash}
                            >{s.tx_hash.slice(0, 8)}...{s.tx_hash.slice(-8)}</a>
                          : <span className="text-gray-600">—</span>}
                      </Td>
                      <Td mono>
                        {walletAddr
                          ? <span className="text-xs text-[#D4AF37]" title={walletAddr}>{walletAddr.slice(0, 6)}...{walletAddr.slice(-6)}</span>
                          : <span className="text-xs text-gray-400 bg-black/30 px-2 py-0.5 rounded" title={s.xdr}>{s.xdr.slice(0, 20)}...</span>
                        }
                      </Td>
                      <Td><span className="text-gray-500 text-xs">{dt(s.created_at)}</span></Td>
                    </tr>
                  )
                })
              }
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

export default function TrustlinePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh] bg-[#0a0f1e]"><div className="animate-spin h-8 w-8 border-2 border-[#D4AF37] border-t-transparent rounded-full" /></div>}>
      <TrustlinePageInner />
    </Suspense>
  )
}
