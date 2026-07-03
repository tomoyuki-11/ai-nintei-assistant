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
          className="flex flex-col items-center justify-center w-full rounded-xl border-2 border-blue-200 bg-white px-6 py-5 shadow-sm hover:border-blue-400 hover:bg-blue-50 transition-colors group"
        >
          <span className="text-2xl mb-1">🏢</span>
          <span className="text-base font-semibold text-gray-900 group-hover:text-blue-700">施設での使用</span>
          <span className="text-xs text-gray-400 mt-0.5">ライセンスキーでログイン</span>
        </Link>

        <Link
          href="/individual/login"
          className="flex flex-col items-center justify-center w-full rounded-xl border-2 border-gray-200 bg-white px-6 py-5 shadow-sm hover:border-gray-400 hover:bg-gray-50 transition-colors group"
        >
          <span className="text-2xl mb-1">👤</span>
          <span className="text-base font-semibold text-gray-900 group-hover:text-gray-700">個人での使用</span>
          <span className="text-xs text-gray-400 mt-0.5">メールアドレスでログイン</span>
        </Link>
      </div>
    </main>
  )
}
