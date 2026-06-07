import { NextResponse } from 'next/server';
import { authService } from '@/lib/services/auth.service';
import type { ApiError } from '@/lib/types';

/**
 * POST /api/auth/login
 *
 * Authenticates a user with email and password.
 * Returns session with token and user info on success.
 * Sets session cookie for subsequent requests.
 *
 * Requirements: 2.1, 2.2, 2.3
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Basic presence check
    if (!email || !password) {
      const error: ApiError = {
        error: {
          code: 'validation_error',
          message: 'Email and password are required.',
        },
      };
      return NextResponse.json(error, { status: 400 });
    }

    const result = await authService.login(email, password);

    if (!result.success) {
      const errorMap: Record<string, { status: number; message: string }> = {
        invalid_credentials: {
          status: 401,
          message: 'Invalid email or password.',
        },
        account_locked: {
          status: 429,
          message:
            'Account temporarily locked due to too many failed attempts. Please try again in 15 minutes.',
        },
      };

      const mapped = errorMap[result.error!] ?? {
        status: 401,
        message: 'Authentication failed.',
      };

      const error: ApiError = {
        error: {
          code: result.error!,
          message: mapped.message,
        },
      };
      return NextResponse.json(error, { status: mapped.status });
    }

    // Build response with session cookie
    const response = NextResponse.json(
      { session: result.session },
      { status: 200 }
    );

    // Set session token as HTTP-only cookie for subsequent requests
    response.cookies.set('session-token', result.session!.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60, // 1 hour (matches session expiry)
    });

    return response;
  } catch {
    const error: ApiError = {
      error: {
        code: 'server_error',
        message: 'An unexpected error occurred. Please try again.',
      },
    };
    return NextResponse.json(error, { status: 500 });
  }
}
