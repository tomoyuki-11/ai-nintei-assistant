'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authHeaders } from '@/lib/auth'

const API = process.env.NEXT_PUBLIC_API_URL

async function completeOnboarding() {
  await fetch(`${API}/api/individual/complete-onboarding`, {
    method: 'POST',
    headers: authHeaders(),
  }).catch(() => {})
}

export default function PlanSelectPage() {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleTrial() {
    setLoading('trial')
    await completeOnboarding()
    router.push('/')
  }

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
      await completeOnboarding()
      window.location.href = data.url
    } catch {
      setError('決済ページへの移動に失敗しました。しばらくしてからお試しください。')
      setLoading(null)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/logo-login.png"
        alt="AI認定調査アシスタント"
        className="w-[60vw] max-w-[280px] mb-8"
      />

      <h1 className="text-lg font-bold text-gray-900 mb-2">プランを選択してください</h1>
      <p className="text-sm text-gray-500 mb-8">後からいつでも変更できます</p>

      {error && (
        <p className="text-sm text-red-600 mb-4">{error}</p>
      )}

      <div className="w-full max-w-md space-y-4">
        {/* トライアル */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-medium text-green-600 mb-0.5">まずは無料で試す</p>
              <h2 className="text-base font-bold text-gray-900">トライアル</h2>
            </div>
            <span className="text-2xl font-bold text-gray-900">¥0</span>
          </div>
          <ul className="text-sm text-gray-600 space-y-1 mb-4">
            <li className="flex items-center gap-2"><span className="text-green-500">✓</span> 14日間無料</li>
            <li className="flex items-center gap-2"><span className="text-green-500">✓</span> 3回まで利用可能</li>
            <li className="flex items-center gap-2"><span className="text-green-500">✓</span> クレジットカード不要</li>
          </ul>
          <button
            onClick={handleTrial}
            disabled={loading !== null}
            className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm text-white font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading === 'trial' ? '処理中...' : '無料で始める'}
          </button>
        </div>

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
    </main>
  )
}
