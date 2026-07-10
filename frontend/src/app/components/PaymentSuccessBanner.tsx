'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function PaymentSuccessBanner() {
  const [type, setType] = useState<'subscription' | 'credit' | null>(null)
  const pathname = usePathname()
  const bannerPageRef = useRef<string | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  function tryShowBanner(currentPath: string) {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    const stored = sessionStorage.getItem('payment_banner')
    if (stored) {
      try {
        const { type: t, path } = JSON.parse(stored) as { type: string; path: string }
        if (path === currentPath && (t === 'credit' || t === 'subscription')) {
          sessionStorage.removeItem('payment_banner')
          bannerPageRef.current = currentPath
          setType(t as 'credit' | 'subscription')
          window.dispatchEvent(new Event('planStatusChanged'))
          timersRef.current = [
            ...[2000, 5000].map((ms) =>
              setTimeout(() => window.dispatchEvent(new Event('planStatusChanged')), ms)
            ),
            setTimeout(() => setType(null), 8000),
          ]
          return
        }
      } catch {}
    }

    if (currentPath !== bannerPageRef.current) {
      setType(null)
      bannerPageRef.current = null
    }
  }

  useEffect(() => {
    tryShowBanner(pathname)
    return () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

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
