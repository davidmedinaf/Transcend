'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        if (authError.status === 429) {
          setError('Account temporarily locked due to too many failed attempts. Please try again in 15 minutes.');
        } else {
          setError('Invalid email or password.');
        }
        return;
      }

      if (!data.session) {
        setError('Authentication failed.');
        return;
      }

      // Redirect based on user role from profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single<{ role: string }>();

      if (profile?.role === 'admin') {
        window.location.href = '/admin';
      } else {
        window.location.href = '/';
      }
    } catch {
      setError('Unable to connect. Please check your internet connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-14rem)] items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Heading */}
        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl font-bold text-transcend-brown">
            Welcome Back
          </h1>
          <p className="mt-2 text-sm text-transcend-brown/70">
            Sign in to your Transcend account
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-brand border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-transcend-brown"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              disabled={isLoading}
              className="w-full rounded-brand border border-transcend-khaki/40 bg-white px-4 py-3 text-sm text-transcend-brown placeholder:text-transcend-brown/40 focus:border-transcend-gold focus:outline-none focus:ring-2 focus:ring-transcend-gold/20 disabled:opacity-50 transition-colors duration-brand"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-transcend-brown"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              disabled={isLoading}
              className="w-full rounded-brand border border-transcend-khaki/40 bg-white px-4 py-3 text-sm text-transcend-brown placeholder:text-transcend-brown/40 focus:border-transcend-gold focus:outline-none focus:ring-2 focus:ring-transcend-gold/20 disabled:opacity-50 transition-colors duration-brand"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-brand bg-transcend-sage px-4 py-3 text-sm font-semibold text-white transition-colors duration-brand hover:bg-transcend-sage/90 focus:outline-none focus:ring-2 focus:ring-transcend-sage/50 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Register Link */}
        <p className="mt-6 text-center text-sm text-transcend-brown/70">
          Don&apos;t have an account?{' '}
          <Link
            href="/register"
            className="font-medium text-transcend-gold hover:text-transcend-gold/80 transition-colors duration-brand"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
