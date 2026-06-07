import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { BookingService } from '@/lib/services/booking.service';

const bookingService = new BookingService();

/**
 * GET /api/bookings
 * Authenticated endpoint — returns bookings based on user role:
 * - Admin: paginated list with optional filters (dateFrom, dateTo, serviceId)
 * - Customer: own bookings split by type (upcoming/past)
 *
 * Query params:
 *   Admin: page, pageSize, dateFrom, dateTo, serviceId
 *   Customer: type ('upcoming' | 'past', defaults to 'upcoming')
 *
 * Requirements: 9.1, 9.5, 10.1, 10.3
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

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

    // Get user role from profiles using admin client (bypasses RLS)
    const { data: profile, error: profileError } = await adminClient
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
    const { searchParams } = new URL(request.url);

    // If `type` param is present (upcoming/past), always return the user's own bookings
    // regardless of role. This is the customer-facing view.
    const type = searchParams.get('type') as 'upcoming' | 'past' | null;

    if (type) {
      // Customer view: own bookings by type (used by /bookings page for any user)
      const validType = type === 'past' ? 'past' : 'upcoming';
      const bookings = await bookingService.getBookingsByCustomer(user.id, validType);

      return NextResponse.json({
        data: bookings.map(serializeBooking),
        type: validType,
      });
    } else if (profileData.role === 'admin') {
      // Admin paginated view (used by admin dashboard): all bookings with filters
      const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
      const pageSize = Math.min(
        100,
        Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10) || 20)
      );

      const dateFrom = searchParams.get('dateFrom')
        ? new Date(searchParams.get('dateFrom')!)
        : undefined;
      const dateTo = searchParams.get('dateTo')
        ? new Date(searchParams.get('dateTo')!)
        : undefined;
      const serviceId = searchParams.get('serviceId') ?? undefined;

      const result = await bookingService.getBookingsAdmin(
        { dateFrom, dateTo, serviceId },
        { page, pageSize }
      );

      return NextResponse.json({
        data: result.data.map(serializeBooking),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      });
    } else {
      // Non-admin without type param: default to upcoming
      const bookings = await bookingService.getBookingsByCustomer(user.id, 'upcoming');

      return NextResponse.json({
        data: bookings.map(serializeBooking),
        type: 'upcoming',
      });
    }
  } catch (error) {
    console.error('GET /api/bookings error:', error);
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to retrieve bookings' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bookings
 * Customer endpoint — creates a new booking.
 * Body: { serviceId: string, slotStart: string (ISO datetime) }
 *
 * Requirements: 7.3, 7.5
 */
export async function POST(request: NextRequest) {
  try {
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

    // Parse request body
    const body = await request.json();
    const { serviceId, slotStart } = body;

    // Validate required fields
    if (!serviceId || !slotStart) {
      return NextResponse.json(
        {
          error: {
            code: 'validation_error',
            message: 'serviceId and slotStart are required',
            details: {
              ...(serviceId ? {} : { serviceId: 'serviceId is required' }),
              ...(slotStart ? {} : { slotStart: 'slotStart is required' }),
            },
          },
        },
        { status: 400 }
      );
    }

    // Parse and validate slotStart date
    const slotStartDate = new Date(slotStart);
    if (isNaN(slotStartDate.getTime())) {
      return NextResponse.json(
        {
          error: {
            code: 'validation_error',
            message: 'slotStart must be a valid ISO datetime string',
            details: { slotStart: 'Invalid date format' },
          },
        },
        { status: 400 }
      );
    }

    // Create the booking
    const result = await bookingService.createBooking(user.id, serviceId, slotStartDate);

    if (!result.success) {
      if (result.error === 'slot_unavailable') {
        return NextResponse.json(
          {
            error: {
              code: 'slot_unavailable',
              message: 'This time slot was just booked. Please select another.',
            },
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          error: {
            code: 'system_error',
            message: 'Failed to create booking. Please try again.',
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: serializeBooking(result.booking!) }, { status: 201 });
  } catch (error) {
    console.error('POST /api/bookings error:', error);
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to create booking' } },
      { status: 500 }
    );
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function serializeBooking(booking: {
  id: string;
  tenantId: string;
  customerId: string;
  serviceId: string;
  serviceName: string;
  customerEmail: string;
  startTime: Date;
  endTime: Date;
  price: number;
  status: string;
  confirmationId: string;
  createdAt: Date;
}) {
  return {
    id: booking.id,
    tenantId: booking.tenantId,
    customerId: booking.customerId,
    serviceId: booking.serviceId,
    serviceName: booking.serviceName,
    customerEmail: booking.customerEmail,
    startTime: booking.startTime.toISOString(),
    endTime: booking.endTime.toISOString(),
    price: booking.price,
    status: booking.status,
    confirmationId: booking.confirmationId,
    createdAt: booking.createdAt.toISOString(),
  };
}
