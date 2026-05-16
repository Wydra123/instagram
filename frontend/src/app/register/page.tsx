'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Hasło musi mieć co najmniej 6 znaków');
      return;
    }

    setIsLoading(true);
    try {
      await register(username, email, password);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd rejestracji');
    } finally {
      setIsLoading(false);
    }
  }

  const isFormValid = username && email && password.length >= 6;

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-3">
        {/* Card rejestracji */}
        <div className="bg-white border border-[#dbdbdb] rounded px-10 pt-10 pb-8">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <svg
              viewBox="0 0 186 44"
              className="w-44"
              fill="currentColor"
              aria-label="Instagram"
            >
              <path d="M4.64 10.78c0-1.71 1.37-3.07 3.07-3.07 1.7 0 3.07 1.36 3.07 3.07 0 1.7-1.37 3.06-3.07 3.06-1.7 0-3.07-1.36-3.07-3.06zm.56 5.26h5.03v16.1H5.2V16.04zM14.24 16.04h4.8v2.2h.07c.67-1.27 2.3-2.6 4.73-2.6 5.06 0 5.99 3.33 5.99 7.66v8.84h-5.03v-7.84c0-1.87-.03-4.27-2.6-4.27-2.6 0-3 2.04-3 4.14v7.97h-5.03V16.04h.07zM34 16.04h4.8v2.2h.07c.67-1.27 2.3-2.6 4.73-2.6 5.06 0 5.99 3.33 5.99 7.66v8.84h-5.03v-7.84c0-1.87-.03-4.27-2.6-4.27-2.6 0-3 2.04-3 4.14v7.97H34V16.04zM52.92 8.67h5.03v23.47h-5.03V8.67zM62.2 24.09c0-4.74 3.34-8.45 8.3-8.45 4.97 0 8.3 3.71 8.3 8.45s-3.33 8.45-8.3 8.45c-4.96 0-8.3-3.71-8.3-8.45zm11.56 0c0-2.44-1.27-4.3-3.26-4.3-2 0-3.27 1.86-3.27 4.3s1.27 4.3 3.27 4.3c2 0 3.26-1.86 3.26-4.3zM80.92 16.04h4.8v2.47h.07c.84-1.57 2.4-2.87 5-2.87 3.2 0 5.43 1.67 5.43 6.03v10.47h-5.03V22.9c0-2.07-.67-3.23-2.33-3.23-1.9 0-2.9 1.3-2.9 3.6v8.87h-5.04V16.04zM99.72 8.67h5.03v13.1h.07l5.03-5.73h5.8l-5.87 6.5 6.17 9.6h-5.83l-3.73-6.17-1.64 1.77v4.4h-5.03V8.67zM118.22 27.42c0-3.37 2.57-5 6.27-5.27l4-.27v-.4c0-1.57-.97-2.47-2.77-2.47-1.63 0-2.73.77-3 2h-4.57c.34-3.5 3.4-5.37 7.87-5.37 4.6 0 7.43 2.34 7.43 6.1v10.4h-4.8v-2.1h-.07c-.9 1.5-2.6 2.5-4.87 2.5-3.13 0-5.49-1.87-5.49-5.12zm10.27-1.37v-.87l-3.07.2c-1.6.1-2.5.84-2.5 2.07 0 1.17.87 1.9 2.27 1.9 1.9 0 3.3-1.2 3.3-3.3zM136.79 27.62h4.7c.2 1.5 1.4 2.3 3.3 2.3 1.73 0 2.7-.73 2.7-1.8 0-1-.77-1.47-2.9-1.94l-2.37-.5c-3.37-.73-5.17-2.47-5.17-5.23 0-3.47 2.94-5.8 7.37-5.8 4.27 0 7.07 2.17 7.3 5.53h-4.57c-.17-1.43-1.2-2.23-2.83-2.23-1.5 0-2.44.7-2.44 1.73 0 .94.7 1.43 2.6 1.87l2.44.53c3.53.77 5.4 2.47 5.4 5.27 0 3.5-2.97 5.97-7.53 5.97-4.47 0-7.5-2.27-7.6-5.7zM157.42 26.52v-7.04h-2.47v-3.44h2.47V12.1h5.03v3.94h3.27v3.44h-3.27v6.53c0 1.3.6 1.87 1.8 1.87.57 0 1.07-.07 1.47-.17v3.77c-.6.17-1.5.27-2.47.27-3.63 0-5.83-1.77-5.83-5.23zM167.55 24.09c0-4.74 3.17-8.45 8.04-8.45 5.06 0 7.86 3.6 7.86 8.84v1.17h-11.03c.27 2.17 1.53 3.4 3.47 3.4 1.5 0 2.6-.67 3.1-1.87h4.83c-.9 3.37-3.83 5.36-8 5.36-5.1 0-8.27-3.71-8.27-8.45zm11.23-1.97c-.13-1.87-1.27-3.07-3.13-3.07-1.87 0-3.07 1.2-3.37 3.07h6.5z" />
            </svg>
          </div>

          <p className="text-[#737373] text-sm font-semibold text-center mb-5 leading-5">
            Zarejestruj się, aby zobaczyć zdjęcia i filmy od znajomych.
          </p>

          {/* Formularz */}
          <form onSubmit={handleSubmit} className="space-y-2">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[#fafafa] border border-[#dbdbdb] rounded text-sm px-3 py-2 focus:outline-none focus:border-[#a8a8a8] placeholder:text-[#737373]"
            />
            <input
              type="text"
              placeholder="Nazwa użytkownika"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
              required
              className="w-full bg-[#fafafa] border border-[#dbdbdb] rounded text-sm px-3 py-2 focus:outline-none focus:border-[#a8a8a8] placeholder:text-[#737373]"
            />
            <input
              type="password"
              placeholder="Hasło"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-[#fafafa] border border-[#dbdbdb] rounded text-sm px-3 py-2 focus:outline-none focus:border-[#a8a8a8] placeholder:text-[#737373]"
            />

            {error && (
              <p className="text-red-500 text-xs text-center pt-1">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading || !isFormValid}
              className="w-full mt-2 bg-[#0095f6] text-white font-semibold text-sm rounded-lg py-[7px] hover:bg-[#1877f2] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Rejestrowanie...' : 'Zarejestruj się'}
            </button>
          </form>

          <p className="text-[#737373] text-xs text-center mt-5 leading-4">
            Rejestrując się, zgadzasz się z naszymi{' '}
            <span className="font-semibold text-[#262626]">Warunkami korzystania z serwisu</span>
            {', '}
            <span className="font-semibold text-[#262626]">Polityką prywatności</span>
            {' '}oraz{' '}
            <span className="font-semibold text-[#262626]">Polityką dotyczącą plików cookie</span>.
          </p>
        </div>

        {/* Logowanie */}
        <div className="bg-white border border-[#dbdbdb] rounded py-4 text-center text-sm">
          Masz już konto?{' '}
          <Link href="/login" className="text-[#0095f6] font-semibold hover:underline">
            Zaloguj się
          </Link>
        </div>
      </div>
    </div>
  );
}
