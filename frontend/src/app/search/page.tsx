'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, API_URL } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';

function resolveUrl(url: string) {
  return url.startsWith('http') ? url : `${API_URL}${url}`;
}

interface UserResult {
  _id: string;
  username: string;
  profilePicture: string;
  bio: string;
}

export default function SearchPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`${API_URL}/api/users/search?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, token]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="w-8 h-8 border-2 border-[#dbdbdb] border-t-[#0095f6] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen [color-scheme:light] bg-cover bg-center bg-fixed"
      style={{ backgroundImage: "url('/feed-bg.png')" }}
    >
      <Navbar />
      <main className="max-w-lg mx-auto px-4 pt-10 pb-16">

        {/* Pole wyszukiwania */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-[#8e8e8e]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj użytkowników..."
            autoFocus
            className="w-full bg-white border border-[#dbdbdb] rounded-xl pl-11 pr-10 py-3 text-sm text-[#262626] placeholder:text-[#8e8e8e] focus:outline-none focus:border-[#a8a8a8] shadow-sm"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute inset-y-0 right-4 flex items-center text-[#8e8e8e] hover:text-[#262626] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Wyniki */}
        {searching ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-2 border-[#dbdbdb] border-t-[#0095f6] rounded-full animate-spin" />
          </div>
        ) : results.length > 0 ? (
          <ul className="space-y-1">
            {results.map((u) => {
              const avatar = u.profilePicture ? resolveUrl(u.profilePicture) : null;
              return (
                <li key={u._id}>
                  <Link
                    href={`/user/${u.username}`}
                    className="flex items-center gap-4 px-4 py-3 bg-white/70 hover:bg-white rounded-xl transition-colors border border-transparent hover:border-[#dbdbdb]"
                  >
                    {avatar ? (
                      <img src={avatar} alt={u.username} className="w-12 h-12 rounded-full object-cover border border-[#dbdbdb] flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                        {u.username[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#262626]">{u.username}</p>
                      {u.bio && <p className="text-xs text-[#8e8e8e] truncate">{u.bio}</p>}
                    </div>
                    <svg className="w-4 h-4 text-[#c7c7c7] ml-auto flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : query.trim() ? (
          <div className="flex flex-col items-center gap-2 py-16 text-[#8e8e8e]">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <p className="text-sm font-semibold text-[#262626]">Brak wyników</p>
            <p className="text-xs">Nie znaleziono użytkownika „{query.trim()}"</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-16 text-[#8e8e8e]">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <p className="text-sm">Wpisz nazwę użytkownika</p>
          </div>
        )}
      </main>
    </div>
  );
}
