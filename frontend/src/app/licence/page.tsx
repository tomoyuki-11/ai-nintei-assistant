'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL

export default function LicencePage() {
  const router = useRouter()
  const [licenceKey, setLicenceKey] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('licence_key')
    if (saved) setLicenceKey(saved)
  }, [])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/auth/license/${encodeURIComponent(licenceKey.trim())}`)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      localStorage.setItem('org_id', data.org_id)
      localStorage.setItem('org_name', data.org_name)
      localStorage.setItem('licence_key', licenceKey.trim())
      router.push('/login')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ライセンスキーが無効です')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', padding: '2rem 0' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/logo-login.png" alt="AI認定調査アシスタント" style={{ display: 'block', width: '80vw', maxWidth: '400px', height: 'auto' }} />
      <div style={{ width: '100%', maxWidth: '384px', padding: '0 1rem' }}>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ライセンスキー
              </label>
              <input
                type="text"
                value={licenceKey}
                onChange={(e) => setLicenceKey(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                required
                autoFocus
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '認証中...' : 'ライセンス認証'}
            </button>
          </form>
        </div>

        <div className="mt-4 text-center">
          <Link href="/start" className="text-sm text-gray-400 hover:text-gray-600 hover:underline">
            ← 選択画面に戻る
          </Link>
        </div>
      </div>
    </main>
  )
}
