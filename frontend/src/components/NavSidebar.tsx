'use client';

import Link from 'next/link';
import { useAuth, API_URL } from '@/context/AuthContext';

function resolveUrl(url: string) {
  return url.startsWith('http') ? url : `${API_URL}${url}`;
}

const SearchIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
  </svg>
);

const HomeIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const ChatIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const navItems = [
  { href: '/search', label: 'Wyszukaj', Icon: SearchIcon },
  { href: '/', label: 'Strona główna', Icon: HomeIcon },
  { href: '/chat', label: 'Czat', Icon: ChatIcon },
];

export default function NavSidebar() {
  const { user } = useAuth();
  if (!user) return null;

  const avatarSrc = user.profilePicture ? resolveUrl(user.profilePicture) : null;

  return (
    <nav className="fixed right-0 inset-y-0 z-40 flex flex-col justify-center py-8 pointer-events-none">
      <div
        className="pointer-events-auto flex flex-col rounded-l-2xl overflow-hidden
          bg-white/20 backdrop-blur-md
          w-[68px] hover:w-52 transition-[width] duration-300 ease-in-out group"
      >
        {/* Główne linki */}
        <div className="flex flex-col flex-1 justify-center">
          {navItems.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-end gap-3 px-4 py-4 text-[#8e8e8e] hover:bg-white/20 transition-colors"
            >
              <span className="text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 text-[#8e8e8e]">
                {label}
              </span>
              <span className="flex-shrink-0">
                <Icon />
              </span>
            </Link>
          ))}
        </div>

        {/* Profil na dole */}
        <div className="border-t border-white/20">
          <Link
            href="/profile"
            className="flex items-center justify-end gap-3 px-4 py-4 text-[#8e8e8e] hover:bg-white/20 transition-colors"
          >
            <span className="text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 text-[#8e8e8e]">
              {user.username}
            </span>
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={user.username}
                className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-white/40"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-[#8e8e8e] text-xs font-bold flex-shrink-0">
                {user.username[0].toUpperCase()}
              </div>
            )}
          </Link>
        </div>
      </div>
    </nav>
  );
}
