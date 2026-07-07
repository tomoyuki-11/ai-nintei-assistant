'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { isAuthenticated } from '@/lib/auth'

export default function StartPage() {
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated()) router.replace('/')
  }, [router])

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/logo-login.png"
        alt="AI認定調査アシスタント"
        className="w-[80vw] max-w-[360px] mb-10"
      />

      <div className="w-full max-w-sm space-y-4">
        <p className="text-center text-sm text-gray-500 mb-6">ご利用の種別を選択してください</p>

        <Link
          href="/licence"
          className="flex items-center w-full rounded-xl border-2 border-blue-200 bg-white px-5 py-4 shadow-sm hover:border-blue-400 hover:bg-blue-50 transition-colors group gap-4"
        >
          <div className="shrink-0 w-12 h-12 rounded-xl bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="8" width="18" height="13" rx="1.5" fill="#3B82F6" opacity="0.2"/>
              <rect x="3" y="8" width="18" height="13" rx="1.5" stroke="#2563EB" strokeWidth="1.5"/>
              <path d="M8 21V13h8v8" stroke="#2563EB" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M3 10L12 3l9 7" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="10" y="15" width="4" height="6" rx="0.5" fill="#2563EB" opacity="0.5"/>
              <rect x="6" y="13" width="2.5" height="2.5" rx="0.3" fill="#2563EB"/>
              <rect x="15.5" y="13" width="2.5" height="2.5" rx="0.3" fill="#2563EB"/>
            </svg>
          </div>
          <div className="text-left">
            <p className="text-base font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">施設での使用</p>
            <p className="text-xs text-gray-400 mt-0.5">ライセンスキーでログイン</p>
          </div>
          <svg className="ml-auto shrink-0 text-gray-300 group-hover:text-blue-400 transition-colors" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>

        <Link
          href="/individual/login"
          className="flex items-center w-full rounded-xl border-2 border-gray-200 bg-white px-5 py-4 shadow-sm hover:border-green-400 hover:bg-green-50 transition-colors group gap-4"
        >
          <div className="shrink-0 w-12 h-12 rounded-xl bg-gray-100 group-hover:bg-green-100 flex items-center justify-center transition-colors">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="8" r="3.5" fill="#22C55E" opacity="0.25" stroke="#16A34A" strokeWidth="1.5"/>
              <path d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="12" cy="8" r="2" fill="#16A34A"/>
            </svg>
          </div>
          <div className="text-left">
            <p className="text-base font-semibold text-gray-900 group-hover:text-green-700 transition-colors">個人での使用</p>
            <p className="text-xs text-gray-400 mt-0.5">メールアドレスでログイン</p>
          </div>
          <svg className="ml-auto shrink-0 text-gray-300 group-hover:text-green-400 transition-colors" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      </div>
    </main>
  )
}
