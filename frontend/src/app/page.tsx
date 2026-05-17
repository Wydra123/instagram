'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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

export default function FeedPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const [allStories, setAllStories] = useState<Story[]>([]);
  const [viewerStories, setViewerStories] = useState<Story[]>([]);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);

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

  useEffect(() => {
    if (user) { fetchPosts(); fetchStories(); }
  }, [user, fetchPosts, fetchStories]);

  // Group stories by author, preserving order of first appearance
  const grouped: AuthorGroup[] = allStories.reduce<AuthorGroup[]>((acc, story) => {
    const existing = acc.find((g) => g.author._id === story.author._id);
    if (existing) { existing.stories.push(story); }
    else { acc.push({ author: story.author, stories: [story] }); }
    return acc;
  }, []);

  useEffect(() => {
    if (viewerIdx === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setViewerIdx(null);
      if (e.key === 'ArrowRight') setViewerIdx((i) => i !== null && i < viewerStories.length - 1 ? i + 1 : i);
      if (e.key === 'ArrowLeft') setViewerIdx((i) => i !== null && i > 0 ? i - 1 : i);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewerIdx, viewerStories.length]);

  async function openViewer(stories: Story[], idx: number) {
    setViewerStories(stories);
    setViewerIdx(idx);
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
          <div
            className="relative flex flex-col items-center max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Progress bars */}
            {viewerStories.length > 1 && (
              <div className="flex gap-1 w-full mb-2 px-1">
                {viewerStories.map((_, i) => (
                  <div key={i} className="flex-1 h-0.5 rounded-full overflow-hidden bg-white/30">
                    <div className={`h-full bg-white ${i <= viewerIdx ? 'w-full' : 'w-0'}`} />
                  </div>
                ))}
              </div>
            )}

            {/* Top bar */}
            <div className="flex items-center justify-between w-full mb-3 px-1">
              <div className="flex items-center gap-2">
                {currentStory.author.profilePicture ? (
                  <img
                    src={resolveUrl(currentStory.author.profilePicture)}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover border border-white/30"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm font-bold">
                    {currentStory.author.username[0].toUpperCase()}
                  </div>
                )}
                <span className="text-white text-sm font-semibold">{currentStory.author.username}</span>
                <span className="text-white/60 text-xs">{storyTimeLeft(currentStory.createdAt)}</span>
              </div>
              <button
                onClick={() => setViewerIdx(null)}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Image */}
            <div className="relative w-full rounded-2xl overflow-hidden bg-black">
              <img
                src={resolveUrl(currentStory.image)}
                alt=""
                className="w-full object-contain max-h-[70vh]"
              />
              {currentStory.caption && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-4">
                  <p className="text-white text-sm leading-snug">{currentStory.caption}</p>
                </div>
              )}
              {viewerIdx > 0 && (
                <button
                  onClick={() => openViewer(viewerStories, viewerIdx - 1)}
                  className="absolute left-0 inset-y-0 w-1/4 flex items-center justify-start pl-2 group"
                >
                  <div className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                  </div>
                </button>
              )}
              {viewerIdx < viewerStories.length - 1 && (
                <button
                  onClick={() => openViewer(viewerStories, viewerIdx + 1)}
                  className="absolute right-0 inset-y-0 w-1/4 flex items-center justify-end pr-2 group"
                >
                  <div className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
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

      <main className="max-w-lg mx-auto px-4 pt-6 pb-16 space-y-5">

        {/* Stories bar */}
        {grouped.length > 0 && (
          <div className="bg-white border border-[#dbdbdb] rounded-xl px-4 py-3">
            <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
              {grouped.map(({ author, stories }) => {
                const allViewed = stories.every((s) => s.views.includes(user.id));
                const avatarSrc = author.profilePicture ? resolveUrl(author.profilePicture) : null;
                return (
                  <button
                    key={author._id}
                    onClick={() => openViewer(stories, 0)}
                    className="flex flex-col items-center gap-1.5 flex-shrink-0 focus:outline-none"
                  >
                    <div className={`p-0.5 rounded-full ${allViewed ? 'bg-[#dbdbdb]' : 'bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]'}`}>
                      <div className="p-0.5 bg-white rounded-full">
                        {avatarSrc ? (
                          <img src={avatarSrc} alt={author.username} className="w-14 h-14 rounded-full object-cover" />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xl font-bold">
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
      </main>
    </div>
  );
}
