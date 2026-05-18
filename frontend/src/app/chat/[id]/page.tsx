'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, API_URL } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';

function resolveUrl(url: string) {
  return url.startsWith('http') ? url : `${API_URL}${url}`;
}

function timeLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const isToday = d.toDateString() === new Date().toDateString();
  if (isToday) return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

interface Participant {
  _id: string;
  username: string;
  profilePicture: string;
}

interface Message {
  _id: string;
  sender: Participant;
  content: string;
  readBy: string[];
  createdAt: string;
}

interface Conversation {
  _id: string;
  participants: Participant[];
}

export default function ChatConversationPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const latestMsgId = useRef<string | null>(null);
  const firstLoadDone = useRef(false);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  // Reset state when conversation changes
  useEffect(() => {
    latestMsgId.current = null;
    firstLoadDone.current = false;
    setMessages([]);
    setLoading(true);
  }, [id]);

  function scrollToBottom(smooth: boolean) {
    const el = messagesContainerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
      if (smooth) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      } else {
        el.scrollTop = el.scrollHeight;
      }
    });
  }

  const fetchMessages = useCallback(async () => {
    if (!token || !id) return;
    const res = await fetch(`${API_URL}/api/conversations/${id}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!Array.isArray(data)) return;
    setMessages((prev) => {
      const lastNew = data[data.length - 1]?._id ?? null;
      if (lastNew !== latestMsgId.current) {
        latestMsgId.current = lastNew;
        return data;
      }
      return prev;
    });
  }, [token, id]);

  useEffect(() => {
    if (!token || !id) return;
    async function init() {
      try {
        const [convRes] = await Promise.all([
          fetch(`${API_URL}/api/conversations`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/api/conversations/${id}/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const convList = await convRes.json();
        const conv = Array.isArray(convList) ? convList.find((c: Conversation) => c._id === id) : null;
        setConversation(conv ?? null);
        await fetchMessages();
      } catch {
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [token, id, fetchMessages]);

  // After initial load: jump to bottom instantly
  useEffect(() => {
    if (loading || firstLoadDone.current) return;
    firstLoadDone.current = true;
    scrollToBottom(false);
  }, [loading, messages]);

  // On new messages during polling: smooth scroll
  useEffect(() => {
    if (!firstLoadDone.current) return;
    scrollToBottom(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    if (!token || !id) return;
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [fetchMessages, token, id]);

  async function send() {
    if (!input.trim() || !token || sending) return;
    setSending(true);
    const content = input.trim();
    setInput('');
    try {
      const res = await fetch(`${API_URL}/api/conversations/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content }),
      });
      const msg = await res.json();
      if (res.ok) {
        setMessages((prev) => [...prev, msg]);
        latestMsgId.current = msg._id;
      }
    } catch {
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="w-8 h-8 border-2 border-[#dbdbdb] border-t-[#0095f6] rounded-full animate-spin" />
      </div>
    );
  }

  const other = conversation?.participants.find((p) => p._id !== user.id);

  return (
    <div
      className="[color-scheme:light] bg-cover bg-center bg-fixed flex flex-col overflow-hidden"
      style={{ backgroundImage: "url('/feed-bg.png')", height: '100dvh' }}
    >
      <Navbar />

      <div className="flex-1 flex flex-col max-w-lg w-full mx-auto px-4 py-4 min-h-0">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-white/40 flex-shrink-0">
          <Link href="/chat" className="text-[#8e8e8e] hover:text-[#262626] transition-colors p-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          {other ? (
            <>
              {other.profilePicture ? (
                <img src={resolveUrl(other.profilePicture)} alt={other.username} className="w-9 h-9 rounded-full object-cover border border-[#dbdbdb] flex-shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {other.username[0].toUpperCase()}
                </div>
              )}
              <Link href={`/user/${other.username}`} className="text-sm font-semibold text-[#262626] hover:underline">
                {other.username}
              </Link>
            </>
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#dbdbdb] flex-shrink-0" />
          )}
        </div>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto py-4 space-y-2 min-h-0"
        >
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-7 h-7 border-2 border-[#dbdbdb] border-t-[#0095f6] rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-[#8e8e8e]">
              <p className="text-sm">Brak wiadomości. Napisz pierwszą!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender._id === user.id;
              return (
                <div key={msg._id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                  {!isMine && (
                    <div className="flex-shrink-0">
                      {msg.sender.profilePicture ? (
                        <img src={resolveUrl(msg.sender.profilePicture)} alt="" className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-bold">
                          {msg.sender.username[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="max-w-[70%] group">
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm leading-snug ${
                        isMine
                          ? 'bg-[#0095f6] text-white rounded-br-sm'
                          : 'bg-white text-[#262626] rounded-bl-sm border border-[#dbdbdb]'
                      }`}
                    >
                      {msg.content}
                    </div>
                    <p className={`text-[10px] text-[#8e8e8e] mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isMine ? 'text-right' : 'text-left'}`}>
                      {timeLabel(msg.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input */}
        <div className="flex items-center gap-3 pt-3 border-t border-white/40 flex-shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Napisz wiadomość..."
            className="flex-1 bg-white border border-[#dbdbdb] rounded-full px-4 py-2.5 text-sm text-[#262626] placeholder:text-[#8e8e8e] focus:outline-none focus:border-[#a8a8a8] shadow-sm"
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="text-[#0095f6] font-semibold text-sm disabled:opacity-40 hover:text-[#1877f2] transition-colors px-1 flex-shrink-0"
          >
            Wyślij
          </button>
        </div>
      </div>
    </div>
  );
}
