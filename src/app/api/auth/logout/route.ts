import { NextResponse } from 'next/server';
import { authService } from '@/lib/services/auth.service';
import type { ApiError } from '@/lib/types';

/**
 * POST /api/auth/logout
 *
 * Invalidates the current user session and clears the session cookie.
 *
 * Requirements: 1.3
 */
export async function POST(request: Request) {
  try {
    // Extract session token from cookie or authorization header
    const cookieHeader = request.headers.get('cookie') ?? '';
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map((c) => {
        const [key, ...rest] = c.trim().split('=');
        return [key, rest.join('=')];
      })
    );
    const sessionToken =
      cookies['session-token'] ??
      request.headers.get('authorization')?.replace('Bearer ', '') ??
      '';

    // Invalidate session in Supabase (no-op if token is empty/invalid)
    await authService.logout(sessionToken);

    // Clear the session cookie
    const response = NextResponse.json(
      { message: 'Logged out successfully.' },
      { status: 200 }
    );

    response.cookies.set('session-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0, // Expire immediately
    });

    return response;
  } catch {
    const error: ApiError = {
      error: {
        code: 'server_error',
        message: 'An unexpected error occurred during logout.',
      },
    };
    return NextResponse.json(error, { status: 500 });
  }
}
