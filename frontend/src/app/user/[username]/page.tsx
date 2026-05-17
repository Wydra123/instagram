'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth, API_URL } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import PostCard, { Post } from '@/components/PostCard';

interface PublicUser {
  _id: string;
  username: string;
  profilePicture: string;
  bio: string;
  followers: string[];
  following: string[];
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
        const [uRes, pRes] = await Promise.all([
          fetch(`${API_URL}/api/users/${username}`),
          fetch(`${API_URL}/api/posts/user/${username}`),
        ]);
        if (uRes.status === 404) { setNotFound(true); return; }
        const uData = await uRes.json();
        const pData = await pRes.json();
        setProfile(uData);
        setPosts(Array.isArray(pData) ? pData : []);
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
                      src={profile.profilePicture.startsWith('http') ? profile.profilePicture : `${API_URL}${profile.profilePicture}`}
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
