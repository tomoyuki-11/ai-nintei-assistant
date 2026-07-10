'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function PaymentSuccessBanner() {
  const [type, setType] = useState<'subscription' | 'credit' | null>(null)
  const pathname = usePathname()
  const bannerPageRef = useRef<string | null>(null)

  useEffect(() => {
    // ホームは独自のバナーがあるため表示しない
    if (pathname === '/') {
      setType(null)
      bannerPageRef.current = null
      return
    }

    // sessionStorageから取得し、現在のパスと一致する場合のみ表示
    const stored = sessionStorage.getItem('payment_banner')
    if (stored) {
      try {
        const { type: t, path } = JSON.parse(stored) as { type: string; path: string }
        if (path === pathname && (t === 'credit' || t === 'subscription')) {
          sessionStorage.removeItem('payment_banner')
          bannerPageRef.current = pathname
          setType(t as 'credit' | 'subscription')
          // PlanBannerを更新
          window.dispatchEvent(new Event('planStatusChanged'))
          const retryTimers = [2000, 5000].map((ms) =>
            setTimeout(() => window.dispatchEvent(new Event('planStatusChanged')), ms)
          )
          const hideTimer = setTimeout(() => setType(null), 8000)
          return () => {
            clearTimeout(hideTimer)
            retryTimers.forEach(clearTimeout)
          }
        }
      } catch {}
    }

    // 別ページへ遷移したらバナーをリセット
    if (pathname !== bannerPageRef.current) {
      setType(null)
      bannerPageRef.current = null
    }
  }, [pathname])

  if (!type || pathname === '/') return null

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
