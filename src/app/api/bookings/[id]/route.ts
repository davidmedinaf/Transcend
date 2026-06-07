import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ─── DB Row Types ───────────────────────────────────────────────────────────

interface BookingRowWithJoins {
  id: string;
  tenant_id: string;
  customer_id: string;
  service_id: string;
  confirmation_id: string;
  start_time: string;
  end_time: string;
  price: number;
  status: 'confirmed' | 'cancelled';
  created_at: string;
  updated_at: string;
  services: { name: string } | null;
  profiles: { email: string } | null;
}

/**
 * GET /api/bookings/[id]
 * Authenticated endpoint — returns a single booking by ID.
 * Admin can view any booking; customer can only view their own.
 *
 * Requirements: 9.1, 10.1
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await params;
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Get user role
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile, error: profileError } = await (supabase as any)
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'No valid role assigned' } },
        { status: 401 }
      );
    }

    const profileData = profile as { role: string };

    // Fetch the booking with service and customer info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: booking, error: fetchError } = await (supabase as any)
      .from('bookings')
      .select(`
        *,
        services:service_id ( name ),
        profiles:customer_id ( email )
      `)
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    const bookingData = booking as BookingRowWithJoins;

    // Authorization: customers can only view their own bookings
    if (profileData.role === 'customer' && bookingData.customer_id !== user.id) {
      return NextResponse.json(
        { error: { code: 'forbidden', message: 'You can only view your own bookings' } },
        { status: 403 }
      );
    }

    // Serialize and return
    const serialized = {
      id: bookingData.id,
      tenantId: bookingData.tenant_id,
      customerId: bookingData.customer_id,
      serviceId: bookingData.service_id,
      serviceName: bookingData.services?.name ?? '',
      customerEmail: bookingData.profiles?.email ?? '',
      startTime: bookingData.start_time,
      endTime: bookingData.end_time,
      price: bookingData.price,
      status: bookingData.status,
      confirmationId: bookingData.confirmation_id,
      createdAt: bookingData.created_at,
    };

    return NextResponse.json({ data: serialized });
  } catch (error) {
    console.error('GET /api/bookings/[id] error:', error);
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to retrieve booking' } },
      { status: 500 }
    );
  }
}
