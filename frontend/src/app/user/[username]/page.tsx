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
}

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [username, user]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="w-8 h-8 border-2 border-[#dbdbdb] border-t-[#0095f6] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] [color-scheme:light]">
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
            <div className="bg-white border border-[#dbdbdb] rounded-xl p-8 mb-6 flex flex-col items-center gap-3 text-center">
              {profile.profilePicture ? (
                <img
                  src={profile.profilePicture.startsWith('http') ? profile.profilePicture : `${API_URL}${profile.profilePicture}`}
                  alt={profile.username}
                  className="w-24 h-24 rounded-full object-cover border-2 border-[#dbdbdb]"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-4xl font-bold border-2 border-[#dbdbdb]">
                  {profile.username[0].toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-[#262626] font-semibold text-lg">@{profile.username}</p>
                {profile.bio && (
                  <p className="text-sm text-[#737373] mt-1 max-w-xs">{profile.bio}</p>
                )}
              </div>
              <p className="text-xs text-[#8e8e8e]">{posts.length} {posts.length === 1 ? 'post' : 'posty/postów'}</p>
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
