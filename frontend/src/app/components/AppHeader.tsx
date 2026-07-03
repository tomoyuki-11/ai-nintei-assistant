'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import HamburgerMenu from './HamburgerMenu'
import PlanBanner from './PlanBanner'
import { useRecording } from './RecordingContext'

const EXCLUDED = ['/login', '/licence', '/signup', '/adminTool']

export default function AppHeader() {
  const pathname = usePathname()
  const { isRecording } = useRecording()

  if (EXCLUDED.some((p) => pathname === p || pathname.startsWith(p + '/'))) return null

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <Link href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo-transparent_1.png" alt="AI認定調査アシスタント" style={{ height: '36px', width: 'auto' }} />
        </Link>
        <div className="flex items-center gap-3">
          {isRecording && (
            <Link
              href="/assess"
              className="flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1 text-xs text-white font-medium animate-pulse"
            >
              <span className="inline-block w-2 h-2 rounded-full bg-white" />
              録音中
            </Link>
          )}
          <HamburgerMenu />
        </div>
      </header>
      <PlanBanner />
    </>
  )
}
