'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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

interface PublicUser {
  _id: string;
  username: string;
  profilePicture: string;
  bio: string;
  followers: string[];
  following: string[];
}

interface Story {
  _id: string;
  image: string;
  caption: string;
  author: { _id: string; username: string; profilePicture: string };
  views: string[];
  createdAt: string;
}

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);

  const [stories, setStories] = useState<Story[]>([]);
  const [viewingStoryIdx, setViewingStoryIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!username || !user) return;
    if (username === user.username) { router.replace('/profile'); return; }

    async function load() {
      setLoading(true);
      setNotFound(false);
      try {
        const [uRes, pRes, sRes] = await Promise.all([
          fetch(`${API_URL}/api/users/${username}`),
          fetch(`${API_URL}/api/posts/user/${username}`),
          fetch(`${API_URL}/api/stories/user/${username}`),
        ]);
        if (uRes.status === 404) { setNotFound(true); return; }
        const uData = await uRes.json();
        const pData = await pRes.json();
        const sData = await sRes.json();
        setProfile(uData);
        setPosts(Array.isArray(pData) ? pData : []);
        setStories(Array.isArray(sData) ? sData : []);
        setFollowersCount(uData.followers?.length ?? 0);
        setIsFollowing(uData.followers?.some((id: string) => id === user!.id) ?? false);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [username, user]);

  useEffect(() => {
    if (viewingStoryIdx === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setViewingStoryIdx(null);
      if (e.key === 'ArrowRight') setViewingStoryIdx((i) => i !== null && i < stories.length - 1 ? i + 1 : i);
      if (e.key === 'ArrowLeft') setViewingStoryIdx((i) => i !== null && i > 0 ? i - 1 : i);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewingStoryIdx, stories.length]);

  async function openStory(idx: number) {
    setViewingStoryIdx(idx);
    const story = stories[idx];
    if (!story || !token) return;
    try {
      await fetch(`${API_URL}/api/stories/${story._id}/view`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
  }

  async function handleFollow() {
    if (!profile || !token) return;
    setFollowLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${profile._id}/follow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setIsFollowing(data.following);
      setFollowersCount(data.followersCount);
    } catch {
    } finally {
      setFollowLoading(false);
    }
  }

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
      {/* Story viewer modal */}
      {viewingStoryIdx !== null && stories[viewingStoryIdx] && profile && (() => {
        const story = stories[viewingStoryIdx];
        const hasPrev = viewingStoryIdx > 0;
        const hasNext = viewingStoryIdx < stories.length - 1;
        const avatarSrc = profile.profilePicture ? resolveUrl(profile.profilePicture) : null;
        return (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={() => setViewingStoryIdx(null)}
          >
            <div
              className="relative flex flex-col items-center max-w-sm w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Progress bars */}
              {stories.length > 1 && (
                <div className="flex gap-1 w-full mb-2 px-1">
                  {stories.map((_, i) => (
                    <div key={i} className="flex-1 h-0.5 rounded-full overflow-hidden bg-white/30">
                      <div className={`h-full bg-white transition-all ${i <= viewingStoryIdx ? 'w-full' : 'w-0'}`} />
                    </div>
                  ))}
                </div>
              )}

              {/* Top bar */}
              <div className="flex items-center justify-between w-full mb-3 px-1">
                <div className="flex items-center gap-2">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="" className="w-8 h-8 rounded-full object-cover border border-white/30" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm font-bold">
                      {profile.username[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-white text-sm font-semibold">{profile.username}</span>
                  <span className="text-white/60 text-xs">{storyTimeLeft(story.createdAt)}</span>
                </div>
                <button
                  onClick={() => setViewingStoryIdx(null)}
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
                  src={resolveUrl(story.image)}
                  alt=""
                  className="w-full object-contain max-h-[70vh]"
                />

                {/* Caption overlay */}
                {story.caption && (
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-4">
                    <p className="text-white text-sm leading-snug">{story.caption}</p>
                  </div>
                )}

                {/* Left nav */}
                {hasPrev && (
                  <button
                    onClick={() => openStory(viewingStoryIdx - 1)}
                    className="absolute left-0 inset-y-0 w-1/4 flex items-center justify-start pl-2 group"
                    aria-label="Poprzednie"
                  >
                    <div className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                      </svg>
                    </div>
                  </button>
                )}

                {/* Right nav */}
                {hasNext && (
                  <button
                    onClick={() => openStory(viewingStoryIdx + 1)}
                    className="absolute right-0 inset-y-0 w-1/4 flex items-center justify-end pr-2 group"
                    aria-label="Następne"
                  >
                    <div className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </div>
                  </button>
                )}
              </div>

              {/* Bottom info */}
              {stories.length > 1 && (
                <div className="w-full mt-3 px-1 flex justify-end">
                  <span className="text-white/40 text-xs">{viewingStoryIdx + 1} / {stories.length}</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <Navbar />
      <main className="max-w-lg mx-auto px-4 pt-8 pb-16">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#dbdbdb] border-t-[#0095f6] rounded-full animate-spin" />
          </div>
        ) : notFound ? (
          <div className="flex flex-col items-center gap-2 py-20 text-[#8e8e8e]">
            <p className="text-sm font-semibold text-[#262626]">Nie znaleziono użytkownika</p>
            <p className="text-xs">@{username} nie istnieje.</p>
          </div>
        ) : profile && (
          <>
            {/* Karta profilu */}
            <div className="bg-white border border-[#dbdbdb] rounded-xl p-8 mb-6">
              <div className="flex items-center gap-8">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {profile.profilePicture ? (
                    <img
                      src={resolveUrl(profile.profilePicture)}
                      alt={profile.username}
                      className="w-24 h-24 rounded-full object-cover border-2 border-[#dbdbdb]"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-3xl font-bold border-2 border-[#dbdbdb]">
                      {profile.username[0].toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <h1 className="text-xl font-semibold text-[#262626]">{profile.username}</h1>
                    <button
                      onClick={handleFollow}
                      disabled={followLoading}
                      className={`px-5 py-1.5 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 ${
                        isFollowing
                          ? 'border border-[#dbdbdb] text-[#262626] hover:bg-[#fafafa]'
                          : 'bg-[#0095f6] text-white hover:bg-[#1877f2]'
                      }`}
                    >
                      {followLoading ? '...' : isFollowing ? 'Obserwujesz' : 'Obserwuj'}
                    </button>
                  </div>

                  {/* Statystyki */}
                  <div className="flex gap-6 mb-3">
                    <div className="text-center">
                      <span className="text-sm font-semibold text-[#262626]">{posts.length}</span>
                      <p className="text-xs text-[#8e8e8e]">postów</p>
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-semibold text-[#262626]">{followersCount}</span>
                      <p className="text-xs text-[#8e8e8e]">obserwujących</p>
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-semibold text-[#262626]">{profile.following?.length ?? 0}</span>
                      <p className="text-xs text-[#8e8e8e]">obserwowanych</p>
                    </div>
                  </div>

                  {/* Bio */}
                  {profile.bio && (
                    <p className="text-sm text-[#262626] whitespace-pre-wrap">{profile.bio}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Stories */}
            {stories.length > 0 && (
              <div className="bg-white border border-[#dbdbdb] rounded-xl p-5 mb-6">
                <h2 className="text-[#262626] font-semibold text-sm mb-1">
                  Stories <span className="text-[#8e8e8e] font-normal">({stories.length})</span>
                </h2>
                <div className="flex flex-wrap gap-x-5 gap-y-7 pt-3 pl-3 pb-7">
                  {stories.map((story, idx) => (
                    <div key={story._id} className="relative">
                      <button
                        onClick={() => openStory(idx)}
                        className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-[#0095f6] ring-offset-2 block focus:outline-none cursor-pointer"
                      >
                        <img src={resolveUrl(story.image)} alt="" className="w-full h-full object-cover" />
                      </button>
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-black/70 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full pointer-events-none">
                        {storyTimeLeft(story.createdAt)}
                      </span>
                      {story.caption && (
                        <p className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-[#8e8e8e] whitespace-nowrap max-w-[80px] truncate">
                          {story.caption}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Posty */}
            {posts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-[#8e8e8e]">
                <p className="text-sm">Brak postów.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {posts.map((post) => (
                  <PostCard
                    key={post._id}
                    post={post}
                    currentUserId={user.id}
                    token={token!}
                    onEdit={() => {}}
                    onDelete={(id) => setPosts((prev) => prev.filter((p) => p._id !== id))}
                    onUpdate={(updated) => setPosts((prev) => prev.map((p) => p._id === updated._id ? updated : p))}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
