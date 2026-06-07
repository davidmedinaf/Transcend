import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/auth/role?userId=xxx
 * Returns the role for a given user ID. Uses admin client (bypasses RLS).
 * This is safe because knowing a role doesn't grant access — the middleware still enforces permissions.
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ role: null });
  }

  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single<{ role: string }>();

  return NextResponse.json({ role: data?.role ?? null });
}
