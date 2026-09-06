'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import HamburgerMenu from './HamburgerMenu'
import PlanBanner from './PlanBanner'
import { useRecording } from './RecordingContext'
import { getTokenPayload } from '@/lib/auth'

const EXCLUDED = ['/login', '/licence', '/signup', '/adminTool', '/individual/plan-select', '/start', '/individual/login', '/individual/register']

export default function AppHeader() {
  const pathname = usePathname()
  const { isRecording, isTranscribing } = useRecording()
  const email = getTokenPayload()?.email

  if (EXCLUDED.some((p) => pathname === p || pathname.startsWith(p + '/'))) return null

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex flex-col">
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo-transparent_1.png" alt="AI認定調査アシスタント" style={{ height: '36px', width: 'auto' }} />
          </Link>
          {/* モバイル: ロゴの下にメールアドレスを表示 */}
          {email && (
            <span className="sm:hidden text-xs text-gray-500 mt-0.5">{email}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isTranscribing && (
            <Link
              href="/assess"
              className="flex items-center gap-1.5 rounded-full bg-gray-500 px-3 py-1 text-xs text-white font-medium"
            >
              <span className="inline-block w-2 h-2 rounded-full border border-white border-t-transparent animate-spin" />
              文字起こし中
            </Link>
          )}
          {isRecording && (
            <Link
              href="/assess"
              className="flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1 text-xs text-white font-medium animate-pulse"
            >
              <span className="inline-block w-2 h-2 rounded-full bg-white" />
              録音中
            </Link>
          )}
          {/* PC: ハンバーガーメニューの左にメールアドレスを表示 */}
          {email && (
            <span className="hidden sm:block text-xs text-gray-500">{email}</span>
          )}
          <HamburgerMenu />
        </div>
      </div>
      <PlanBanner />
    </header>
  )
}
