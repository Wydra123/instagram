'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="w-8 h-8 border-2 border-[#dbdbdb] border-t-[#0095f6] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#fafafa] [color-scheme:light]">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 pt-8">
        <div className="flex flex-col items-center text-center gap-2 py-16 text-[#737373]">
          <p className="text-lg font-semibold text-[#262626]">Witaj, {user.username}!</p>
          <p className="text-sm">Feed jest w trakcie budowy.</p>
        </div>
      </main>
    </div>
  );
}
