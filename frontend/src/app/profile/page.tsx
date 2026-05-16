'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, API_URL } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';

export default function ProfilePage() {
  const { user, token, isLoading, updateUser } = useAuth();
  const router = useRouter();

  const [bio, setBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) setBio(user.bio || '');
  }, [user]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="w-8 h-8 border-2 border-[#dbdbdb] border-t-[#0095f6] rounded-full animate-spin" />
      </div>
    );
  }

  const avatarSrc = user.profilePicture ? `${API_URL}${user.profilePicture}` : null;

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const res = await fetch(`${API_URL}/api/users/me/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      updateUser({ profilePicture: data.profilePicture });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd przesyłania');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSaveBio(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaveMsg('');
    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/users/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bio }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      updateUser({ bio: data.bio });
      setSaveMsg('Zapisano!');
      setTimeout(() => setSaveMsg(''), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd zapisu');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fafafa] [color-scheme:light]">
      <Navbar />

      <main className="max-w-xl mx-auto px-4 pt-10 pb-16">
        <div className="bg-white border border-[#dbdbdb] rounded-xl p-8">

          {/* Avatar */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="relative group">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={user.username}
                  className="w-28 h-28 rounded-full object-cover border-2 border-[#dbdbdb]"
                />
              ) : (
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-4xl font-bold border-2 border-[#dbdbdb]">
                  {user.username[0].toUpperCase()}
                </div>
              )}

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                aria-label="Zmień zdjęcie profilowe"
              >
                {isUploading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                )}
              </button>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="text-sm text-[#0095f6] font-semibold hover:text-[#00376b] disabled:opacity-50 transition-colors"
            >
              {isUploading ? 'Przesyłanie...' : 'Zmień zdjęcie profilowe'}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          {/* Info */}
          <div className="space-y-4 mb-6">
            <div>
              <p className="text-xs text-[#8e8e8e] mb-1 font-medium uppercase tracking-wide">Nazwa użytkownika</p>
              <p className="text-[#262626] font-semibold text-base">{user.username}</p>
            </div>
            <div>
              <p className="text-xs text-[#8e8e8e] mb-1 font-medium uppercase tracking-wide">Email</p>
              <p className="text-[#262626] text-sm">{user.email}</p>
            </div>
          </div>

          <div className="h-px bg-[#dbdbdb] mb-6" />

          {/* Bio */}
          <form onSubmit={handleSaveBio} className="space-y-3">
            <div>
              <label className="text-xs text-[#8e8e8e] font-medium uppercase tracking-wide block mb-1">
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={150}
                rows={3}
                placeholder="Napisz coś o sobie..."
                className="w-full bg-[#fafafa] border border-[#dbdbdb] rounded-lg text-sm text-[#262626] placeholder:text-[#8e8e8e] px-3 py-2 resize-none focus:outline-none focus:border-[#a8a8a8]"
              />
              <p className="text-right text-xs text-[#8e8e8e] mt-1">{bio.length}/150</p>
            </div>

            {error && <p className="text-red-500 text-xs">{error}</p>}
            {saveMsg && <p className="text-green-600 text-xs font-semibold">{saveMsg}</p>}

            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-[#0095f6] text-white font-semibold text-sm rounded-lg py-2 hover:bg-[#1877f2] disabled:opacity-50 transition-colors"
            >
              {isSaving ? 'Zapisywanie...' : 'Zapisz profil'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
