'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { API_URL } from '@/context/AuthContext';

export interface PostComment {
  _id: string;
  user: { _id: string; username: string; profilePicture?: string };
  text: string;
  createdAt: string;
}

export interface Post {
  _id: string;
  author: { _id: string; username: string; profilePicture?: string };
  caption: string;
  images: string[];
  createdAt: string;
  likes: string[];
  comments: PostComment[];
}

interface Props {
  post: Post;
  currentUserId: string;
  token: string;
  onEdit: (post: Post) => void;
  onDelete: (id: string) => void;
  onUpdate: (updated: Post) => void;
}

function resolveUrl(url: string) {
  return url.startsWith('http') ? url : `${API_URL}${url}`;
}

export default function PostCard({ post, currentUserId, token, onEdit, onDelete, onUpdate }: Props) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isLiking, setIsLiking] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const liked = post.likes.includes(currentUserId);
  const isOwn = post.author._id === currentUserId;
  const images = post.images ?? [];

  const authorAvatar = post.author.profilePicture
    ? resolveUrl(post.author.profilePicture)
    : null;

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  async function handleLike() {
    if (isLiking) return;
    setIsLiking(true);
    try {
      const res = await fetch(`${API_URL}/api/posts/${post._id}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) onUpdate({ ...post, likes: data.likes });
    } finally {
      setIsLiking(false);
    }
  }

  async function handleAddComment(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!commentText.trim() || isCommenting) return;
    setIsCommenting(true);
    try {
      const res = await fetch(`${API_URL}/api/posts/${post._id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: commentText.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        onUpdate({ ...post, comments: [...post.comments, data] });
        setCommentText('');
        setShowComments(true);
      }
    } finally {
      setIsCommenting(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    const res = await fetch(`${API_URL}/api/posts/${post._id}/comments/${commentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      onUpdate({ ...post, comments: post.comments.filter((c) => c._id !== commentId) });
    }
  }

  const avatarFor = (user: PostComment['user']) =>
    user.profilePicture ? resolveUrl(user.profilePicture) : null;

  return (
    <div className="bg-white border border-[#dbdbdb] rounded-xl overflow-hidden">
      {/* Nagłówek autora */}
      <Link href={`/user/${post.author.username}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[#fafafa] transition-colors">
        {authorAvatar ? (
          <img src={authorAvatar} alt={post.author.username} className="w-9 h-9 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {post.author.username[0].toUpperCase()}
          </div>
        )}
        <span className="text-sm font-semibold text-[#262626]">{post.author.username}</span>
      </Link>

      {/* Karuzela zdjęć */}
      {images.length > 0 && (
        <div className="relative select-none">
          <img
            src={resolveUrl(images[imgIdx])}
            alt=""
            className="w-full max-h-96 object-cover"
          />
          {images.length > 1 && (
            <>
              {imgIdx > 0 && (
                <button
                  onClick={() => setImgIdx((i) => i - 1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                  aria-label="Poprzednie"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
              )}
              {imgIdx < images.length - 1 && (
                <button
                  onClick={() => setImgIdx((i) => i + 1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                  aria-label="Następne"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              )}
              {/* Dots */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIdx(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i === imgIdx ? 'bg-white' : 'bg-white/50'}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Akcje: like + komentarz */}
      <div className="px-5 pt-3 pb-1 flex items-center gap-4">
        <button
          onClick={handleLike}
          disabled={isLiking}
          className="flex items-center gap-1.5 group"
          aria-label="Lubię to"
        >
          {liked ? (
            <svg className="w-6 h-6 text-red-500 fill-red-500 transition-transform group-active:scale-90" viewBox="0 0 24 24">
              <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-[#262626] transition-transform group-active:scale-90" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
          )}
          <span className={`text-sm font-semibold ${liked ? 'text-red-500' : 'text-[#262626]'}`}>
            {post.likes.length}
          </span>
        </button>

        <button
          onClick={() => { setShowComments((v) => !v); setTimeout(() => inputRef.current?.focus(), 50); }}
          className="flex items-center gap-1.5 group"
          aria-label="Komentarze"
        >
          <svg className="w-6 h-6 text-[#262626]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
          </svg>
          <span className="text-sm font-semibold text-[#262626]">{post.comments.length}</span>
        </button>
      </div>

      {/* Opis */}
      <div className="px-5 pb-1">
        {post.caption && (
          <p className="text-sm text-[#262626] whitespace-pre-wrap">{post.caption}</p>
        )}
        <p className="text-xs text-[#8e8e8e] mt-1">{formatDate(post.createdAt)}</p>
      </div>

      {/* Komentarze */}
      {showComments && (
        <div className="px-5 pb-3 border-t border-[#efefef] mt-2 pt-3 space-y-3">
          {post.comments.length === 0 ? (
            <p className="text-xs text-[#8e8e8e]">Brak komentarzy. Bądź pierwszy!</p>
          ) : (
            post.comments.map((c) => {
              const canDelete = c.user._id === currentUserId || isOwn;
              const src = avatarFor(c.user);
              return (
                <div key={c._id} className="flex items-start gap-2.5 group/comment">
                  {src ? (
                    <img src={src} alt={c.user.username} className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                      {c.user.username[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-[#262626] mr-1.5">{c.user.username}</span>
                    <span className="text-xs text-[#262626] break-words">{c.text}</span>
                    <p className="text-[10px] text-[#8e8e8e] mt-0.5">
                      {new Date(c.createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  {canDelete && (
                    <button
                      onClick={() => handleDeleteComment(c._id)}
                      className="opacity-0 group-hover/comment:opacity-100 text-[#8e8e8e] hover:text-red-500 transition-all shrink-0 mt-0.5"
                      aria-label="Usuń komentarz"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Pole komentarza */}
      <form onSubmit={handleAddComment} className="flex items-center gap-2 px-5 py-3 border-t border-[#efefef]">
        <input
          ref={inputRef}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Dodaj komentarz..."
          maxLength={300}
          className="flex-1 text-sm text-[#262626] placeholder:text-[#8e8e8e] bg-transparent outline-none"
        />
        {commentText.trim() && (
          <button
            type="submit"
            disabled={isCommenting}
            className="text-sm font-semibold text-[#0095f6] hover:text-[#00376b] disabled:opacity-50 transition-colors shrink-0"
          >
            {isCommenting ? '...' : 'Opublikuj'}
          </button>
        )}
      </form>

      {/* Edytuj / Usuń — tylko właściciel */}
      {isOwn && (
        <div className="flex items-center justify-end gap-3 px-5 pb-3">
          <button
            onClick={() => onEdit(post)}
            className="text-xs text-[#0095f6] font-medium hover:text-[#00376b] transition-colors"
          >
            Edytuj
          </button>
          <button
            onClick={() => onDelete(post._id)}
            className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors"
          >
            Usuń
          </button>
        </div>
      )}
    </div>
  );
}
