import { NextResponse, type NextRequest } from 'next/server';
import { ScheduleService } from '@/lib/services/schedule.service';
import type { AvailabilityBlock, DayOfWeek } from '@/lib/types';

const scheduleService = new ScheduleService();

/**
 * GET /api/availability/[serviceId]
 * Returns the availability blocks for a service.
 * Public endpoint — any authenticated user can view availability.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  const { serviceId } = await params;

  if (!serviceId) {
    return NextResponse.json(
      { error: { code: 'bad_request', message: 'Service ID is required' } },
      { status: 400 }
    );
  }

  try {
    const blocks = await scheduleService.getAvailability(serviceId);
    return NextResponse.json({ data: blocks });
  } catch {
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to fetch availability' } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/availability/[serviceId]
 * Sets or updates availability blocks for a service.
 * Admin only — middleware enforces authentication and role check.
 *
 * Body: array of availability blocks with dayOfWeek, startTime, endTime.
 * Validates:
 * - 15-minute increments for start/end times
 * - end time > start time
 * - No overlapping blocks on the same day
 * - Block duration >= service duration
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  const { serviceId } = await params;

  if (!serviceId) {
    return NextResponse.json(
      { error: { code: 'bad_request', message: 'Service ID is required' } },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'bad_request', message: 'Invalid JSON body' } },
      { status: 400 }
    );
  }

  // Validate body is an array
  if (!Array.isArray(body)) {
    return NextResponse.json(
      { error: { code: 'bad_request', message: 'Request body must be an array of availability blocks' } },
      { status: 400 }
    );
  }

  // Validate each block has required fields
  const blocks: AvailabilityBlock[] = [];
  for (let i = 0; i < body.length; i++) {
    const item = body[i];
    const validationError = validateBlockInput(item, i);
    if (validationError) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: validationError } },
        { status: 400 }
      );
    }

    blocks.push({
      id: item.id || '',
      serviceId,
      dayOfWeek: item.dayOfWeek as DayOfWeek,
      startTime: item.startTime,
      endTime: item.endTime,
    });
  }

  try {
    const result = await scheduleService.setAvailability(serviceId, blocks);

    if (!result.success) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: result.error || 'Validation failed' } },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to update availability' } },
      { status: 500 }
    );
  }
}

/**
 * Validates a single block input object has the correct shape and types.
 * Returns an error message string if invalid, or null if valid.
 */
function validateBlockInput(item: unknown, index: number): string | null {
  if (!item || typeof item !== 'object') {
    return `Block ${index + 1}: must be an object`;
  }

  const block = item as Record<string, unknown>;

  // dayOfWeek: integer 0-6
  if (
    typeof block.dayOfWeek !== 'number' ||
    !Number.isInteger(block.dayOfWeek) ||
    block.dayOfWeek < 0 ||
    block.dayOfWeek > 6
  ) {
    return `Block ${index + 1}: dayOfWeek must be an integer between 0 and 6`;
  }

  // startTime: string in HH:MM format
  if (typeof block.startTime !== 'string' || !isValidTimeFormat(block.startTime)) {
    return `Block ${index + 1}: startTime must be a string in HH:MM format`;
  }

  // endTime: string in HH:MM format
  if (typeof block.endTime !== 'string' || !isValidTimeFormat(block.endTime)) {
    return `Block ${index + 1}: endTime must be a string in HH:MM format`;
  }

  return null;
}

/**
 * Validates a time string is in HH:MM format (basic shape check).
 * The ScheduleService handles 15-min alignment validation.
 */
function isValidTimeFormat(time: string): boolean {
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}
