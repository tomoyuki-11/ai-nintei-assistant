'use client'

import { useEffect, useState } from 'react'
import { authHeaders, isAuthenticated } from '@/lib/auth'

type PlanStatus = {
  plan: string
  is_expired: boolean
  days_remaining: number | null
  monthly_usage: number
  monthly_limit: number | null
  is_limit_reached: boolean
}

export default function PlanBanner() {
  const [status, setStatus] = useState<PlanStatus | null>(null)
  const [upgrading, setUpgrading] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) return
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/plan-status`, {
      headers: authHeaders(),
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setStatus(data) })
      .catch(() => {})
  }, [])

  async function handleUpgrade() {
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
      alert('決済ページへの移動に失敗しました。しばらくしてからお試しください。')
      setUpgrading(false)
    }
  }

  if (!status) return null

  if (status.is_expired) {
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
        <span className="flex items-center gap-3">
          <span>
            使用: {status.monthly_usage} / {status.monthly_limit} 回
            {status.is_limit_reached && <span className="ml-1 font-semibold">（上限到達）</span>}
          </span>
          {isWarning && (
            <button
              onClick={handleUpgrade}
              disabled={upgrading}
              className="rounded-md bg-orange-600 px-2.5 py-0.5 text-xs text-white font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              {upgrading ? '処理中...' : 'プランをアップグレード'}
            </button>
          )}
        </span>
      </div>
    )
  }

  if (status.plan === 'monthly' && status.monthly_limit !== null) {
    return (
      <div className={`border-b px-4 py-1.5 flex items-center justify-end text-xs ${
        status.is_limit_reached
          ? 'bg-orange-50 border-orange-200 text-orange-700'
          : 'bg-gray-50 border-gray-200 text-gray-500'
      }`}>
        <span>
          今月の使用: {status.monthly_usage} / {status.monthly_limit} 回
          {status.is_limit_reached && <span className="ml-1 font-semibold">（上限到達）</span>}
        </span>
      </div>
    )
  }

  return null
}
