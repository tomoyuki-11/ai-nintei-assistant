'use client'

import Link from 'next/link'
import { authHeaders, getTokenPayload } from '@/lib/auth'

export type LimitPlan = {
  plan: string
  is_expired: boolean
  monthly_limit: number | null
}

export async function checkPlanLimit(): Promise<LimitPlan | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/plan-status`, {
      headers: authHeaders(),
    })
    if (!res.ok) return null
    const s = await res.json()
    const credits: number = s.credits ?? 0
    const blocked =
      s.is_expired ||
      (s.plan === 'trial' && s.is_limit_reached && credits <= 0) ||
      (s.plan === 'monthly' && s.is_limit_reached && credits <= 0) ||
      (s.plan === 'metered' && credits <= 0)
    return blocked ? s : null
  } catch {
    return null
  }
}

type Props = {
  limitPlan: LimitPlan | null
  onClose: () => void
}

export default function PlanLimitModal({ limitPlan, onClose }: Props) {
  if (!limitPlan) return null

  const isIndividual = getTokenPayload()?.role === 'individual'
  const message = limitPlan.is_expired
    ? 'トライアル期間が終了しました。プランを選択してください。'
    : limitPlan.plan === 'trial'
    ? `今月の使用回数の上限（${limitPlan.monthly_limit}回）に達しました。プランをアップグレードすると続けて利用できます。`
    : 'クレジットが不足しています。クレジットを購入してください。'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-80 mx-4">
        <p className="text-sm font-semibold text-gray-900 mb-3">実行できません</p>
        <p className="text-sm text-gray-600 mb-5">{message}</p>
        <div className="flex flex-col gap-2">
          {isIndividual && (
            <Link
              href="/plan"
              onClick={() => {
                localStorage.setItem('plan_entry_path', window.location.pathname)
                onClose()
              }}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white font-medium hover:bg-blue-700 transition-colors text-center"
            >
              プラン変更ページへ
            </Link>
          )}
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
