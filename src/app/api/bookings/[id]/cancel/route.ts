import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BookingService } from '@/lib/services/booking.service';

const bookingService = new BookingService();

/**
 * POST /api/bookings/[id]/cancel
 * Authenticated endpoint — cancels a booking.
 * Admin can cancel any booking; customer can only cancel their own.
 *
 * The BookingService.cancelBooking handles:
 * - Checking booking exists
 * - Already-cancelled guard (idempotency)
 * - Authorization (customer must own booking, or be admin)
 * - Updating status to 'cancelled' (releases the time slot via partial unique index)
 *
 * Requirements: 9.2, 9.3, 9.4, 9.6, 10.2
 */
export async function POST(
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

    // Cancel the booking — service handles auth + status checks
    const result = await bookingService.cancelBooking(bookingId, user.id);

    if (!result.success) {
      switch (result.error) {
        case 'not_found':
          return NextResponse.json(
            { error: { code: 'not_found', message: 'Booking not found' } },
            { status: 404 }
          );
        case 'already_cancelled':
          return NextResponse.json(
            {
              error: {
                code: 'already_cancelled',
                message: 'This booking has already been cancelled',
              },
            },
            { status: 409 }
          );
        case 'unauthorized':
          return NextResponse.json(
            {
              error: {
                code: 'forbidden',
                message: 'You do not have permission to cancel this booking',
              },
            },
            { status: 403 }
          );
        default:
          return NextResponse.json(
            {
              error: {
                code: 'system_error',
                message: 'Failed to cancel booking. Please try again.',
              },
            },
            { status: 500 }
          );
      }
    }

    return NextResponse.json({
      data: { success: true, message: 'Booking cancelled successfully' },
    });
  } catch (error) {
    console.error('POST /api/bookings/[id]/cancel error:', error);
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to cancel booking' } },
      { status: 500 }
    );
  }
}
