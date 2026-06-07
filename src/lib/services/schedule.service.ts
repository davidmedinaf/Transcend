import { createAdminClient } from '@/lib/supabase/admin';
import type {
  AvailabilityBlock,
  TimeSlot,
  DayOfWeek,
  Booking,
} from '@/lib/types';

// ─── Result Types ───────────────────────────────────────────────────────────

export interface ScheduleResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export interface DateRange {
  start: Date;
  end: Date;
}

// ─── Interface ──────────────────────────────────────────────────────────────

export interface IScheduleService {
  setAvailability(serviceId: string, blocks: AvailabilityBlock[]): Promise<ScheduleResult>;
  getAvailability(serviceId: string): Promise<AvailabilityBlock[]>;
  generateTimeSlots(serviceId: string, dateRange: DateRange): Promise<TimeSlot[]>;
}

// ─── Validation Helpers (exported for testing) ──────────────────────────────

/**
 * Checks whether a time string (HH:MM) is aligned to a 15-minute increment.
 */
export function isAligned15Min(time: string): boolean {
  const parts = time.split(':');
  if (parts.length !== 2) return false;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return false;
  if (hours < 0 || hours > 23) return false;
  if (minutes < 0 || minutes > 59) return false;
  return minutes % 15 === 0;
}

/**
 * Converts a time string (HH:MM) to total minutes since midnight.
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Checks whether two availability blocks overlap on the same day.
 * Two blocks overlap if one starts before the other ends.
 */
