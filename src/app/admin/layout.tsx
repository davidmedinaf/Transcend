'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const navItems = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Services', href: '/admin/services' },
  { label: 'Schedule', href: '/admin/schedule' },
  { label: 'Bookings', href: '/admin/bookings' },
  { label: 'Users', href: '/admin/users' },
  { label: 'Seed Data', href: '/admin/seed' },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function isActive(href: string) {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  }

  return (
    <div className="flex min-h-screen bg-[#1a1a1a] text-white">
      {/* Mobile header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-white/10 bg-transcend-black px-4 lg:hidden">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-white/70 hover:text-white p-2"
          aria-label="Toggle menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {sidebarOpen ? (
              <path d="M18 6L6 18M6 6l12 12" />
            ) : (
              <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
            )}
          </svg>
        </button>
        <Link href="/">
          <img src="/logo-transcend.webp" alt="Transcend" className="h-8 w-auto" />
        </Link>
        <div className="w-10" />
      </header>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-[220px] bg-transcend-black flex flex-col border-r border-white/10 transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {/* Logo (desktop only) */}
        <div className="hidden lg:flex items-center justify-center px-6 py-6 border-b border-white/10">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo-transcend.webp" alt="Transcend Health Mallorca" className="h-10 w-auto" />
          </Link>
        </div>

        {/* Close area (mobile) */}
        <div className="flex lg:hidden items-center justify-between px-4 py-4 border-b border-white/10">
          <span className="text-sm text-transcend-gold font-medium">Menu</span>
          <button onClick={() => setSidebarOpen(false)} className="text-white/60 hover:text-white p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`block px-3 py-2.5 rounded-brand text-sm font-medium transition-colors duration-brand ${
                      active
                        ? 'bg-transcend-gold/10 text-transcend-gold border-l-2 border-transcend-gold'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10">
          <Link href="/" className="text-xs text-white/40 hover:text-transcend-gold transition-colors">
            ← Back to Customer App
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-screen pt-14 px-4 pb-6 lg:pt-0 lg:ml-[220px] lg:p-8">
        {children}
      </main>
    </div>
  );
}
