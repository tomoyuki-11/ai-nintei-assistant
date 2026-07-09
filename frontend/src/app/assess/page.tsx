'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { isAuthenticated } from '@/lib/auth'

const methods = [
  {
    href: '/assess/audio',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
    title: '音声ファイルを整形',
    desc: '録音済みの音声ファイルをアップロードして整形します',
  },
  {
    href: '/assess/text',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: 'テキストを貼り付けて整形',
    desc: 'テキストを貼り付けてAIが認定調査票形式に整形します',
  },
  {
    href: '/assess/record',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
    title: '録音して整形',
    desc: 'その場で録音して自動で文字起こし・整形を行います',
  },
]

export default function AssessPage() {
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated()) router.push('/start')
  }, [router])

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-gray-900">認定調査</h1>
            <p className="text-xs text-gray-500 mt-0.5">整形方法を選択してください</p>
          </div>
          <Link
            href="/"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 transition-colors"
          >
            ← ホームへ戻る
          </Link>
        </div>

        <div className="space-y-3">
          {methods.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="flex items-center gap-4 rounded-xl bg-white border border-gray-200 px-5 py-4 shadow-sm hover:shadow-md hover:border-blue-300 active:bg-gray-50 transition-all"
            >
              <div className="shrink-0">{m.icon}</div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{m.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className="ml-auto shrink-0 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
