import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { ClipboardList, FolderOpen, Users, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const navItems = [
  { to: '/', icon: ClipboardList, label: 'Today' },
  { to: '/projects', icon: FolderOpen, label: 'Projects' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
]

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="flex w-56 flex-shrink-0 flex-col bg-surface text-white">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500">
            <span className="text-sm font-bold text-surface">D</span>
          </div>
          <span className="text-base font-semibold tracking-wide">Datum</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-amber-500 text-surface'
                    : 'text-gray-400 hover:bg-surface-muted hover:text-white'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Sign out */}
        <div className="border-t border-surface-border px-3 py-3">
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 transition-colors hover:bg-surface-muted hover:text-white"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-1 flex-col overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  )
}
