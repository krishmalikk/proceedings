'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/search', label: 'Case Search', icon: 'search' },
  { href: '/news', label: 'News', icon: 'newspaper' },
  { href: '/community', label: 'Forum', icon: 'forum' },
  { href: '/ask', label: 'Ask AI', icon: 'smart_toy' },
  { href: '/pro', label: 'Ask a Pro', icon: 'support_agent' },
];

export default function TopAppBar() {
  const pathname = usePathname();

  return (
    <header className="bg-surface sticky top-0 z-50 border-b border-outline-variant">
      <div className="flex justify-between items-center w-full px-4 md:px-margin-desktop h-16 max-w-7xl mx-auto">
        {/* Logo */}
        <Link
          href="/"
          className="text-headline-md font-bold text-primary hover:opacity-80 transition-opacity"
        >
          Proceedings
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex gap-6 items-center">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-label-md font-medium transition-colors ${
                  isActive
                    ? 'text-primary border-b-2 border-primary pb-1'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Menu */}
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-full hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-primary text-[28px]">
              account_circle
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
