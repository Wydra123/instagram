'use client';

import { useState, useRef, useEffect, FormEvent, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, API_URL } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import ImageCropModal from '@/components/ImageCropModal';
import PostCard, { Post } from '@/components/PostCard';

export default function ProfilePage() {
  const { user, token, isLoading, updateUser } = useAuth();
  const router = useRouter();

  // profil
  const [bio, setBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [profileError, setProfileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // nowy post
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [showPostForm, setShowPostForm] = useState(false);
  const [caption, setCaption] = useState('');
  const [postImage, setPostImage] = useState<File | null>(null);
  const [postImagePreview, setPostImagePreview] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const postFileRef = useRef<HTMLInputElement>(null);

  // cropper
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<'post' | 'edit' | null>(null);

  // edycja posta
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editRemoveImage, setEditRemoveImage] = useState(false);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const editFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) setBio(user.bio || '');
  }, [user]);

  const fetchPosts = useCallback(async () => {
    if (!token) return;
    setPostsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/posts/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setPosts(Array.isArray(data) ? data : []);
    } catch {
      setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="w-8 h-8 border-2 border-[#dbdbdb] border-t-[#0095f6] rounded-full animate-spin" />
      </div>
    );
  }

  const avatarSrc = user.profilePicture ? `${API_URL}${user.profilePicture}` : null;

  // --- profil ---
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileError('');
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
      setProfileError(err instanceof Error ? err.message : 'Błąd przesyłania');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSaveBio(e: FormEvent) {
    e.preventDefault();
    setProfileError('');
    setSaveMsg('');
    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bio }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      updateUser({ bio: data.bio });
      setSaveMsg('Zapisano!');
      setTimeout(() => setSaveMsg(''), 2500);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Błąd zapisu');
    } finally {
      setIsSaving(false);
    }
  }

  // --- cropper ---
  function openCropper(file: File, target: 'post' | 'edit') {
    setCropSrc(URL.createObjectURL(file));
    setCropTarget(target);
  }

  async function openCropperFromUrl(url: string, target: 'post' | 'edit') {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      setCropSrc(URL.createObjectURL(blob));
      setCropTarget(target);
    } catch {
      // fallback: otwórz file picker
      if (target === 'edit') editFileRef.current?.click();
    }
  }

  function handleCropConfirm(croppedFile: File) {
    if (cropTarget === 'post') {
      setPostImage(croppedFile);
      setPostImagePreview(URL.createObjectURL(croppedFile));
    } else if (cropTarget === 'edit') {
      setEditImage(croppedFile);
      setEditImagePreview(URL.createObjectURL(croppedFile));
      setEditRemoveImage(false);
    }
    setCropSrc(null);
    setCropTarget(null);
  }

  function handleCropCancel() {
    setCropSrc(null);
    setCropTarget(null);
    if (postFileRef.current) postFileRef.current.value = '';
    if (editFileRef.current) editFileRef.current.value = '';
  }

  // --- nowy post ---
  function handlePostImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    openCropper(file, 'post');
  }

  function clearPostImage() {
    setPostImage(null);
    setPostImagePreview(null);
    if (postFileRef.current) postFileRef.current.value = '';
  }

  async function handleCreatePost(e: FormEvent) {
    e.preventDefault();
    setPostError('');
    if (!caption.trim() && !postImage) { setPostError('Dodaj tekst lub zdjęcie'); return; }
    setIsPosting(true);
    try {
      const form = new FormData();
      form.append('caption', caption.trim());
      if (postImage) form.append('image', postImage);
      const res = await fetch(`${API_URL}/api/posts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setCaption(''); clearPostImage(); setShowPostForm(false);
      fetchPosts();
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Błąd dodawania posta');
    } finally {
      setIsPosting(false);
    }
  }

  // --- edycja posta ---
  function startEdit(post: Post) {
    setEditingId(post._id);
    setEditCaption(post.caption);
    setEditImage(null);
    setEditImagePreview(null);
    setEditRemoveImage(false);
    setEditError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditImage(null);
    setEditImagePreview(null);
    if (editFileRef.current) editFileRef.current.value = '';
  }

  function handleEditImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    openCropper(file, 'edit');
  }

  async function handleSaveEdit(e: FormEvent, postId: string) {
    e.preventDefault();
    setEditError('');
    setIsEditSaving(true);
    try {
      const form = new FormData();
      form.append('caption', editCaption.trim());
      if (editRemoveImage) form.append('removeImage', 'true');
      if (editImage) form.append('image', editImage);

      const res = await fetch(`${API_URL}/api/posts/${postId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setPosts((prev) => prev.map((p) => p._id === postId ? { ...p, caption: data.caption, imageUrl: data.imageUrl } : p));
      cancelEdit();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Błąd zapisu');
    } finally {
      setIsEditSaving(false);
    }
  }

  async function handleDeletePost(id: string) {
    if (!confirm('Usunąć ten post?')) return;
    await fetch(`${API_URL}/api/posts/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setPosts((prev) => prev.filter((p) => p._id !== id));
  }

  return (
    <div className="min-h-screen bg-[#fafafa] [color-scheme:light]">
      {cropSrc && (
        <ImageCropModal
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 pt-10 pb-16 space-y-6">

        {/* Karta profilu */}
        <div className="bg-white border border-[#dbdbdb] rounded-xl p-8">
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="relative group">
              {avatarSrc ? (
                <img src={avatarSrc} alt={user.username} className="w-28 h-28 rounded-full object-cover border-2 border-[#dbdbdb]" />
              ) : (
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-4xl font-bold border-2 border-[#dbdbdb]">
                  {user.username[0].toUpperCase()}
                </div>
              )}
              <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
                className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {isUploading
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                }
              </button>
            </div>
            <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
              className="text-sm text-[#0095f6] font-semibold hover:text-[#00376b] disabled:opacity-50">
              {isUploading ? 'Przesyłanie...' : 'Zmień zdjęcie profilowe'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>

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

          <form onSubmit={handleSaveBio} className="space-y-3">
            <div>
              <label className="text-xs text-[#8e8e8e] font-medium uppercase tracking-wide block mb-1">Bio</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={150} rows={3}
                placeholder="Napisz coś o sobie..."
                className="w-full bg-[#fafafa] border border-[#dbdbdb] rounded-lg text-sm text-[#262626] placeholder:text-[#8e8e8e] px-3 py-2 resize-none focus:outline-none focus:border-[#a8a8a8]" />
              <p className="text-right text-xs text-[#8e8e8e] mt-1">{bio.length}/150</p>
            </div>
            {profileError && <p className="text-red-500 text-xs">{profileError}</p>}
            {saveMsg && <p className="text-green-600 text-xs font-semibold">{saveMsg}</p>}
            <button type="submit" disabled={isSaving}
              className="w-full bg-[#0095f6] text-white font-semibold text-sm rounded-lg py-2 hover:bg-[#1877f2] disabled:opacity-50 transition-colors">
              {isSaving ? 'Zapisywanie...' : 'Zapisz profil'}
            </button>
          </form>
        </div>

        {/* Sekcja postów */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[#262626] font-semibold text-base">Moje posty <span className="text-[#8e8e8e] font-normal">({posts.length})</span></h2>
            <button onClick={() => { setShowPostForm((v) => !v); setPostError(''); }}
              className="flex items-center gap-1.5 bg-[#0095f6] text-white text-sm font-semibold px-4 py-1.5 rounded-lg hover:bg-[#1877f2] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nowy post
            </button>
          </div>

          {/* Formularz nowego posta */}
          {showPostForm && (
            <div className="bg-white border border-[#dbdbdb] rounded-xl p-6 mb-4">
              <form onSubmit={handleCreatePost} className="space-y-4">
                {postImagePreview ? (
                  <div className="relative rounded-lg overflow-hidden">
                    <img src={postImagePreview} alt="Podgląd" className="w-full max-h-72 object-cover" />
                    <button type="button" onClick={clearPostImage}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => postFileRef.current?.click()}
                    className="w-full border-2 border-dashed border-[#dbdbdb] rounded-lg py-8 flex flex-col items-center gap-2 text-[#8e8e8e] hover:border-[#a8a8a8] hover:text-[#262626] transition-colors">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M13.5 12h.008M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 3.75h-9A2.25 2.25 0 005.25 6v8.25" />
                    </svg>
                    <span className="text-sm font-medium">Dodaj zdjęcie (opcjonalnie)</span>
                  </button>
                )}
                <input ref={postFileRef} type="file" accept="image/*" className="hidden" onChange={handlePostImageSelect} />
                <textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={2200} rows={3}
                  placeholder="Co słychać?"
                  className="w-full bg-[#fafafa] border border-[#dbdbdb] rounded-lg text-sm text-[#262626] placeholder:text-[#8e8e8e] px-3 py-2 resize-none focus:outline-none focus:border-[#a8a8a8]" />
                {postError && <p className="text-red-500 text-xs">{postError}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setShowPostForm(false); setCaption(''); clearPostImage(); }}
                    className="flex-1 border border-[#dbdbdb] text-[#262626] text-sm font-semibold rounded-lg py-2 hover:bg-[#fafafa] transition-colors">
                    Anuluj
                  </button>
                  <button type="submit" disabled={isPosting}
                    className="flex-1 bg-[#0095f6] text-white text-sm font-semibold rounded-lg py-2 hover:bg-[#1877f2] disabled:opacity-50 transition-colors">
                    {isPosting ? 'Dodawanie...' : 'Opublikuj'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Lista postów */}
          {postsLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-7 h-7 border-2 border-[#dbdbdb] border-t-[#0095f6] rounded-full animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-white border border-[#dbdbdb] rounded-xl py-16 flex flex-col items-center gap-2 text-[#8e8e8e]">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
              <p className="text-sm font-medium">Brak postów</p>
              <p className="text-xs">Opublikuj swój pierwszy post!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <div key={post._id}>
                  {editingId === post._id ? (
                    /* Formularz edycji */
                    <div className="bg-white border border-[#dbdbdb] rounded-xl overflow-hidden">
                      <form onSubmit={(e) => handleSaveEdit(e, post._id)} className="p-5 space-y-3">
                        <p className="text-xs font-semibold text-[#8e8e8e] uppercase tracking-wide mb-1">Edytuj post</p>

                        {editImagePreview ? (
                          <div className="relative rounded-lg overflow-hidden">
                            <img src={editImagePreview} alt="Nowe zdjęcie" className="w-full max-h-64 object-cover" />
                            <button type="button" onClick={() => { setEditImage(null); setEditImagePreview(null); if (editFileRef.current) editFileRef.current.value = ''; }}
                              className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ) : post.imageUrl && !editRemoveImage ? (
                          <div className="relative rounded-lg overflow-hidden group/img">
                            <img src={`${API_URL}${post.imageUrl}`} alt="" className="w-full max-h-64 object-cover" />
                            <button type="button" onClick={() => openCropperFromUrl(`${API_URL}${post.imageUrl}`, 'edit')}
                              className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-colors flex items-center justify-center">
                              <span className="opacity-0 group-hover/img:opacity-100 transition-opacity bg-black/60 text-white rounded-xl px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium pointer-events-none">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5m0 9V18A2.25 2.25 0 0118 20.25h-1.5m-9 0H6A2.25 2.25 0 013.75 18v-1.5M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                Kliknij aby przyciąć
                              </span>
                            </button>
                            <div className="absolute top-2 right-2 flex gap-1 z-10">
                              <button type="button" onClick={(e) => { e.stopPropagation(); editFileRef.current?.click(); }}
                                className="px-2 py-1 bg-black/60 text-white text-xs rounded-lg hover:bg-black/80">Zmień</button>
                              <button type="button" onClick={(e) => { e.stopPropagation(); setEditRemoveImage(true); }}
                                className="px-2 py-1 bg-red-500/80 text-white text-xs rounded-lg hover:bg-red-600">Usuń</button>
                            </div>
                          </div>
                        ) : (
                          <button type="button" onClick={() => editFileRef.current?.click()}
                            className="w-full border-2 border-dashed border-[#dbdbdb] rounded-lg py-6 flex flex-col items-center gap-1.5 text-[#8e8e8e] hover:border-[#a8a8a8] hover:text-[#262626] transition-colors text-sm">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M13.5 12h.008" />
                            </svg>
                            {editRemoveImage ? 'Dodaj nowe zdjęcie (opcjonalnie)' : 'Dodaj zdjęcie (opcjonalnie)'}
                          </button>
                        )}
                        <input ref={editFileRef} type="file" accept="image/*" className="hidden" onChange={handleEditImageSelect} />

                        <textarea value={editCaption} onChange={(e) => setEditCaption(e.target.value)} maxLength={2200} rows={3}
                          placeholder="Treść posta..."
                          className="w-full bg-[#fafafa] border border-[#dbdbdb] rounded-lg text-sm text-[#262626] placeholder:text-[#8e8e8e] px-3 py-2 resize-none focus:outline-none focus:border-[#a8a8a8]" />

                        {editError && <p className="text-red-500 text-xs">{editError}</p>}

                        <div className="flex gap-2">
                          <button type="button" onClick={cancelEdit}
                            className="flex-1 border border-[#dbdbdb] text-[#262626] text-sm font-semibold rounded-lg py-2 hover:bg-[#fafafa] transition-colors">
                            Anuluj
                          </button>
                          <button type="submit" disabled={isEditSaving}
                            className="flex-1 bg-[#0095f6] text-white text-sm font-semibold rounded-lg py-2 hover:bg-[#1877f2] disabled:opacity-50 transition-colors">
                            {isEditSaving ? 'Zapisywanie...' : 'Zapisz'}
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <PostCard
                      post={post}
                      currentUserId={user.id}
                      token={token!}
                      onEdit={startEdit}
                      onDelete={handleDeletePost}
                      onUpdate={(updated) => setPosts((prev) => prev.map((p) => p._id === updated._id ? updated : p))}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
