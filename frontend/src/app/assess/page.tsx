'use client'

import { useRouter } from 'next/navigation'
import FormatForm from '../components/FormatForm'

export default function AssessPage() {
  const router = useRouter()

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          ← 戻る
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-transparent_1.png" alt="AI認定調査アシスタント" style={{ height: '32px', width: 'auto' }} />
      </header>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <FormatForm />
      </div>
    </main>
  )
}
