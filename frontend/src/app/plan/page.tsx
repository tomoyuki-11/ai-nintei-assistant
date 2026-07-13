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
  subscription_cancel_at: string | null
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
  const [loading, setLoading] = useState<'monthly' | 'credit' | 'portal' | null>(null)
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

  // iOS bfcache: Stripe で × を押してブラウザバックで戻った際に状態をリセット
  useEffect(() => {
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) setLoading(null)
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  async function handleStripe(type: 'monthly' | 'credit' | 'portal') {
    if (type !== 'portal') {
      const entryPath = localStorage.getItem('plan_entry_path')
      localStorage.removeItem('plan_entry_path')
      localStorage.setItem('stripe_return_path', entryPath || window.location.pathname)
    }
    setLoading(type)
    setError('')
    try {
      const endpoint =
        type === 'monthly' ? '/api/stripe/create-checkout-session'
        : type === 'credit' ? '/api/stripe/create-credit-checkout'
        : '/api/stripe/customer-portal'
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      window.location.href = data.url
    } catch (e) {
      if (type !== 'portal') localStorage.removeItem('stripe_return_path')
      setError(e instanceof Error ? e.message : '決済ページへの移動に失敗しました。しばらくしてからお試しください。')
      setLoading(null)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-xl font-bold text-gray-900 mb-6">プラン変更</h1>

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
                <div className="space-y-0.5">
                  <p>今月の利用：<span className="font-medium text-gray-900">{status.monthly_usage} / {status.monthly_limit}回</span>
                    {status.credits !== null && status.credits > 0 && (
                      <span className="ml-2 text-blue-600 font-medium">＋クレジット {status.credits}回分</span>
                    )}
                  </p>
                </div>
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
            {status.plan === 'monthly' && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                {status.subscription_cancel_at && (
                  <p className="text-xs text-orange-600 font-medium">
                    {new Date(status.subscription_cancel_at).toLocaleDateString('ja-JP', {
                      year: 'numeric', month: 'long', day: 'numeric'
                    })}に自動的に従量課金に変更されます
                  </p>
                )}
                <button
                  onClick={() => handleStripe('portal')}
                  disabled={loading !== null}
                  className="text-xs text-gray-400 hover:text-gray-600 hover:underline disabled:opacity-50 transition-colors"
                >
                  {loading === 'portal' ? '処理中...' : '解約・プラン変更はこちら'}
                </button>
              </div>
            )}
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
                <span className="text-2xl font-bold text-gray-900">¥600</span>
                <span className="text-sm text-gray-500"> / 回</span>
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
              {loading === 'credit' ? '処理中...' : 'クレジットを購入する（¥600/回）'}
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
                <span className="text-2xl font-bold text-gray-900">¥2,980</span>
                <span className="text-sm text-gray-500"> / 月</span>
                <p className="text-xs text-gray-400 mt-0.5">月8回まで利用可能</p>
              </div>
            </div>
            <ul className="text-sm text-gray-600 space-y-1 mb-4">
              <li className="flex items-center gap-2"><span className="text-purple-500">✓</span> 月8回まで利用可能（¥373/回相当）</li>
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
