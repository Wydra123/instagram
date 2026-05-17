'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, API_URL } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import PostCard, { Post } from '@/components/PostCard';

export default function FeedPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    if (user) fetchPosts();
  }, [user, fetchPosts]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="w-8 h-8 border-2 border-[#dbdbdb] border-t-[#0095f6] rounded-full animate-spin" />
      </div>
    );
  }

  function handleDelete(id: string) {
    setPosts((prev) => prev.filter((p) => p._id !== id));
  }

  function handleUpdate(updated: Post) {
    setPosts((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
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
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20 text-[#8e8e8e]">
            <p className="text-sm font-semibold text-[#262626]">Brak postów</p>
            <p className="text-xs">Nikt jeszcze nic nie opublikował.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {posts.map((post) => (
              <PostCard
                key={post._id}
                post={post}
                currentUserId={user.id}
                token={token!}
                onEdit={() => router.push('/profile')}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
