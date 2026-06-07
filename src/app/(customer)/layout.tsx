"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function TranscendLogo() {
  return (
    <Image
      src="/logo-transcend.webp"
      alt="Transcend Health Mallorca"
      width={140}
      height={40}
      className="h-8 w-auto sm:h-10"
      style={{ width: 'auto', height: 'auto' }}
      priority
    />
  );
}

const navItems = [
  {
    label: "Services",
    href: "/",
    icon: (active: boolean) => (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? "#C9984A" : "currentColor"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    label: "Bookings",
    href: "/bookings",
    icon: (active: boolean) => (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? "#C9984A" : "currentColor"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    label: "Account",
    href: "/login",
    icon: (active: boolean) => (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? "#C9984A" : "currentColor"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setIsLoggedIn(true);
        // Fetch role from dedicated endpoint with user ID
        fetch('/api/auth/role?userId=' + session.user.id)
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data?.role === 'admin') setIsAdmin(true);
          })
          .catch(() => {});
      }
    });
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/" || pathname.startsWith("/services");
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="flex min-h-screen flex-col bg-transcend-off-white text-transcend-brown">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-transcend-khaki/20 bg-transcend-off-white/95 px-4 backdrop-blur-sm sm:h-16">
        <div className="w-16" />
        <Link href="/" aria-label="Home">
          <TranscendLogo />
        </Link>
        <div className="w-16 flex justify-end">
          {isLoggedIn && (
            <button
              onClick={handleLogout}
              className="text-xs text-transcend-brown/60 hover:text-transcend-brown transition-colors"
              aria-label="Log out"
            >
              Logout
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-20 sm:pb-24">
        {children}
      </main>

      {/* Fixed Bottom Navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-transcend-khaki/20 bg-transcend-off-white/95 backdrop-blur-sm"
        aria-label="Main navigation"
      >
        <ul className="mx-auto flex h-16 max-w-md items-center justify-around px-4 sm:h-18">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={`flex flex-col items-center gap-1 px-3 py-2 transition-colors duration-brand ${
                    active
                      ? "text-transcend-gold"
                      : "text-transcend-brown/60 hover:text-transcend-brown"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.icon(active)}
                  <span className="text-xs font-medium">{item.label}</span>
                </Link>
              </li>
            );
          })}
          {isAdmin && (
            <li>
              <Link
                href="/admin"
                className="flex flex-col items-center gap-1 px-3 py-2 text-transcend-brown/60 hover:text-transcend-brown transition-colors duration-brand"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-xs font-medium">Admin</span>
              </Link>
            </li>
          )}
        </ul>
      </nav>
    </div>
  );
}
