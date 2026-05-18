'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, API_URL } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';

function resolveUrl(url: string) {
  return url.startsWith('http') ? url : `${API_URL}${url}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'teraz';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

interface Participant {
  _id: string;
  username: string;
  profilePicture: string;
}

interface Conversation {
  _id: string;
  participants: Participant[];
  lastMessage: { content: string; sender: string; createdAt: string } | null;
  updatedAt: string;
}

export default function ChatPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/conversations`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setConversations(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

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
      <main className="max-w-lg mx-auto px-4 pt-8 pb-16">
        <h1 className="text-xl font-semibold text-[#262626] mb-6">Wiadomości</h1>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-2 border-[#dbdbdb] border-t-[#0095f6] rounded-full animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-[#8e8e8e]">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm font-semibold text-[#262626]">Brak wiadomości</p>
            <p className="text-xs">Wejdź na profil użytkownika i zacznij czat</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {conversations.map((conv) => {
              const other = conv.participants.find((p) => p._id !== user.id);
              if (!other) return null;
              const avatar = other.profilePicture ? resolveUrl(other.profilePicture) : null;
              return (
                <li key={conv._id}>
                  <Link
                    href={`/chat/${conv._id}`}
                    className="flex items-center gap-4 px-4 py-3 bg-white/70 hover:bg-white rounded-xl transition-colors border border-transparent hover:border-[#dbdbdb]"
                  >
                    {avatar ? (
                      <img src={avatar} alt={other.username} className="w-12 h-12 rounded-full object-cover border border-[#dbdbdb] flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                        {other.username[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#262626]">{other.username}</p>
                      {conv.lastMessage ? (
                        <p className="text-xs text-[#8e8e8e] truncate">{conv.lastMessage.content}</p>
                      ) : (
                        <p className="text-xs text-[#8e8e8e] italic">Brak wiadomości</p>
                      )}
                    </div>
                    {conv.lastMessage && (
                      <span className="text-xs text-[#8e8e8e] flex-shrink-0">{timeAgo(conv.lastMessage.createdAt)}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
