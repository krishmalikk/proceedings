'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { USER_KEY } from '@/lib/activeUser';

const navItems = [
  { href: '/search', label: 'Case Search', icon: 'search' },
  { href: '/find', label: 'Find Peers', icon: 'diversity_3' },
  { href: '/news', label: 'News', icon: 'newspaper' },
  // Removed for now (phase-H): 'Forum' (/community) and 'Ask a Pro' (/pro).
];

export default function TopAppBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // Dev-mode impersonation (demo-user picker) — read directly from localStorage,
  // re-checked on navigation, so posting stays available without Firebase login.
  const [devUid, setDevUid] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined') setDevUid(localStorage.getItem(USER_KEY) || '');
  }, [pathname]);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      setShowUserMenu(false);
      router.push('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

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

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Post button — shown for Firebase users AND dev-mode (demo picker) users */}
          {(user || devUid) && (
            <Link
              href="/post"
              className="btn-primary flex items-center gap-1.5 rounded-full text-label-md"
            >
              <span className="material-symbols-outlined text-[20px]">edit_square</span>
              <span className="hidden sm:inline">Post a new message</span>
              <span className="sm:hidden">Post</span>
            </Link>
          )}

          {/* Auth section */}
          {loading ? (
            <div className="w-10 h-10 flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
            </div>
          ) : user ? (
            /* User menu */
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="p-2 rounded-full hover:bg-surface-container transition-colors flex items-center gap-2"
                aria-label="User menu"
              >
                <span className="material-symbols-outlined text-primary text-[28px]">
                  account_circle
                </span>
              </button>

              {/* Dropdown menu */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant py-2 z-50">
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-outline-variant">
                    <p className="text-label-md font-medium text-on-surface truncate">
                      {user.displayName || 'User'}
                    </p>
                    <p className="text-caption text-on-surface-variant truncate">
                      {user.email}
                    </p>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <Link
                      href="/profile"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-low transition-colors"
                    >
                      <span className="material-symbols-outlined text-xl text-on-surface-variant">
                        person
                      </span>
                      My Profile
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-low transition-colors"
                    >
                      <span className="material-symbols-outlined text-xl text-on-surface-variant">
                        logout
                      </span>
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Login button */
            <Link
              href="/login"
              className="btn-secondary flex items-center gap-1.5 rounded-full text-label-md"
            >
              <span className="material-symbols-outlined text-[20px]">login</span>
              <span>Sign in</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
