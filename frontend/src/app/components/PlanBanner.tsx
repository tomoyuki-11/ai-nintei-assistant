'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { authHeaders, isAuthenticated, getTokenPayload } from '@/lib/auth'

type PlanStatus = {
  plan: string
  is_expired: boolean
  days_remaining: number | null
  monthly_usage: number
  monthly_limit: number | null
  is_limit_reached: boolean
  credits: number | null
}

export default function PlanBanner() {
  const [status, setStatus] = useState<PlanStatus | null>(null)
  const [upgrading, setUpgrading] = useState(false)

  function fetchStatus() {
    if (!isAuthenticated()) return
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/plan-status`, {
      headers: authHeaders(),
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setStatus(data) })
      .catch(() => {})
  }

  useEffect(() => {
    fetchStatus()
    function handleAuthChanged() {
      if (!isAuthenticated()) {
        setStatus(null)
      } else {
        fetchStatus()
      }
    }
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) setUpgrading(false)
    }
    window.addEventListener('planStatusChanged', fetchStatus)
    window.addEventListener('authChanged', handleAuthChanged)
    window.addEventListener('pageshow', handlePageShow)
    return () => {
      window.removeEventListener('planStatusChanged', fetchStatus)
      window.removeEventListener('authChanged', handleAuthChanged)
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [])

  // 法人・スタッフ向けのみStripe直接遷移（個人はプラン変更ページへ誘導）
  async function handleUpgrade() {
    localStorage.setItem('stripe_return_path', window.location.pathname)
    setUpgrading(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      window.location.href = data.url
    } catch {
      localStorage.removeItem('stripe_return_path')
      alert('決済ページへの移動に失敗しました。しばらくしてからお試しください。')
      setUpgrading(false)
    }
  }

  if (!status) return null

  const isIndividual = getTokenPayload()?.role === 'individual'

  if (status.is_expired) {
    if (isIndividual) {
      return (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-between text-xs text-red-700">
          <span className="font-medium">トライアル期間が終了しました。プランを選択してください。</span>
          <Link
            href="/plan"
            className="rounded-md bg-red-600 px-2.5 py-0.5 text-xs text-white font-medium hover:bg-red-700 transition-colors"
          >
            プラン変更
          </Link>
        </div>
      )
    }
    return (
      <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs text-red-700 text-center font-medium">
        ライセンスの有効期限が切れています。管理者にお問い合わせください。
      </div>
    )
  }

  if (status.plan === 'trial') {
    const nearExpiry = status.days_remaining !== null && status.days_remaining <= 3
    const isWarning = status.is_limit_reached || nearExpiry

    return (
      <div className={`border-b px-4 py-1.5 flex items-center justify-between text-xs ${
        isWarning
          ? 'bg-orange-50 border-orange-200 text-orange-700'
          : 'bg-blue-50 border-blue-200 text-blue-600'
      }`}>
        <span>
          トライアル期間中
          {status.days_remaining !== null && ` — 残り ${Math.max(0, status.days_remaining)} 日`}
        </span>
        <span className="flex items-center gap-2">
          <span>
            使用: {status.monthly_usage} / {status.monthly_limit} 回
            {status.is_limit_reached && <span className="ml-1 font-semibold">（上限到達）</span>}
          </span>
          {isIndividual ? (
            <Link
              href="/plan"
              className={`rounded-md px-2.5 py-0.5 text-xs text-white font-medium transition-colors ${
                isWarning ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              プラン変更
            </Link>
          ) : (
            <button
              onClick={handleUpgrade}
              disabled={upgrading}
              className={`rounded-md px-2.5 py-0.5 text-xs text-white font-medium disabled:opacity-50 transition-colors ${
                isWarning ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {upgrading ? '処理中...' : 'プランをアップグレード'}
            </button>
          )}
        </span>
      </div>
    )
  }

  if (status.plan === 'metered') {
    const noCredits = (status.credits ?? 0) <= 0
    return (
      <div className={`border-b px-4 py-1.5 flex items-center justify-between text-xs ${
        noCredits
          ? 'bg-orange-50 border-orange-200 text-orange-700'
          : 'bg-gray-50 border-gray-200 text-gray-600'
      }`}>
        <span>
          残クレジット: <span className="font-semibold">{status.credits ?? 0} 回</span>
          {noCredits && <span className="ml-1 font-semibold">（クレジット不足）</span>}
        </span>
        <Link
          href="/plan"
          className={`rounded-md px-2.5 py-0.5 text-xs text-white font-medium transition-colors ${
            noCredits ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-600 hover:bg-gray-700'
          }`}
        >
          クレジットを購入（¥600/回）
        </Link>
      </div>
    )
  }

  if (status.plan === 'monthly' && status.monthly_limit !== null) {
    return (
      <div className={`border-b px-4 py-1.5 flex items-center justify-between text-xs ${
        status.is_limit_reached
          ? 'bg-orange-50 border-orange-200 text-orange-700'
          : 'bg-gray-50 border-gray-200 text-gray-500'
      }`}>
        <span>
          今月の使用: {status.monthly_usage} / {status.monthly_limit} 回
          {status.credits !== null && status.credits > 0 && (
            <span className="ml-2 text-blue-600 font-medium">＋クレジット {status.credits}回分</span>
          )}
          {status.is_limit_reached && <span className="ml-1 font-semibold">（上限到達）</span>}
        </span>
        {status.is_limit_reached && (
          <Link
            href="/plan"
            className="rounded-md bg-orange-600 px-2.5 py-0.5 text-xs text-white font-medium hover:bg-orange-700 transition-colors"
          >
            クレジットを購入（¥600/回）
          </Link>
        )}
      </div>
    )
  }

  return null
}
