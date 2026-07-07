'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getTokenPayload, removeToken } from '@/lib/auth'

export default function HamburgerMenu() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const payload = getTokenPayload()
  const isAdmin = payload?.role === 'admin'
  const isIndividual = payload?.role === 'individual'

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleLogout() {
    setOpen(false)
    if (!confirm('ログアウトしますか？')) return
    removeToken()
    router.push(isIndividual ? '/individual/login' : '/start')
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex flex-col justify-center items-center w-10 h-10 rounded-lg hover:bg-gray-100 active:bg-gray-100 transition-colors gap-1.5"
        aria-label="メニュー"
      >
        <span
          className="block w-5 h-0.5 bg-gray-700 rounded-full"
          style={{
            transition: 'transform 0.3s ease',
            transform: open ? 'translateY(8px) rotate(45deg)' : 'none',
          }}
        />
        <span
          className="block w-5 h-0.5 bg-gray-700 rounded-full"
          style={{
            transition: 'opacity 0.2s ease, transform 0.3s ease',
            opacity: open ? 0 : 1,
            transform: open ? 'scaleX(0)' : 'none',
          }}
        />
        <span
          className="block w-5 h-0.5 bg-gray-700 rounded-full"
          style={{
            transition: 'transform 0.3s ease',
            transform: open ? 'translateY(-8px) rotate(-45deg)' : 'none',
          }}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden z-50">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            ホーム
          </Link>
          <div className="border-t border-gray-100 my-1" />
          {isAdmin && (
            <Link
              href="/staff"
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              スタッフ管理
            </Link>
          )}
          {isIndividual && (
            <Link
              href="/plan"
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              プラン変更
            </Link>
          )}
          {(isAdmin || isIndividual) && (
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              設定
            </Link>
          )}
          <div className="border-t border-gray-100 my-1" />
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            ログアウト
          </button>
        </div>
      )}
    </div>
  )
}
