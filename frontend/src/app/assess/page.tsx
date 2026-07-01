'use client'

import Link from 'next/link'
import FormatForm from '../components/FormatForm'

export default function AssessPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">認定調査</h1>
          <Link
            href="/"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 transition-colors"
          >
            ← ホームへ戻る
          </Link>
        </div>
        <FormatForm />
      </div>
    </main>
  )
}
