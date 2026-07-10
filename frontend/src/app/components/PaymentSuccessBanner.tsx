'use client'

import { useEffect, useState } from 'react'

export default function PaymentSuccessBanner() {
  const [type, setType] = useState<'subscription' | 'credit' | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('stripe_payment_type')
    if (stored === 'subscription' || stored === 'credit') {
      localStorage.removeItem('stripe_payment_type')
      setType(stored)
      const t = setTimeout(() => setType(null), 8000)
      return () => clearTimeout(t)
    }
  }, [])

  if (!type) return null

  return (
    <div className="px-4 pt-3">
      <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 flex items-center justify-between">
        <p className="text-sm text-green-700 font-medium">
          {type === 'credit'
            ? 'クレジットの購入が完了しました！（1回分追加）'
            : 'スタンダードプランへのアップグレードが完了しました！'}
        </p>
        <button onClick={() => setType(null)} className="text-green-500 hover:text-green-700 text-lg leading-none">×</button>
      </div>
    </div>
  )
}
