import { NextResponse } from 'next/server';
import { runSeed } from '@/lib/services/seed.service';
import type { ApiError } from '@/lib/types';

/**
 * POST /api/seed
 *
 * Triggers seed data loading to populate the database with Transcend's
 * service catalog. Admin only (enforced by middleware).
 * Idempotent: skips services that already exist.
 *
 * Returns the count of created and skipped services.
 *
 * Requirements: 14.1, 14.6, 14.7
 */
export async function POST() {
  try {
    const result = await runSeed();

    return NextResponse.json(
      {
        success: true,
        created: result.created,
        skipped: result.skipped,
      },
      { status: 200 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Seed operation failed.';

    const error: ApiError = {
      error: {
        code: 'seed_error',
        message,
      },
    };
    return NextResponse.json(error, { status: 500 });
  }
}