export function blocksOverlap(
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string }
): boolean {
  const aStart = timeToMinutes(a.startTime);
  const aEnd = timeToMinutes(a.endTime);
  const bStart = timeToMinutes(b.startTime);
  const bEnd = timeToMinutes(b.endTime);
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Validates a single availability block:
 * - end > start
 * - 15-min alignment for both start and end
 * - block duration >= serviceDuration
 */
export function validateBlock(
  block: { dayOfWeek: DayOfWeek; startTime: string; endTime: string },
  serviceDuration: number
): string | null {
  // Validate day of week
  if (block.dayOfWeek < 0 || block.dayOfWeek > 6) {
    return 'Day of week must be between 0 (Sunday) and 6 (Saturday)';
  }

  // Validate time format
  if (!isAligned15Min(block.startTime)) {
    return `Start time '${block.startTime}' is not aligned to a 15-minute increment`;
  }
  if (!isAligned15Min(block.endTime)) {
    return `End time '${block.endTime}' is not aligned to a 15-minute increment`;
  }

  // Validate end > start
  const startMinutes = timeToMinutes(block.startTime);
  const endMinutes = timeToMinutes(block.endTime);
  if (endMinutes <= startMinutes) {
    return 'End time must be after start time';
  }

  // Validate block duration >= service duration
  const blockDuration = endMinutes - startMinutes;
  if (blockDuration < serviceDuration) {
    return `Block duration (${blockDuration} min) must be at least the service duration (${serviceDuration} min)`;
  }

  return null;
}

// ─── Pure Time Slot Generation (exported for property testing) ──────────────

/**
 * Pure function to generate time slots from availability blocks without DB dependency.
 * This implements the contiguous slot algorithm from the design document.
 *
 * For each date in the range:
 *   1. Get the day-of-week
 *   2. Find matching availability blocks for that day
 *   3. For each block, generate contiguous slots of serviceDuration
 *   4. Mark slots as unavailable if there's a confirmed booking at that start_time
 *   5. First slot starts at block startTime, slots are contiguous, discard remaining time < duration
 */
export function generateTimeSlotsFromBlocks(
  serviceId: string,
  blocks: AvailabilityBlock[],
  serviceDuration: number,
  dateRange: DateRange,
  existingBookings: Array<{ startTime: Date; status: string }>
): TimeSlot[] {
  const slots: TimeSlot[] = [];

  // Iterate over each date in the range (inclusive)
  const current = new Date(dateRange.start);
  current.setHours(0, 0, 0, 0);

  const endDate = new Date(dateRange.end);
  endDate.setHours(23, 59, 59, 999);

  while (current <= endDate) {
    const dayOfWeek = current.getDay() as DayOfWeek;
    const blocksForDay = blocks.filter((b) => b.dayOfWeek === dayOfWeek);

    for (const block of blocksForDay) {
      const blockStartMinutes = timeToMinutes(block.startTime);
      const blockEndMinutes = timeToMinutes(block.endTime);

      let slotStartMinutes = blockStartMinutes;

      while (slotStartMinutes + serviceDuration <= blockEndMinutes) {
        const slotEndMinutes = slotStartMinutes + serviceDuration;

        // Create Date objects for this slot
        const slotStart = new Date(current);
        slotStart.setHours(Math.floor(slotStartMinutes / 60), slotStartMinutes % 60, 0, 0);

        const slotEnd = new Date(current);
        slotEnd.setHours(Math.floor(slotEndMinutes / 60), slotEndMinutes % 60, 0, 0);

        // Check if there's a confirmed booking at this start time
        const isBooked = existingBookings.some(
          (b) =>
            b.status === 'confirmed' &&
            b.startTime.getTime() === slotStart.getTime()
        );

        slots.push({
          serviceId,
          startTime: slotStart,
          endTime: slotEnd,
          isAvailable: !isBooked,
        });

        // Move to next contiguous slot (no gap)
        slotStartMinutes = slotEndMinutes;
      }
      // Remaining time < serviceDuration is discarded
    }

    // Advance to next day
    current.setDate(current.getDate() + 1);
  }

  return slots;
}

// ─── DB Row Types ───────────────────────────────────────────────────────────

interface AvailabilityRow {
  id: string;
  tenant_id: string;
  service_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
}

interface BookingRow {
  id: string;
  start_time: string;
  status: string;
}

// ─── Row-to-Domain Mapper ───────────────────────────────────────────────────

function mapRowToBlock(row: AvailabilityRow): AvailabilityBlock {
  return {
    id: row.id,
    serviceId: row.service_id,
    dayOfWeek: row.day_of_week as DayOfWeek,
    startTime: row.start_time.substring(0, 5), // Ensure HH:MM format
    endTime: row.end_time.substring(0, 5),
  };
}

// ─── Service Implementation ─────────────────────────────────────────────────

export class ScheduleService implements IScheduleService {
  /**
   * Sets the availability for a service, replacing all existing blocks.
   * Validates each block and checks for overlaps within the same day.
   * Existing confirmed bookings are NOT affected.
   */
  async setAvailability(
    serviceId: string,
    blocks: AvailabilityBlock[]
  ): Promise<ScheduleResult> {
    const supabase = createAdminClient();

    // First, get the service to check its duration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: serviceData, error: serviceError } = await (supabase as any)
      .from('services')
      .select('duration_minutes')
      .eq('id', serviceId)
      .single();

    if (serviceError || !serviceData) {
      return { success: false, error: 'Service not found' };
    }

    const serviceDuration = (serviceData as { duration_minutes: number }).duration_minutes;

    // Validate each block individually
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const validationError = validateBlock(
        { dayOfWeek: block.dayOfWeek, startTime: block.startTime, endTime: block.endTime },
        serviceDuration
      );
      if (validationError) {
        return {
          success: false,
          error: `Block ${i + 1}: ${validationError}`,
        };
      }
    }

    // Check for overlaps within the same day
    const blocksByDay = new Map<DayOfWeek, Array<{ startTime: string; endTime: string; index: number }>>();
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const dayBlocks = blocksByDay.get(block.dayOfWeek) ?? [];
      dayBlocks.push({ startTime: block.startTime, endTime: block.endTime, index: i });
      blocksByDay.set(block.dayOfWeek, dayBlocks);
    }

    for (const [day, dayBlocks] of blocksByDay) {
      for (let i = 0; i < dayBlocks.length; i++) {
        for (let j = i + 1; j < dayBlocks.length; j++) {
          if (blocksOverlap(dayBlocks[i], dayBlocks[j])) {
            return {
              success: false,
              error: `Blocks ${dayBlocks[i].index + 1} and ${dayBlocks[j].index + 1} overlap on day ${day}`,
            };
          }
        }
      }
    }

    // Delete existing blocks for this service, then insert new ones
    // This does NOT affect existing bookings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any)
      .from('availability_schedules')
      .delete()
      .eq('service_id', serviceId);

    if (deleteError) {
      return { success: false, error: (deleteError as { message: string }).message };
    }

    // Insert new blocks (if any)
    if (blocks.length > 0) {
      const insertRows = blocks.map((block) => ({
        service_id: serviceId,
        day_of_week: block.dayOfWeek,
        start_time: block.startTime,
        end_time: block.endTime,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await (supabase as any)
        .from('availability_schedules')
        .insert(insertRows);

      if (insertError) {
        return { success: false, error: (insertError as { message: string }).message };
      }
    }

    return { success: true };
  }

  /**
   * Gets the current availability blocks for a service.
   */
  async getAvailability(serviceId: string): Promise<AvailabilityBlock[]> {
    const supabase = createAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (supabase as any)
      .from('availability_schedules')
      .select('*')
      .eq('service_id', serviceId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (error || !rows) {
      return [];
    }

    return (rows as AvailabilityRow[]).map(mapRowToBlock);
  }

  /**
   * Generates time slots for a service within a date range.
   * Uses the contiguous slot algorithm and marks slots with confirmed bookings as unavailable.
   */
  async generateTimeSlots(serviceId: string, dateRange: DateRange): Promise<TimeSlot[]> {
    const supabase = createAdminClient();

    // Get the service duration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: serviceData, error: serviceError } = await (supabase as any)
      .from('services')
      .select('duration_minutes')
      .eq('id', serviceId)
      .single();

    if (serviceError || !serviceData) {
      return [];
    }

    const serviceDuration = (serviceData as { duration_minutes: number }).duration_minutes;

    // Get availability blocks
    const blocks = await this.getAvailability(serviceId);

    // Get existing confirmed bookings for this service within the date range
    const rangeStart = dateRange.start.toISOString();
    const rangeEnd = dateRange.end.toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bookingRows, error: bookingError } = await (supabase as any)
      .from('bookings')
      .select('id, start_time, status')
      .eq('service_id', serviceId)
      .eq('status', 'confirmed')
      .gte('start_time', rangeStart)
      .lte('start_time', rangeEnd);

    const existingBookings: Array<{ startTime: Date; status: string }> = [];
    if (!bookingError && bookingRows) {
      for (const row of bookingRows as BookingRow[]) {
        existingBookings.push({
          startTime: new Date(row.start_time),
          status: row.status,
        });
      }
    }

    // Use the pure function for generation
    return generateTimeSlotsFromBlocks(
      serviceId,
      blocks,
      serviceDuration,
      dateRange,
      existingBookings
    );
  }
}

// ─── Export Validation Helpers (for testing) ────────────────────────────────

export type { AvailabilityRow, BookingRow };
