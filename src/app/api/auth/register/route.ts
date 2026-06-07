import { NextResponse } from 'next/server';
import { authService } from '@/lib/services/auth.service';
import type { ApiError } from '@/lib/types';

/**
 * POST /api/auth/register
 *
 * Registers a new customer account with email and password.
 * Returns authenticated session on success or ApiError on failure.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.5
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

    const result = await authService.register(email, password);

    if (!result.success) {
      const errorMap: Record<string, { status: number; message: string }> = {
        invalid_email: {
          status: 400,
          message: 'The email address format is invalid.',
        },
        invalid_password: {
          status: 400,
          message: 'Password must be between 8 and 128 characters.',
        },
        email_taken: {
          status: 409,
          message: 'An account with this email already exists.',
        },
        invalid_credentials: {
          status: 400,
          message: 'Registration failed. Please try again.',
        },
      };

      const mapped = errorMap[result.error!] ?? {
        status: 400,
        message: 'Registration failed.',
      };

      const error: ApiError = {
        error: {
          code: result.error!,
          message: mapped.message,
        },
      };
      return NextResponse.json(error, { status: mapped.status });
    }

    return NextResponse.json(
      { session: result.session },
      { status: 200 }
    );
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
