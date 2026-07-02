'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import HamburgerMenu from './HamburgerMenu'
import PlanBanner from './PlanBanner'

const EXCLUDED = ['/login', '/licence', '/signup', '/adminTool']

export default function AppHeader() {
  const pathname = usePathname()
  if (EXCLUDED.some((p) => pathname === p || pathname.startsWith(p + '/'))) return null

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <Link href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo-transparent_1.png" alt="AI認定調査アシスタント" style={{ height: '36px', width: 'auto' }} />
        </Link>
        <HamburgerMenu />
      </header>
      <PlanBanner />
    </>
  )
}
