'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, API_URL } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import PostCard, { Post } from '@/components/PostCard';

function resolveUrl(url: string) {
  return url.startsWith('http') ? url : `${API_URL}${url}`;
}

function storyTimeLeft(createdAt: string): string {
  const ms = new Date(createdAt).getTime() + 24 * 3600 * 1000 - Date.now();
  if (ms <= 0) return 'Wygasło';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h` : `${m}m`;
}

interface Story {
  _id: string;
  image: string;
  caption: string;
  author: { _id: string; username: string; profilePicture: string };
  views: string[];
  createdAt: string;
}

interface AuthorGroup {
  author: { _id: string; username: string; profilePicture: string };
  stories: Story[];
}

interface SuggestedUser {
  _id: string;
  username: string;
  profilePicture: string;
  bio: string;
}

export default function FeedPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const [allStories, setAllStories] = useState<Story[]>([]);
  const [viewerStories, setViewerStories] = useState<Story[]>([]);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  const [viewerGroupIdx, setViewerGroupIdx] = useState<number | null>(null);
  const [spinningId, setSpinningId] = useState<string | null>(null);
  const [storyProgress, setStoryProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const advanceRef = useRef<() => void>(() => {});

  const [suggested, setSuggested] = useState<SuggestedUser[]>([]);
  const [, setFollowingIds] = useState<Set<string>>(new Set());
  const [followLoading, setFollowLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/posts`);
      const data = await res.json();
      setPosts(Array.isArray(data) ? data.filter((p: Post) => p.author._id !== user!.id) : []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchStories = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/stories`);
      const data = await res.json();
      const others = Array.isArray(data)
        ? data.filter((s: Story) => s.author._id !== user!.id)
        : [];
      setAllStories(others);
    } catch {
      setAllStories([]);
    }
  }, [user]);

  const fetchSuggested = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/users/suggestions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSuggested(Array.isArray(data) ? data : []);
    } catch {
      setSuggested([]);
    }
  }, [token]);

  useEffect(() => {
    if (user) { fetchPosts(); fetchStories(); fetchSuggested(); }
  }, [user, fetchPosts, fetchStories, fetchSuggested]);

  const grouped: AuthorGroup[] = allStories
    .reduce<AuthorGroup[]>((acc, story) => {
      const existing = acc.find((g) => g.author._id === story.author._id);
      if (existing) { existing.stories.push(story); }
      else { acc.push({ author: story.author, stories: [story] }); }
      return acc;
    }, [])
    .sort((a, b) => {
      const aViewed = a.stories.some((s) => s.views.includes(user!.id));
      const bViewed = b.stories.some((s) => s.views.includes(user!.id));
      if (aViewed === bViewed) return 0;
      return aViewed ? 1 : -1;
    });

  useEffect(() => {
    if (viewerIdx === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setViewerIdx(null); setViewerGroupIdx(null); }
      if (e.key === 'ArrowRight') advanceRef.current();
      if (e.key === 'ArrowLeft') setViewerIdx((i) => i !== null && i > 0 ? i - 1 : i);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewerIdx, viewerStories.length]);

  // Aktualizuj advanceRef przy każdym renderze żeby uniknąć stale closure
  advanceRef.current = () => {
    if (viewerIdx === null) return;
    if (viewerIdx < viewerStories.length - 1) {
      openViewer(viewerStories, viewerIdx + 1, viewerGroupIdx ?? undefined);
    } else if (viewerGroupIdx !== null && viewerGroupIdx < grouped.length - 1) {
      goToGroup(viewerGroupIdx + 1);
    } else {
      setViewerIdx(null);
      setViewerGroupIdx(null);
    }
  };

  // Timer 10s na story
  useEffect(() => {
    if (viewerIdx === null) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    setStoryProgress(0);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);

    const start = Date.now();
    const DURATION = 6000;

    intervalRef.current = setInterval(() => {
      setStoryProgress(Math.min(100, ((Date.now() - start) / DURATION) * 100));
    }, 50);

    timerRef.current = setTimeout(() => {
      clearInterval(intervalRef.current!);
      advanceRef.current();
    }, DURATION);

    return () => {
      clearTimeout(timerRef.current!);
      clearInterval(intervalRef.current!);
    };
  }, [viewerIdx, viewerGroupIdx]);

  async function openViewer(stories: Story[], idx: number, groupIdx?: number) {
    setViewerStories(stories);
    setViewerIdx(idx);
    if (groupIdx !== undefined) setViewerGroupIdx(groupIdx);
    if (!token) return;
    try {
      await fetch(`${API_URL}/api/stories/${stories[idx]._id}/view`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setAllStories((prev) =>
        prev.map((s) =>
          s._id === stories[idx]._id && !s.views.includes(user!.id)
            ? { ...s, views: [...s.views, user!.id] }
            : s
        )
      );
    } catch {}
  }

  function goToGroup(groupIdx: number) {
    const group = grouped[groupIdx];
    if (!group) return;
    openViewer(group.stories, 0, groupIdx);
  }

  function handleStoryClick(stories: Story[], authorId: string, groupIdx: number) {
    if (spinningId) return;
    setSpinningId(authorId);
    setTimeout(() => {
      setSpinningId(null);
      openViewer(stories, 0, groupIdx);
    }, 700);
  }

  async function handleFollow(targetId: string) {
    if (!token) return;
    setFollowLoading(targetId);
    try {
      const res = await fetch(`${API_URL}/api/users/${targetId}/follow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      if (data.following) {
        setFollowingIds((prev) => new Set([...prev, targetId]));
        setSuggested((prev) => prev.filter((u) => u._id !== targetId));
      }
    } catch {
    } finally {
      setFollowLoading(null);
    }
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="w-8 h-8 border-2 border-[#dbdbdb] border-t-[#0095f6] rounded-full animate-spin" />
      </div>
    );
  }

  const currentStory = viewerIdx !== null ? viewerStories[viewerIdx] : null;

  return (
    <div
      className="min-h-screen [color-scheme:light] bg-cover bg-center bg-fixed"
      style={{ backgroundImage: "url('/feed-bg.png')" }}
    >
      {/* Story viewer modal */}
      {viewerIdx !== null && currentStory && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setViewerIdx(null)}
        >
          {/* Strzałka poprzedni użytkownik */}
          {viewerGroupIdx !== null && viewerGroupIdx > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); goToGroup(viewerGroupIdx - 1); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 group"
            >
              <div className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </div>
              {(() => {
                const prev = grouped[viewerGroupIdx - 1];
                const prevAvatar = prev.author.profilePicture ? resolveUrl(prev.author.profilePicture) : null;
                return (
                  <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {prevAvatar
                      ? <img src={prevAvatar} alt="" className="w-8 h-8 rounded-full object-cover border border-white/30" />
                      : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-bold">{prev.author.username[0].toUpperCase()}</div>
                    }
                    <span className="text-white text-[10px] font-medium">{prev.author.username}</span>
                  </div>
                );
              })()}
            </button>
          )}

          {/* Strzałka następny użytkownik */}
          {viewerGroupIdx !== null && viewerGroupIdx < grouped.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goToGroup(viewerGroupIdx + 1); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 group"
            >
              <div className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
              {(() => {
                const next = grouped[viewerGroupIdx + 1];
                const nextAvatar = next.author.profilePicture ? resolveUrl(next.author.profilePicture) : null;
                return (
                  <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {nextAvatar
                      ? <img src={nextAvatar} alt="" className="w-8 h-8 rounded-full object-cover border border-white/30" />
                      : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-bold">{next.author.username[0].toUpperCase()}</div>
                    }
                    <span className="text-white text-[10px] font-medium">{next.author.username}</span>
                  </div>
                );
              })()}
            </button>
          )}

          <div
            className="relative flex flex-col items-center max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-1 w-full mb-2 px-1">
              {viewerStories.map((_, i) => (
                <div key={i} className="flex-1 h-0.5 rounded-full overflow-hidden bg-white/30">
                  <div
                    className="h-full bg-white"
                    style={{
                      width: i < viewerIdx! ? '100%'
                        : i === viewerIdx ? `${storyProgress}%`
                        : '0%',
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between w-full mb-3 px-1">
              <div className="flex items-center gap-2">
                {currentStory.author.profilePicture ? (
                  <img src={resolveUrl(currentStory.author.profilePicture)} alt="" className="w-8 h-8 rounded-full object-cover border border-white/30" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm font-bold">
                    {currentStory.author.username[0].toUpperCase()}
                  </div>
                )}
                <span className="text-white text-sm font-semibold">{currentStory.author.username}</span>
                <span className="text-white/60 text-xs">{storyTimeLeft(currentStory.createdAt)}</span>
              </div>
              <button onClick={() => setViewerIdx(null)} className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="relative w-full rounded-2xl overflow-hidden bg-black">
              <img src={resolveUrl(currentStory.image)} alt="" className="w-full object-contain max-h-[70vh]" />
              {currentStory.caption && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-4">
                  <p className="text-white text-sm leading-snug">{currentStory.caption}</p>
                </div>
              )}
              {viewerIdx > 0 && (
                <button onClick={() => openViewer(viewerStories, viewerIdx - 1)} className="absolute left-0 inset-y-0 w-1/4 flex items-center justify-start pl-2 group">
                  <div className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                  </div>
                </button>
              )}
              {viewerIdx < viewerStories.length - 1 && (
                <button onClick={() => openViewer(viewerStories, viewerIdx + 1)} className="absolute right-0 inset-y-0 w-1/4 flex items-center justify-end pr-2 group">
                  <div className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                  </div>
                </button>
              )}
            </div>
            {viewerStories.length > 1 && (
              <div className="w-full mt-3 px-1 flex justify-end">
                <span className="text-white/40 text-xs">{viewerIdx + 1} / {viewerStories.length}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <Navbar />

      {/* Sidebar — fixed po lewej */}
      {suggested.length > 0 && (
        <aside
          className="hidden lg:flex fixed top-24 z-10 justify-center items-start"
          style={{ left: 0, width: 'calc(50vw - 16rem)' }}
        >
          <div>
          <p className="text-xs font-semibold text-[#8e8e8e] uppercase tracking-wide mb-3">Sugestie dla Ciebie</p>
          <ul className="space-y-3">
            {suggested.map((u) => {
              const avatar = u.profilePicture ? resolveUrl(u.profilePicture) : null;
              return (
                <li key={u._id} className="flex items-center gap-3">
                  <Link href={`/user/${u.username}`} className="flex-shrink-0">
                    {avatar ? (
                      <img src={avatar} alt={u.username} className="w-9 h-9 rounded-full object-cover border border-[#dbdbdb]" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm font-bold">
                        {u.username[0].toUpperCase()}
                      </div>
                    )}
                  </Link>
                  <Link href={`/user/${u.username}`} className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#262626] truncate">{u.username}</p>
                    {u.bio && <p className="text-xs text-[#8e8e8e] truncate">{u.bio}</p>}
                  </Link>
                  <button
                    onClick={() => handleFollow(u._id)}
                    disabled={followLoading === u._id}
                    className="text-xs font-semibold text-[#0095f6] hover:text-[#00376b] disabled:opacity-50 flex-shrink-0 transition-colors"
                  >
                    {followLoading === u._id ? '...' : 'Obserwuj'}
                  </button>
                </li>
              );
            })}
          </ul>
          </div>
        </aside>
      )}

      <div className="max-w-lg mx-auto px-4 pt-6 pb-16">
        <div className="space-y-5">

            {/* Stories bar */}
            {grouped.length > 0 && (
              <div className="px-4 py-3">
                <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
                  {grouped.map(({ author, stories }, gIdx) => {
                    const anyViewed = stories.some((s) => s.views.includes(user.id));
                    const avatarSrc = author.profilePicture ? resolveUrl(author.profilePicture) : null;
                    return (
                      <button
                        key={author._id}
                        onClick={() => handleStoryClick(stories, author._id, gIdx)}
                        className="flex flex-col items-center gap-1.5 flex-shrink-0 focus:outline-none"
                        disabled={spinningId === author._id}
                      >
                        <div className="relative w-[92px] h-[92px] flex items-center justify-center">
                          {/* Kręcący się gradient ring */}
                          <div className={`absolute inset-0 rounded-full ${anyViewed ? 'bg-[#dbdbdb]' : 'bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]'} ${spinningId === author._id ? 'animate-spin' : ''}`} />
                          {/* Biała przerwa */}
                          <div className="absolute inset-[4px] rounded-full bg-white" />
                          {/* Avatar — statyczny */}
                          <div className="absolute inset-[6px] rounded-full overflow-hidden">
                            {avatarSrc ? (
                              <img src={avatarSrc} alt={author.username} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xl font-bold">
                                {author.username[0].toUpperCase()}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="text-[11px] text-[#262626] font-medium w-16 text-center truncate">{author.username}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Feed */}
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 border-2 border-[#dbdbdb] border-t-[#0095f6] rounded-full animate-spin" />
              </div>
            ) : posts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-20 text-[#8e8e8e]">
                <p className="text-sm font-semibold text-[#262626]">Brak postów</p>
                <p className="text-xs">Nikt jeszcze nic nie opublikował.</p>
              </div>
            ) : (
              posts.map((post) => (
                <PostCard
                  key={post._id}
                  post={post}
                  currentUserId={user.id}
                  token={token!}
                  onEdit={() => router.push('/profile')}
                  onDelete={(id) => setPosts((prev) => prev.filter((p) => p._id !== id))}
                  onUpdate={(updated) => setPosts((prev) => prev.map((p) => p._id === updated._id ? updated : p))}
                />
              ))
            )}
        </div>
      </div>
    </div>
  );
}

