'use client';

import { useState, useRef, useEffect, FormEvent, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, API_URL } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import ImageCropModal from '@/components/ImageCropModal';
import PostCard, { Post } from '@/components/PostCard';

function resolveUrl(url: string) {
  return url.startsWith('http') ? url : `${API_URL}${url}`;
}

interface Story {
  _id: string;
  image: string;
  caption: string;
  author: { _id: string; username: string; profilePicture: string };
  views: string[];
  createdAt: string;
}

function storyTimeLeft(createdAt: string): string {
  const ms = new Date(createdAt).getTime() + 24 * 3600 * 1000 - Date.now();
  if (ms <= 0) return 'Wygasło';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h` : `${m}m`;
}

export default function ProfilePage() {
  const { user, token, isLoading, updateUser } = useAuth();
  const router = useRouter();

  // profil
  const [bio, setBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [profileError, setProfileError] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // nowy post
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [showPostForm, setShowPostForm] = useState(false);
  const [caption, setCaption] = useState('');
  const [postImages, setPostImages] = useState<File[]>([]);
  const [postImagePreviews, setPostImagePreviews] = useState<string[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const postFileRef = useRef<HTMLInputElement>(null);

  // cropper
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<'post' | 'edit' | 'story' | null>(null);
  const [cropQueue, setCropQueue] = useState<File[]>([]);

  // stories
  const [stories, setStories] = useState<Story[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [showStoryForm, setShowStoryForm] = useState(false);
  const [storyImage, setStoryImage] = useState<File | null>(null);
  const [storyImagePreview, setStoryImagePreview] = useState('');
  const [storyCaption, setStoryCaption] = useState('');
  const [isPostingStory, setIsPostingStory] = useState(false);
  const [storyError, setStoryError] = useState('');
  const storyFileRef = useRef<HTMLInputElement>(null);

  // story viewer
  const [viewingStoryIdx, setViewingStoryIdx] = useState<number | null>(null);

  // edycja posta
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editNewImages, setEditNewImages] = useState<File[]>([]);
  const [editNewPreviews, setEditNewPreviews] = useState<string[]>([]);
  const [editExistingImages, setEditExistingImages] = useState<string[]>([]);
  const [editRemovedImages, setEditRemovedImages] = useState<string[]>([]);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const editFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) setBio(user.bio || '');
  }, [user]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setFollowersCount(data.followers?.length ?? 0);
        setFollowingCount(data.following?.length ?? 0);
      })
      .catch(() => {});
  }, [token]);

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

  const fetchStories = useCallback(async () => {
    if (!token) return;
    setStoriesLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/stories/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setStories(Array.isArray(data) ? data : []);
    } catch {
      setStories([]);
    } finally {
      setStoriesLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);
  useEffect(() => { fetchStories(); }, [fetchStories]);

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
  function startCropQueue(files: File[], target: 'post' | 'edit' | 'story') {
    if (files.length === 0) return;
    setCropQueue(files.slice(1));
    setCropTarget(target);
    setCropSrc(URL.createObjectURL(files[0]));
  }

  async function openCropperFromUrl(url: string, target: 'post' | 'edit') {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      setCropSrc(URL.createObjectURL(blob));
      setCropTarget(target);
      setCropQueue([]);
    } catch {
      if (target === 'edit') editFileRef.current?.click();
    }
  }

  function handleCropConfirm(croppedFile: File) {
    if (cropTarget === 'post') {
      setPostImages((prev) => [...prev, croppedFile]);
      setPostImagePreviews((prev) => [...prev, URL.createObjectURL(croppedFile)]);
    } else if (cropTarget === 'edit') {
      setEditNewImages((prev) => [...prev, croppedFile]);
      setEditNewPreviews((prev) => [...prev, URL.createObjectURL(croppedFile)]);
    } else if (cropTarget === 'story') {
      setStoryImage(croppedFile);
      setStoryImagePreview(URL.createObjectURL(croppedFile));
    }

    // Next in queue
    if (cropQueue.length > 0) {
      const [next, ...rest] = cropQueue;
      setCropQueue(rest);
      setCropSrc(URL.createObjectURL(next));
    } else {
      setCropSrc(null);
      setCropTarget(null);
    }
  }

  function handleCropCancel() {
    setCropSrc(null);
    setCropTarget(null);
    setCropQueue([]);
    if (postFileRef.current) postFileRef.current.value = '';
    if (editFileRef.current) editFileRef.current.value = '';
    if (storyFileRef.current) storyFileRef.current.value = '';
  }

  // --- nowy post ---
  function handlePostImagesSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    startCropQueue(files, 'post');
    e.target.value = '';
  }

  function removePostImage(idx: number) {
    setPostImages((prev) => prev.filter((_, i) => i !== idx));
    setPostImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleCreatePost(e: FormEvent) {
    e.preventDefault();
    setPostError('');
    if (!caption.trim() && postImages.length === 0) { setPostError('Dodaj tekst lub zdjęcie'); return; }
    setIsPosting(true);
    try {
      const form = new FormData();
      form.append('caption', caption.trim());
      postImages.forEach((img) => form.append('images', img));
      const res = await fetch(`${API_URL}/api/posts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setCaption('');
      setPostImages([]);
      setPostImagePreviews([]);
      setShowPostForm(false);
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
    setEditNewImages([]);
    setEditNewPreviews([]);
    setEditExistingImages(post.images ?? []);
    setEditRemovedImages([]);
    setEditError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditNewImages([]);
    setEditNewPreviews([]);
    if (editFileRef.current) editFileRef.current.value = '';
  }

  function handleEditImagesSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    startCropQueue(files, 'edit');
    e.target.value = '';
  }

  function removeExistingImage(url: string) {
    setEditExistingImages((prev) => prev.filter((u) => u !== url));
    setEditRemovedImages((prev) => [...prev, url]);
  }

  function removeNewEditImage(idx: number) {
    setEditNewImages((prev) => prev.filter((_, i) => i !== idx));
    setEditNewPreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSaveEdit(e: FormEvent, postId: string) {
    e.preventDefault();
    setEditError('');
    setIsEditSaving(true);
    try {
      const form = new FormData();
      form.append('caption', editCaption.trim());
      if (editRemovedImages.length > 0) {
        form.append('removeImages', JSON.stringify(editRemovedImages));
      }
      editNewImages.forEach((img) => form.append('images', img));

      const res = await fetch(`${API_URL}/api/posts/${postId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setPosts((prev) => prev.map((p) => p._id === postId ? data : p));
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

  // --- stories ---
  function handleStoryImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    startCropQueue([file], 'story');
    e.target.value = '';
  }

  async function handleCreateStory(e: FormEvent) {
    e.preventDefault();
    setStoryError('');
    if (!storyImage) { setStoryError('Wybierz zdjęcie do story'); return; }
    setIsPostingStory(true);
    try {
      const form = new FormData();
      form.append('image', storyImage);
      form.append('caption', storyCaption.trim());
      const res = await fetch(`${API_URL}/api/stories`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setStoryImage(null);
      setStoryImagePreview('');
      setStoryCaption('');
      setShowStoryForm(false);
      fetchStories();
    } catch (err) {
      setStoryError(err instanceof Error ? err.message : 'Błąd dodawania story');
    } finally {
      setIsPostingStory(false);
    }
  }

  async function handleDeleteStory(id: string) {
    if (!confirm('Usunąć to story?')) return;
    await fetch(`${API_URL}/api/stories/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setStories((prev) => prev.filter((s) => s._id !== id));
  }

  const allEditImages = editExistingImages.length + editNewPreviews.length;

  return (
    <div
      className="min-h-screen [color-scheme:light] bg-cover bg-center bg-fixed"
      style={{ backgroundImage: "url('/feed-bg.png')" }}
    >
      {cropSrc && (
        <ImageCropModal
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}

      {/* Story viewer modal */}
      {viewingStoryIdx !== null && stories[viewingStoryIdx] && (() => {
        const story = stories[viewingStoryIdx];
        const hasPrev = viewingStoryIdx > 0;
        const hasNext = viewingStoryIdx < stories.length - 1;
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
                  {user.profilePicture ? (
                    <img src={`${API_URL}${user.profilePicture}`} alt="" className="w-8 h-8 rounded-full object-cover border border-white/30" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm font-bold">
                      {user.username[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-white text-sm font-semibold">{user.username}</span>
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

                {/* Left nav zone */}
                {hasPrev && (
                  <button
                    onClick={() => setViewingStoryIdx(viewingStoryIdx - 1)}
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

                {/* Right nav zone */}
                {hasNext && (
                  <button
                    onClick={() => setViewingStoryIdx(viewingStoryIdx + 1)}
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
              <div className="flex items-center justify-between w-full mt-3 px-1">
                <div className="flex items-center gap-1 text-white/60 text-xs">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {story.views.length} wyświetleń
                </div>
                {stories.length > 1 && (
                  <span className="text-white/40 text-xs">{viewingStoryIdx + 1} / {stories.length}</span>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <Navbar />

      <main className="max-w-2xl mx-auto px-4 pt-10 pb-16 space-y-6">

        {/* Karta profilu */}
        <div className="bg-white border border-[#dbdbdb] rounded-xl p-8">

          {/* Avatar + dane */}
          <div className="flex items-center gap-8 mb-6">
            {/* Avatar */}
            <div className="relative group flex-shrink-0">
              {avatarSrc ? (
                <img src={avatarSrc} alt={user.username} className="w-24 h-24 rounded-full object-cover border-2 border-[#dbdbdb]" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-3xl font-bold border-2 border-[#dbdbdb]">
                  {user.username[0].toUpperCase()}
                </div>
              )}
              {isEditingProfile && (
                <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
                  className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {isUploading
                    ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                  }
                </button>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <h1 className="text-xl font-semibold text-[#262626]">{user.username}</h1>
                {!isEditingProfile && (
                  <button
                    onClick={() => { setIsEditingProfile(true); setProfileError(''); setSaveMsg(''); }}
                    className="px-4 py-1.5 text-sm font-semibold border border-[#dbdbdb] rounded-lg text-[#262626] hover:bg-[#fafafa] transition-colors"
                  >
                    Edytuj profil
                  </button>
                )}
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
                  <span className="text-sm font-semibold text-[#262626]">{followingCount}</span>
                  <p className="text-xs text-[#8e8e8e]">obserwowanych</p>
                </div>
              </div>

              {/* Bio statyczne */}
              {!isEditingProfile && (
                <p className="text-sm text-[#262626] whitespace-pre-wrap">
                  {user.bio || <span className="text-[#8e8e8e]">Brak bio</span>}
                </p>
              )}
            </div>
          </div>

          {/* Formularz edycji — tylko gdy aktywny */}
          {isEditingProfile && (
            <>
              <div className="h-px bg-[#dbdbdb] mb-5" />
              <form onSubmit={handleSaveBio} className="space-y-3">
                {isUploading && (
                  <p className="text-xs text-[#0095f6]">Przesyłanie zdjęcia...</p>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="text-sm text-[#0095f6] font-semibold hover:text-[#00376b] disabled:opacity-50"
                >
                  Zmień zdjęcie profilowe
                </button>
                <div>
                  <label className="text-xs text-[#8e8e8e] font-medium uppercase tracking-wide block mb-1">Bio</label>
                  <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={150} rows={3}
                    placeholder="Napisz coś o sobie..."
                    className="w-full bg-[#fafafa] border border-[#dbdbdb] rounded-lg text-sm text-[#262626] placeholder:text-[#8e8e8e] px-3 py-2 resize-none focus:outline-none focus:border-[#a8a8a8]" />
                  <p className="text-right text-xs text-[#8e8e8e] mt-1">{bio.length}/150</p>
                </div>
                {profileError && <p className="text-red-500 text-xs">{profileError}</p>}
                {saveMsg && <p className="text-green-600 text-xs font-semibold">{saveMsg}</p>}
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => { setIsEditingProfile(false); setBio(user.bio || ''); setProfileError(''); setSaveMsg(''); }}
                    className="flex-1 border border-[#dbdbdb] text-[#262626] text-sm font-semibold rounded-lg py-2 hover:bg-[#fafafa] transition-colors">
                    Anuluj
                  </button>
                  <button type="submit" disabled={isSaving}
                    className="flex-1 bg-[#0095f6] text-white font-semibold text-sm rounded-lg py-2 hover:bg-[#1877f2] disabled:opacity-50 transition-colors">
                    {isSaving ? 'Zapisywanie...' : 'Zapisz'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        {/* Sekcja stories */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[#262626] font-semibold text-base">
              Moje stories <span className="text-[#8e8e8e] font-normal">({stories.length})</span>
            </h2>
            <button
              onClick={() => { setShowStoryForm((v) => !v); setStoryError(''); }}
              className="flex items-center gap-1.5 bg-[#0095f6] text-white text-sm font-semibold px-4 py-1.5 rounded-lg hover:bg-[#1877f2] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nowe story
            </button>
          </div>

          {/* Formularz nowego story */}
          {showStoryForm && (
            <div className="bg-white border border-[#dbdbdb] rounded-xl p-6 mb-4">
              <form onSubmit={handleCreateStory} className="space-y-4">
                <p className="text-xs font-semibold text-[#8e8e8e] uppercase tracking-wide">Nowe story</p>

                {storyImagePreview ? (
                  <div className="relative w-32 aspect-square rounded-xl overflow-hidden group/thumb mx-auto">
                    <img src={storyImagePreview} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { setStoryImage(null); setStoryImagePreview(''); }}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity hover:bg-red-500"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => storyFileRef.current?.click()}
                      className="absolute bottom-1 inset-x-0 mx-auto w-max px-2 py-0.5 bg-black/60 text-white text-[10px] rounded opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                    >
                      Zmień
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => storyFileRef.current?.click()}
                    className="w-full border-2 border-dashed border-[#dbdbdb] rounded-lg py-8 flex flex-col items-center gap-2 text-[#8e8e8e] hover:border-[#a8a8a8] hover:text-[#262626] transition-colors"
                  >
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M13.5 12h.008M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 3.75h-9A2.25 2.25 0 005.25 6v8.25" />
                    </svg>
                    <span className="text-sm font-medium">Dodaj zdjęcie (wymagane)</span>
                  </button>
                )}
                <input ref={storyFileRef} type="file" accept="image/*" className="hidden" onChange={handleStoryImageSelect} />

                <textarea
                  value={storyCaption}
                  onChange={(e) => setStoryCaption(e.target.value)}
                  maxLength={2200}
                  rows={2}
                  placeholder="Opis (opcjonalnie)..."
                  className="w-full bg-[#fafafa] border border-[#dbdbdb] rounded-lg text-sm text-[#262626] placeholder:text-[#8e8e8e] px-3 py-2 resize-none focus:outline-none focus:border-[#a8a8a8]"
                />

                {storyError && <p className="text-red-500 text-xs">{storyError}</p>}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowStoryForm(false); setStoryImage(null); setStoryImagePreview(''); setStoryCaption(''); }}
                    className="flex-1 border border-[#dbdbdb] text-[#262626] text-sm font-semibold rounded-lg py-2 hover:bg-[#fafafa] transition-colors"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={isPostingStory}
                    className="flex-1 bg-[#0095f6] text-white text-sm font-semibold rounded-lg py-2 hover:bg-[#1877f2] disabled:opacity-50 transition-colors"
                  >
                    {isPostingStory ? 'Dodawanie...' : 'Opublikuj story'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Lista stories */}
          {storiesLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-7 h-7 border-2 border-[#dbdbdb] border-t-[#0095f6] rounded-full animate-spin" />
            </div>
          ) : stories.length === 0 ? (
            <div className="bg-white border border-[#dbdbdb] rounded-xl py-10 flex flex-col items-center gap-2 text-[#8e8e8e]">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" />
              </svg>
              <p className="text-sm font-medium">Brak aktywnych stories</p>
              <p className="text-xs">Stories znikają po 24h</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-x-5 gap-y-7 pt-3 pl-3 pb-7">
              {stories.map((story, idx) => (
                <div key={story._id} className="group/story relative">
                  <button
                    onClick={() => setViewingStoryIdx(idx)}
                    className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-[#0095f6] ring-offset-2 block focus:outline-none cursor-pointer"
                  >
                    <img src={resolveUrl(story.image)} alt="" className="w-full h-full object-cover" />
                  </button>
                  {/* czas pozostały */}
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-black/70 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full pointer-events-none">
                    {storyTimeLeft(story.createdAt)}
                  </span>
                  {/* usuń */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteStory(story._id); }}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/story:opacity-100 transition-opacity shadow"
                    title="Usuń story"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                  {/* caption tooltip */}
                  {story.caption && (
                    <p className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-[#8e8e8e] whitespace-nowrap max-w-[80px] truncate">{story.caption}</p>
                  )}
                </div>
              ))}
            </div>
          )}
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
                {/* Siatka miniatur + przycisk dodawania */}
                {postImagePreviews.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {postImagePreviews.map((src, i) => (
                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden group/thumb">
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removePostImage(i)}
                          className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity hover:bg-black/80">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => postFileRef.current?.click()}
                      className="aspect-square rounded-lg border-2 border-dashed border-[#dbdbdb] flex items-center justify-center text-[#8e8e8e] hover:border-[#a8a8a8] hover:text-[#262626] transition-colors">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </button>
                  </div>
                )}
                {postImagePreviews.length === 0 && (
                  <button type="button" onClick={() => postFileRef.current?.click()}
                    className="w-full border-2 border-dashed border-[#dbdbdb] rounded-lg py-8 flex flex-col items-center gap-2 text-[#8e8e8e] hover:border-[#a8a8a8] hover:text-[#262626] transition-colors">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M13.5 12h.008M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 3.75h-9A2.25 2.25 0 005.25 6v8.25" />
                    </svg>
                    <span className="text-sm font-medium">Dodaj zdjęcia (opcjonalnie)</span>
                    <span className="text-xs">Możesz dodać kilka naraz</span>
                  </button>
                )}
                <input ref={postFileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePostImagesSelect} />
                <textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={2200} rows={3}
                  placeholder="Co słychać?"
                  className="w-full bg-[#fafafa] border border-[#dbdbdb] rounded-lg text-sm text-[#262626] placeholder:text-[#8e8e8e] px-3 py-2 resize-none focus:outline-none focus:border-[#a8a8a8]" />
                {postError && <p className="text-red-500 text-xs">{postError}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setShowPostForm(false); setCaption(''); setPostImages([]); setPostImagePreviews([]); }}
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
                    <div className="bg-white border border-[#dbdbdb] rounded-xl overflow-hidden">
                      <form onSubmit={(e) => handleSaveEdit(e, post._id)} className="p-5 space-y-3">
                        <p className="text-xs font-semibold text-[#8e8e8e] uppercase tracking-wide mb-1">Edytuj post</p>

                        {/* Istniejące zdjęcia */}
                        {(editExistingImages.length > 0 || editNewPreviews.length > 0) && (
                          <div className="grid grid-cols-3 gap-2">
                            {editExistingImages.map((url) => (
                              <div key={url} className="relative aspect-square rounded-lg overflow-hidden group/thumb">
                                <img src={resolveUrl(url)} alt="" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/20 transition-colors" />
                                <button type="button" onClick={() => openCropperFromUrl(resolveUrl(url), 'edit')}
                                  className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 text-white text-[10px] rounded opacity-0 group-hover/thumb:opacity-100 transition-opacity hover:bg-black/80">
                                  Przytnij
                                </button>
                                <button type="button" onClick={() => removeExistingImage(url)}
                                  className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity hover:bg-red-500">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </div>
                            ))}
                            {editNewPreviews.map((src, i) => (
                              <div key={`new-${i}`} className="relative aspect-square rounded-lg overflow-hidden group/thumb">
                                <img src={src} alt="" className="w-full h-full object-cover" />
                                <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-[#0095f6] text-white text-[10px] rounded font-medium">Nowe</div>
                                <button type="button" onClick={() => removeNewEditImage(i)}
                                  className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity hover:bg-red-500">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </div>
                            ))}
                            {allEditImages < 10 && (
                              <button type="button" onClick={() => editFileRef.current?.click()}
                                className="aspect-square rounded-lg border-2 border-dashed border-[#dbdbdb] flex items-center justify-center text-[#8e8e8e] hover:border-[#a8a8a8] hover:text-[#262626] transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                              </button>
                            )}
                          </div>
                        )}
                        {editExistingImages.length === 0 && editNewPreviews.length === 0 && (
                          <button type="button" onClick={() => editFileRef.current?.click()}
                            className="w-full border-2 border-dashed border-[#dbdbdb] rounded-lg py-6 flex flex-col items-center gap-1.5 text-[#8e8e8e] hover:border-[#a8a8a8] hover:text-[#262626] transition-colors text-sm">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M13.5 12h.008" />
                            </svg>
                            Dodaj zdjęcia (opcjonalnie)
                          </button>
                        )}
                        <input ref={editFileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleEditImagesSelect} />

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
