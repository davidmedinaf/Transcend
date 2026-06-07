import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/auth/me
 * Returns the current user's id, email, and role.
 * Used by client components to check auth state and role.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    console.log('[/api/auth/me] getUser result:', user?.email ?? 'no user', error?.message ?? 'no error');

    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single<{ role: string }>();

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        role: profile?.role ?? 'customer',
      },
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
