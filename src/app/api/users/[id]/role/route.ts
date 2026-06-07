import { NextRequest, NextResponse } from 'next/server';
import { userManagementService } from '@/lib/services/user-management.service';
import type { ApiError } from '@/lib/types';

/**
 * PATCH /api/users/[id]/role — Change a user's role (admin only).
 * Body: { role: 'admin' | 'customer' }
 * Requirements: 3.3, 3.6
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;

    if (!userId) {
      const apiError: ApiError = {
        error: {
          code: 'validation_error',
          message: 'User ID is required.',
        },
      };
      return NextResponse.json(apiError, { status: 400 });
    }

    const body = await request.json();
    const { role } = body;

    if (!role) {
      const apiError: ApiError = {
        error: {
          code: 'validation_error',
          message: 'Role is required.',
          details: { role: 'Role must be either "admin" or "customer".' },
        },
      };
      return NextResponse.json(apiError, { status: 400 });
    }

    const result = await userManagementService.changeUserRole(userId, role);

    if (!result.success) {
      const statusMap: Record<string, number> = {
        invalid_role: 400,
        user_not_found: 404,
        last_admin: 409,
        system_error: 500,
      };

      const apiError: ApiError = {
        error: {
          code: result.error ?? 'system_error',
          message: result.message ?? 'Role change failed.',
        },
      };

      return NextResponse.json(apiError, { status: statusMap[result.error ?? 'system_error'] ?? 500 });
    }

    return NextResponse.json({ data: result.user });
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
