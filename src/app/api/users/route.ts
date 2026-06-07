import { NextRequest, NextResponse } from 'next/server';
import { userManagementService } from '@/lib/services/user-management.service';
import type { ApiError } from '@/lib/types';

/**
 * GET /api/users — List users with pagination (admin only).
 * Query params: page (default 1), pageSize (default 20).
 * Requirements: 3.2
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10) || 20));

    const result = await userManagementService.listUsers({ page, pageSize });

    return NextResponse.json(result);
  } catch (error) {
    const apiError: ApiError = {
      error: {
        code: 'system_error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred.',
      },
    };
    return NextResponse.json(apiError, { status: 500 });
  }
}

/**
 * POST /api/users — Create a new user with role (admin only).
 * Body: { email: string, password: string, role: 'admin' | 'customer' }
 * Requirements: 3.1, 3.4, 3.5
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, role } = body;

    // Basic presence check before passing to service
    if (!email || !password || !role) {
      const apiError: ApiError = {
        error: {
          code: 'validation_error',
          message: 'Email, password, and role are required.',
          details: {
            ...(!email ? { email: 'Email is required.' } : {}),
            ...(!password ? { password: 'Password is required.' } : {}),
            ...(!role ? { role: 'Role is required.' } : {}),
          },
        },
      };
      return NextResponse.json(apiError, { status: 400 });
    }

    const result = await userManagementService.createUser({ email, password, role });

    if (!result.success) {
      const statusMap: Record<string, number> = {
        invalid_email: 400,
        invalid_password: 400,
        invalid_role: 400,
        email_taken: 409,
        system_error: 500,
      };

      const apiError: ApiError = {
        error: {
          code: result.error ?? 'system_error',
          message: result.message ?? 'User creation failed.',
        },
      };

      return NextResponse.json(apiError, { status: statusMap[result.error ?? 'system_error'] ?? 500 });
    }

    return NextResponse.json({ data: result.user }, { status: 201 });
  } catch (error) {
    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      const apiError: ApiError = {
        error: {
          code: 'invalid_request',
          message: 'Request body must be valid JSON.',
        },
      };
      return NextResponse.json(apiError, { status: 400 });
    }

    const apiError: ApiError = {
      error: {
        code: 'system_error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred.',
      },
    };
    return NextResponse.json(apiError, { status: 500 });
  }
}
