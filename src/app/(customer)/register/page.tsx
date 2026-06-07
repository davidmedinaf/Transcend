'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  function validateForm(): boolean {
    const errors: { email?: string; password?: string; confirmPassword?: string } = {};

    // Email validation
    if (!email) {
      errors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address.';
    }

    // Password validation
    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    } else if (password.length > 128) {
      errors.password = 'Password must be no more than 128 characters.';
    }

    // Confirm password
    if (password && confirmPassword && password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    } else if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage = data.error?.message || 'Registration failed.';
        const errorCode = data.error?.code;

        // Map specific error codes to field-level errors
        if (errorCode === 'invalid_email') {
          setFieldErrors({ email: errorMessage });
        } else if (errorCode === 'invalid_password') {
          setFieldErrors({ password: errorMessage });
        } else {
          setError(errorMessage);
        }
        return;
      }

      // Registration successful — redirect to customer home
      router.push('/');
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
            Create Account
          </h1>
          <p className="mt-2 text-sm text-transcend-brown/70">
            Join Transcend Health Mallorca
          </p>
        </div>

        {/* General Error Display */}
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-brand border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {/* Registration Form */}
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
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }}
              placeholder="you@example.com"
              required
              autoComplete="email"
              disabled={isLoading}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              className={`w-full rounded-brand border bg-white px-4 py-3 text-sm text-transcend-brown placeholder:text-transcend-brown/40 focus:outline-none focus:ring-2 disabled:opacity-50 transition-colors duration-brand ${
                fieldErrors.email
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                  : 'border-transcend-khaki/40 focus:border-transcend-gold focus:ring-transcend-gold/20'
              }`}
            />
            {fieldErrors.email && (
              <p id="email-error" className="mt-1.5 text-xs text-red-600">
                {fieldErrors.email}
              </p>
            )}
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
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }}
              placeholder="Minimum 8 characters"
              required
              autoComplete="new-password"
              disabled={isLoading}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              className={`w-full rounded-brand border bg-white px-4 py-3 text-sm text-transcend-brown placeholder:text-transcend-brown/40 focus:outline-none focus:ring-2 disabled:opacity-50 transition-colors duration-brand ${
                fieldErrors.password
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                  : 'border-transcend-khaki/40 focus:border-transcend-gold focus:ring-transcend-gold/20'
              }`}
            />
            {fieldErrors.password && (
              <p id="password-error" className="mt-1.5 text-xs text-red-600">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="mb-1.5 block text-sm font-medium text-transcend-brown"
            >
              Confirm Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldErrors.confirmPassword) setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              }}
              placeholder="Repeat your password"
              required
              autoComplete="new-password"
              disabled={isLoading}
              aria-invalid={!!fieldErrors.confirmPassword}
              aria-describedby={fieldErrors.confirmPassword ? 'confirm-password-error' : undefined}
              className={`w-full rounded-brand border bg-white px-4 py-3 text-sm text-transcend-brown placeholder:text-transcend-brown/40 focus:outline-none focus:ring-2 disabled:opacity-50 transition-colors duration-brand ${
                fieldErrors.confirmPassword
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                  : 'border-transcend-khaki/40 focus:border-transcend-gold focus:ring-transcend-gold/20'
              }`}
            />
            {fieldErrors.confirmPassword && (
              <p id="confirm-password-error" className="mt-1.5 text-xs text-red-600">
                {fieldErrors.confirmPassword}
              </p>
            )}
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
                Creating account...
              </span>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Login Link */}
        <p className="mt-6 text-center text-sm text-transcend-brown/70">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-transcend-gold hover:text-transcend-gold/80 transition-colors duration-brand"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
