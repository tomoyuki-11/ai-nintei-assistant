'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authHeaders, isAuthenticated, getTokenPayload } from '@/lib/auth'

const API = process.env.NEXT_PUBLIC_API_URL

type PlanStatus = {
  plan: string
  is_expired: boolean
  days_remaining: number | null
  monthly_usage: number
  monthly_limit: number | null
  is_limit_reached: boolean
  credits: number | null
}

const PLAN_LABELS: Record<string, string> = {
  trial: 'トライアル',
  metered: '従量課金',
  monthly: '月額プラン',
  dev: '開発者プラン',
}

export default function PlanPage() {
  const router = useRouter()
  const [status, setStatus] = useState<PlanStatus | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/start'); return }
    const payload = getTokenPayload()
    if (payload?.role !== 'individual') { router.push('/'); return }

    fetch(`${API}/api/plan-status`, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setStatus(d) })
      .catch(() => {})
  }, [router])

  async function handleStripe(type: 'monthly' | 'credit') {
    setLoading(type)
    setError('')
    try {
      const endpoint = type === 'monthly'
        ? '/api/stripe/create-checkout-session'
        : '/api/stripe/create-credit-checkout'
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      window.location.href = data.url
    } catch {
      setError('決済ページへの移動に失敗しました。しばらくしてからお試しください。')
      setLoading(null)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-xl font-bold text-gray-900 mb-6">料金プラン</h1>

        {/* 現在のプラン */}
        {status && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
            <p className="text-xs text-gray-500 mb-1">現在のプラン</p>
            <p className="text-lg font-bold text-gray-900 mb-3">{PLAN_LABELS[status.plan] ?? status.plan}</p>
            <div className="space-y-1 text-sm text-gray-600">
              {status.plan === 'trial' && status.days_remaining !== null && (
                <p>残り <span className="font-medium text-gray-900">{status.days_remaining}日</span>（{status.monthly_limit !== null ? `残り${status.monthly_limit - status.monthly_usage}回` : ''}）</p>
              )}
              {status.plan === 'monthly' && (
                <p>今月の利用：<span className="font-medium text-gray-900">{status.monthly_usage} / {status.monthly_limit}回</span></p>
              )}
              {status.plan === 'metered' && status.credits !== null && (
                <p>残りクレジット：<span className="font-medium text-gray-900">{status.credits}回分</span></p>
              )}
              {status.is_expired && (
                <p className="text-red-600 font-medium">プランの有効期限が切れています</p>
              )}
              {status.is_limit_reached && (
                <p className="text-orange-600 font-medium">今月の利用上限に達しています</p>
              )}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <div className="space-y-4">
          {/* 従量課金 */}
          <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs font-medium text-blue-600 mb-0.5">使った分だけ</p>
                <h2 className="text-base font-bold text-gray-900">従量課金</h2>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold text-gray-900">都度購入</span>
              </div>
            </div>
            <ul className="text-sm text-gray-600 space-y-1 mb-4">
              <li className="flex items-center gap-2"><span className="text-blue-500">✓</span> クレジットを購入して使用</li>
              <li className="flex items-center gap-2"><span className="text-blue-500">✓</span> 使わない月は費用なし</li>
              <li className="flex items-center gap-2"><span className="text-blue-500">✓</span> 有効期限なし</li>
            </ul>
            <button
              onClick={() => handleStripe('credit')}
              disabled={loading !== null}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading === 'credit' ? '処理中...' : 'クレジットを購入する'}
            </button>
          </div>

          {/* 月額 */}
          <div className="bg-white rounded-xl border border-purple-200 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs font-medium text-purple-600 mb-0.5">定期利用に最適</p>
                <h2 className="text-base font-bold text-gray-900">月額プラン</h2>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold text-gray-900">月額</span>
                <p className="text-xs text-gray-500">8回/月</p>
              </div>
            </div>
            <ul className="text-sm text-gray-600 space-y-1 mb-4">
              <li className="flex items-center gap-2"><span className="text-purple-500">✓</span> 月8回まで利用可能</li>
              <li className="flex items-center gap-2"><span className="text-purple-500">✓</span> 毎月自動更新</li>
              <li className="flex items-center gap-2"><span className="text-purple-500">✓</span> いつでも解約可能</li>
            </ul>
            <button
              onClick={() => handleStripe('monthly')}
              disabled={loading !== null}
              className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm text-white font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {loading === 'monthly' ? '処理中...' : '月額プランに申し込む'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
