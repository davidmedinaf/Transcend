import { NextRequest, NextResponse } from 'next/server';
import { ScheduleService } from '@/lib/services/schedule.service';
import type { ApiError } from '@/lib/types';

/**
 * GET /api/timeslots/[serviceId]
 * Returns available time slots for the next 14 days for a given service.
 * Filters out already-booked slots — only returns slots where isAvailable === true.
 *
 * Validates: Requirements 7.1, 7.4
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;

    if (!serviceId) {
      const error: ApiError = {
        error: {
          code: 'missing_service_id',
          message: 'Service ID is required',
        },
      };
      return NextResponse.json(error, { status: 400 });
    }

    // Calculate date range: today to today + 14 days
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 14);
    end.setHours(23, 59, 59, 999);

    // Generate all time slots for the service in the date range
    const scheduleService = new ScheduleService();
    const allSlots = await scheduleService.generateTimeSlots(serviceId, { start, end });

    // Filter to only return available slots (not already booked)
    const availableSlots = allSlots.filter((slot) => slot.isAvailable);

    return NextResponse.json({ data: availableSlots }, { status: 200 });
  } catch (err) {
    console.error('Error fetching timeslots:', err);
    const error: ApiError = {
      error: {
        code: 'system_error',
        message: 'Failed to retrieve available time slots',
      },
    };
    return NextResponse.json(error, { status: 500 });
  }
}
