'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

  function isActive(href: string) {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  }

  return (
    <div className="flex min-h-screen bg-[#1a1a1a] text-white">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 h-screen w-[250px] bg-transcend-black flex flex-col border-r border-white/10">
        {/* Logo */}
        <div className="flex items-center justify-center px-6 py-6 border-b border-white/10">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/logo-transcend.webp"
              alt="Transcend Health Mallorca"
              className="h-10 w-auto"
            />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block px-4 py-3 rounded-brand text-sm font-medium transition-colors duration-brand ${
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
        <div className="px-6 py-4 border-t border-white/10">
          <p className="text-xs text-white/40">Admin Panel</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-[250px] flex-1 min-h-screen p-8">
        {children}
      </main>
    </div>
  );
}
