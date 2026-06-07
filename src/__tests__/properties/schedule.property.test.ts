import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  generateTimeSlotsFromBlocks,
  isAligned15Min,
  timeToMinutes,
  blocksOverlap,
  validateBlock,
} from '@/lib/services/schedule.service';
import type { AvailabilityBlock, DayOfWeek } from '@/lib/types';

// ─── Generators ─────────────────────────────────────────────────────────────

/** Generate a valid 15-min aligned time string HH:MM */
const aligned15MinTime = () =>
  fc
    .record({
      hours: fc.integer({ min: 0, max: 23 }),
      quarters: fc.integer({ min: 0, max: 3 }),
    })
    .map(({ hours, quarters }) => {
      const h = hours.toString().padStart(2, '0');
      const m = (quarters * 15).toString().padStart(2, '0');
      return `${h}:${m}`;
    });

/** Generate a valid availability block where start < end and both 15-min aligned */
const validAvailabilityBlock = (minDuration?: number) =>
  fc
    .record({
      dayOfWeek: fc.integer({ min: 0, max: 6 }) as fc.Arbitrary<DayOfWeek>,
      // Start in range 0..94 (0:00..23:30), leaving room for at least 15 min
      startQuarter: fc.integer({ min: 0, max: 94 }),
      // Ensure end > start with at least minDuration (in 15-min increments)
      extraQuarters: fc.integer({ min: 1, max: 20 }),
    })
    .filter(({ startQuarter, extraQuarters }) => {
      const endQuarter = startQuarter + extraQuarters;
      return endQuarter <= 95; // max 23:45 → quarter 95
    })
    .map(({ dayOfWeek, startQuarter, extraQuarters }) => {
      const endQuarter = startQuarter + extraQuarters;
      const startH = Math.floor(startQuarter / 4)
        .toString()
        .padStart(2, '0');
      const startM = ((startQuarter % 4) * 15).toString().padStart(2, '0');
      const endH = Math.floor(endQuarter / 4)
        .toString()
        .padStart(2, '0');
      const endM = ((endQuarter % 4) * 15).toString().padStart(2, '0');
      return {
        id: 'block-1',
        serviceId: 'svc-1',
        dayOfWeek,
        startTime: `${startH}:${startM}`,
        endTime: `${endH}:${endM}`,
      } as AvailabilityBlock;
    })
    .filter((block) => {
      if (minDuration !== undefined) {
        const duration = timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
        return duration >= minDuration;
      }
      return true;
    });

/** Generate a valid service duration that fits within a block */
const serviceDurationForBlock = (blockDurationMinutes: number) =>
  fc.integer({
    min: 15,
    max: Math.min(blockDurationMinutes, 480),
  }).filter((d) => d % 15 === 0); // Keep durations as 15-min multiples for clean slots

// ─── Property 7: Time slot generation correctness ───────────────────────────

/**
 * Property 7: Time slot generation correctness
 *
 * For any availability block with start_time S, end_time E, and associated service
 * with duration D minutes, the generated time slots SHALL satisfy:
 * 1. The first slot starts at S
 * 2. Each slot has duration exactly D minutes
 * 3. Slots are contiguous (slot[n].end == slot[n+1].start)
 * 4. The last slot ends at or before E
 * 5. The remaining time (E - last_slot.end) is strictly less than D
 * 6. The total number of slots equals floor((E - S) / D)
 *
 * **Validates: Requirements 5.2**
 */
describe('Property 7: Time slot generation correctness', () => {
  it('first slot starts at block start time', () => {
    fc.assert(
      fc.property(
        validAvailabilityBlock(15),
        fc.integer({ min: 15, max: 240 }),
        (block: AvailabilityBlock, durationBase: number) => {
          const blockDuration = timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
          // Ensure duration fits within the block
          const duration = Math.min(durationBase, blockDuration);
          if (duration < 1) return; // skip trivial case

          // Use a fixed date that matches the block's dayOfWeek
          const baseDate = new Date(2025, 0, 5); // Sunday = 0
          // Find the next date that matches dayOfWeek
          const date = new Date(baseDate);
          while (date.getDay() !== block.dayOfWeek) {
            date.setDate(date.getDate() + 1);
          }

          const slots = generateTimeSlotsFromBlocks(
            'svc-1',
            [block],
            duration,
            { start: date, end: date },
            []
          );

          if (slots.length > 0) {
            const firstSlot = slots[0];
            const expectedStartMinutes = timeToMinutes(block.startTime);
            const actualStartMinutes =
              firstSlot.startTime.getHours() * 60 + firstSlot.startTime.getMinutes();
            expect(actualStartMinutes).toBe(expectedStartMinutes);
          }
        }
      ),
      { numRuns: 300 }
    );
  });

  it('each slot has duration exactly D minutes', () => {
    fc.assert(
      fc.property(
        validAvailabilityBlock(15),
        fc.integer({ min: 15, max: 120 }),
        (block: AvailabilityBlock, durationBase: number) => {
          const blockDuration = timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
          const duration = Math.min(durationBase, blockDuration);
          if (duration < 1) return;

          const baseDate = new Date(2025, 0, 5);
          const date = new Date(baseDate);
          while (date.getDay() !== block.dayOfWeek) {
            date.setDate(date.getDate() + 1);
          }

          const slots = generateTimeSlotsFromBlocks(
            'svc-1',
            [block],
            duration,
            { start: date, end: date },
            []
          );

          for (const slot of slots) {
            const slotDurationMs = slot.endTime.getTime() - slot.startTime.getTime();
            const slotDurationMinutes = slotDurationMs / (1000 * 60);
            expect(slotDurationMinutes).toBe(duration);
          }
        }
      ),
      { numRuns: 300 }
    );
  });

  it('slots are contiguous (slot[n].end == slot[n+1].start)', () => {
    fc.assert(
      fc.property(
        validAvailabilityBlock(30),
        fc.integer({ min: 15, max: 60 }),
        (block: AvailabilityBlock, durationBase: number) => {
          const blockDuration = timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
          const duration = Math.min(durationBase, blockDuration);
          if (duration < 1) return;

          const baseDate = new Date(2025, 0, 5);
          const date = new Date(baseDate);
          while (date.getDay() !== block.dayOfWeek) {
            date.setDate(date.getDate() + 1);
          }

          const slots = generateTimeSlotsFromBlocks(
            'svc-1',
            [block],
            duration,
            { start: date, end: date },
            []
          );

          for (let i = 0; i < slots.length - 1; i++) {
            expect(slots[i].endTime.getTime()).toBe(slots[i + 1].startTime.getTime());
          }
        }
      ),
      { numRuns: 300 }
    );
  });

  it('last slot ends at or before block end time', () => {
    fc.assert(
      fc.property(
        validAvailabilityBlock(15),
        fc.integer({ min: 15, max: 120 }),
        (block: AvailabilityBlock, durationBase: number) => {
          const blockDuration = timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
          const duration = Math.min(durationBase, blockDuration);
          if (duration < 1) return;

          const baseDate = new Date(2025, 0, 5);
          const date = new Date(baseDate);
          while (date.getDay() !== block.dayOfWeek) {
            date.setDate(date.getDate() + 1);
          }

          const slots = generateTimeSlotsFromBlocks(
            'svc-1',
            [block],
            duration,
            { start: date, end: date },
            []
          );

          if (slots.length > 0) {
            const lastSlot = slots[slots.length - 1];
            const lastEndMinutes =
              lastSlot.endTime.getHours() * 60 + lastSlot.endTime.getMinutes();
            const blockEndMinutes = timeToMinutes(block.endTime);
            expect(lastEndMinutes).toBeLessThanOrEqual(blockEndMinutes);
          }
        }
      ),
      { numRuns: 300 }
    );
  });

  it('remaining time (E - last_slot.end) < D', () => {
    fc.assert(
      fc.property(
        validAvailabilityBlock(15),
        fc.integer({ min: 15, max: 120 }),
        (block: AvailabilityBlock, durationBase: number) => {
          const blockDuration = timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
          const duration = Math.min(durationBase, blockDuration);
          if (duration < 1) return;

          const baseDate = new Date(2025, 0, 5);
          const date = new Date(baseDate);
          while (date.getDay() !== block.dayOfWeek) {
            date.setDate(date.getDate() + 1);
          }

          const slots = generateTimeSlotsFromBlocks(
            'svc-1',
            [block],
            duration,
            { start: date, end: date },
            []
          );

          if (slots.length > 0) {
            const lastSlot = slots[slots.length - 1];
            const lastEndMinutes =
              lastSlot.endTime.getHours() * 60 + lastSlot.endTime.getMinutes();
            const blockEndMinutes = timeToMinutes(block.endTime);
            const remaining = blockEndMinutes - lastEndMinutes;
            expect(remaining).toBeLessThan(duration);
          }
        }
      ),
      { numRuns: 300 }
    );
  });

  it('total slots = floor((E - S) / D)', () => {
    fc.assert(
      fc.property(
        validAvailabilityBlock(15),
        fc.integer({ min: 15, max: 120 }),
        (block: AvailabilityBlock, durationBase: number) => {
          const blockDuration = timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
          const duration = Math.min(durationBase, blockDuration);
          if (duration < 1) return;

          const baseDate = new Date(2025, 0, 5);
          const date = new Date(baseDate);
          while (date.getDay() !== block.dayOfWeek) {
            date.setDate(date.getDate() + 1);
          }

          const slots = generateTimeSlotsFromBlocks(
            'svc-1',
            [block],
            duration,
            { start: date, end: date },
            []
          );

          const expectedSlots = Math.floor(blockDuration / duration);
          expect(slots.length).toBe(expectedSlots);
        }
      ),
      { numRuns: 300 }
    );
  });
});

// ─── Property 8: Availability block validation ──────────────────────────────

/**
 * Property 8: Availability block validation
 *
 * For any availability block submission, the system SHALL reject the block if:
 * (a) end_time ≤ start_time, OR
 * (b) start_time or end_time is not aligned to a 15-minute increment, OR
 * (c) the block duration (end_time - start_time) is less than the associated service's duration, OR
 * (d) the block overlaps with an existing block for the same service on the same day.
 *
 * **Validates: Requirements 5.5, 5.6, 5.7**
 */
describe('Property 8: Availability block validation', () => {
  it('rejects blocks where end <= start', () => {
    fc.assert(
      fc.property(
        aligned15MinTime(),
        aligned15MinTime(),
        fc.integer({ min: 0, max: 6 }) as fc.Arbitrary<DayOfWeek>,
        (time1: string, time2: string, dayOfWeek: DayOfWeek) => {
          const start = time1 > time2 ? time1 : time2; // larger time as start
          const end = time1 > time2 ? time2 : time1; // smaller time as end (or equal)

          // Only test when end <= start (skip equal times which may not be generated)
          if (timeToMinutes(end) >= timeToMinutes(start)) return;

          const result = validateBlock({ dayOfWeek, startTime: start, endTime: end }, 15);
          expect(result).not.toBeNull();
          expect(result!.toLowerCase()).toContain('end time must be after start time');
        }
      ),
      { numRuns: 300 }
    );
  });

  it('rejects blocks where end equals start', () => {
    fc.assert(
      fc.property(
        aligned15MinTime(),
        fc.integer({ min: 0, max: 6 }) as fc.Arbitrary<DayOfWeek>,
        (time: string, dayOfWeek: DayOfWeek) => {
          const result = validateBlock(
            { dayOfWeek, startTime: time, endTime: time },
            15
          );
          expect(result).not.toBeNull();
          expect(result!.toLowerCase()).toContain('end time must be after start time');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('rejects blocks with non-15-min aligned start time', () => {
    // Generate times that are NOT 15-min aligned
    const nonAlignedMinute = fc
      .integer({ min: 0, max: 59 })
      .filter((m) => m % 15 !== 0);

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        nonAlignedMinute,
        fc.integer({ min: 0, max: 6 }) as fc.Arbitrary<DayOfWeek>,
        (hour: number, minute: number, dayOfWeek: DayOfWeek) => {
          const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          const result = validateBlock(
            { dayOfWeek, startTime, endTime: '23:45' },
            15
          );
          expect(result).not.toBeNull();
          expect(result!.toLowerCase()).toContain('start time');
          expect(result!.toLowerCase()).toContain('15-minute');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('rejects blocks with non-15-min aligned end time', () => {
    const nonAlignedMinute = fc
      .integer({ min: 0, max: 59 })
      .filter((m) => m % 15 !== 0);

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        nonAlignedMinute,
        fc.integer({ min: 0, max: 6 }) as fc.Arbitrary<DayOfWeek>,
        (hour: number, minute: number, dayOfWeek: DayOfWeek) => {
          const endTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          const result = validateBlock(
            { dayOfWeek, startTime: '00:00', endTime },
            15
          );
          // Since endTime might be < start, it could also fail on end > start check
          // But if endTime > 00:00, it should specifically mention 15-minute alignment
          if (timeToMinutes(endTime) > 0) {
            expect(result).not.toBeNull();
            expect(result!.toLowerCase()).toContain('15-minute');
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('rejects blocks where duration < service duration', () => {
    fc.assert(
      fc.property(
        validAvailabilityBlock(15),
        fc.integer({ min: 1, max: 480 }),
        (block: AvailabilityBlock, serviceDuration: number) => {
          const blockDuration = timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
          // Only test when service duration exceeds block duration
          if (serviceDuration <= blockDuration) return;

          const result = validateBlock(
            { dayOfWeek: block.dayOfWeek, startTime: block.startTime, endTime: block.endTime },
            serviceDuration
          );
          expect(result).not.toBeNull();
          expect(result!.toLowerCase()).toContain('service duration');
        }
      ),
      { numRuns: 300 }
    );
  });

  it('accepts valid blocks (end > start, 15-min aligned, duration >= service duration)', () => {
    fc.assert(
      fc.property(
        validAvailabilityBlock(15),
        (block: AvailabilityBlock) => {
          const blockDuration = timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
          // Use a service duration that fits within the block
          const serviceDuration = Math.min(15, blockDuration);

          const result = validateBlock(
            { dayOfWeek: block.dayOfWeek, startTime: block.startTime, endTime: block.endTime },
            serviceDuration
          );
          expect(result).toBeNull();
        }
      ),
      { numRuns: 300 }
    );
  });

  it('blocksOverlap detects overlapping time ranges', () => {
    fc.assert(
      fc.property(
        // Generate two blocks that definitionally overlap
        fc.integer({ min: 0, max: 90 }),
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 1, max: 9 }),
        (startQuarter: number, widthA: number, overlapOffset: number) => {
          // Block A: startQuarter to startQuarter + widthA
          // Block B: starts within A, so it overlaps
          const aStartQ = startQuarter;
          const aEndQ = startQuarter + widthA;
          // B starts before A ends (ensure overlap)
          const bStartQ = aStartQ + Math.min(overlapOffset, widthA - 1);
          const bEndQ = bStartQ + widthA;

          // Ensure all are within valid time range (0-95)
          if (aEndQ > 95 || bEndQ > 95) return;

          const toTime = (q: number) => {
            const h = Math.floor(q / 4).toString().padStart(2, '0');
            const m = ((q % 4) * 15).toString().padStart(2, '0');
            return `${h}:${m}`;
          };

          const a = { startTime: toTime(aStartQ), endTime: toTime(aEndQ) };
          const b = { startTime: toTime(bStartQ), endTime: toTime(bEndQ) };

          expect(blocksOverlap(a, b)).toBe(true);
        }
      ),
      { numRuns: 300 }
    );
  });

  it('blocksOverlap returns false for non-overlapping ranges', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 44 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        (startQuarter: number, widthA: number, widthB: number) => {
          // Block A ends before Block B starts (no overlap)
          const aStartQ = startQuarter;
          const aEndQ = startQuarter + widthA;
          const bStartQ = aEndQ; // B starts exactly where A ends (no overlap by definition)
          const bEndQ = bStartQ + widthB;

          if (bEndQ > 95) return;

          const toTime = (q: number) => {
            const h = Math.floor(q / 4).toString().padStart(2, '0');
            const m = ((q % 4) * 15).toString().padStart(2, '0');
            return `${h}:${m}`;
          };

          const a = { startTime: toTime(aStartQ), endTime: toTime(aEndQ) };
          const b = { startTime: toTime(bStartQ), endTime: toTime(bEndQ) };

          expect(blocksOverlap(a, b)).toBe(false);
        }
      ),
      { numRuns: 300 }
    );
  });

  it('isAligned15Min accepts valid 15-minute aligned times', () => {
    fc.assert(
      fc.property(aligned15MinTime(), (time: string) => {
        expect(isAligned15Min(time)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('isAligned15Min rejects non-aligned times', () => {
    const nonAlignedMinute = fc
      .integer({ min: 0, max: 59 })
      .filter((m) => m % 15 !== 0);

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        nonAlignedMinute,
        (hour: number, minute: number) => {
          const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          expect(isAligned15Min(time)).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ─── Property 9: Schedule changes preserve confirmed bookings ───────────────

/**
 * Property 9: Schedule changes preserve confirmed bookings
 *
 * For any modification to a service's availability schedule, all existing bookings
 * with status 'confirmed' SHALL remain unchanged in their start_time, end_time,
 * status, and all other fields.
 *
 * **Validates: Requirements 5.4**
 */
describe('Property 9: Schedule changes preserve confirmed bookings', () => {
  it('generateTimeSlotsFromBlocks does not mutate existing booking data', () => {
    fc.assert(
      fc.property(
        validAvailabilityBlock(30),
        fc.integer({ min: 15, max: 60 }),
        fc.array(
          fc.record({
            startTime: fc.date({ min: new Date(2025, 0, 1), max: new Date(2025, 11, 31) }),
            status: fc.constantFrom('confirmed', 'cancelled'),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (block: AvailabilityBlock, duration: number, bookings) => {
          const blockDuration = timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
          const serviceDuration = Math.min(duration, blockDuration);
          if (serviceDuration < 1) return;

          // Deep copy bookings to compare later
          const bookingsBefore = bookings.map((b) => ({
            startTime: new Date(b.startTime.getTime()),
            status: b.status,
          }));

          // Find a date matching the block's day of week
          const baseDate = new Date(2025, 0, 5);
          const date = new Date(baseDate);
          while (date.getDay() !== block.dayOfWeek) {
            date.setDate(date.getDate() + 1);
          }

          // Call generateTimeSlotsFromBlocks — this should NOT mutate bookings
          generateTimeSlotsFromBlocks(
            'svc-1',
            [block],
            serviceDuration,
            { start: date, end: date },
            bookings
          );

          // Verify bookings array is unchanged
          expect(bookings.length).toBe(bookingsBefore.length);
          for (let i = 0; i < bookings.length; i++) {
            expect(bookings[i].startTime.getTime()).toBe(bookingsBefore[i].startTime.getTime());
            expect(bookings[i].status).toBe(bookingsBefore[i].status);
          }
        }
      ),
      { numRuns: 300 }
    );
  });

  it('schedule changes (new blocks) do not affect booking slot availability marking for confirmed bookings', () => {
    fc.assert(
      fc.property(
        validAvailabilityBlock(60),
        (block: AvailabilityBlock) => {
          const blockDuration = timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
          const serviceDuration = 30;
          if (blockDuration < serviceDuration) return;

          // Find a date matching the block's day of week
          const baseDate = new Date(2025, 0, 5);
          const date = new Date(baseDate);
          while (date.getDay() !== block.dayOfWeek) {
            date.setDate(date.getDate() + 1);
          }

          // Create a confirmed booking at the block start time
          const bookingStart = new Date(date);
          bookingStart.setHours(
            Math.floor(timeToMinutes(block.startTime) / 60),
            timeToMinutes(block.startTime) % 60,
            0,
            0
          );

          const confirmedBooking = {
            startTime: bookingStart,
            status: 'confirmed',
          };

          // Generate slots with original block
          const slotsOriginal = generateTimeSlotsFromBlocks(
            'svc-1',
            [block],
            serviceDuration,
            { start: date, end: date },
            [confirmedBooking]
          );

          // Modify the schedule — add a different block (simulating schedule change)
          // The booking should still be marked as unavailable
          const modifiedBlock = { ...block, id: 'block-2' };
          const slotsAfterChange = generateTimeSlotsFromBlocks(
            'svc-1',
            [modifiedBlock],
            serviceDuration,
            { start: date, end: date },
            [confirmedBooking]
          );

          // The confirmed booking's slot should be unavailable in both cases
          const originalBookedSlot = slotsOriginal.find(
            (s) => s.startTime.getTime() === bookingStart.getTime()
          );
          const changedBookedSlot = slotsAfterChange.find(
            (s) => s.startTime.getTime() === bookingStart.getTime()
          );

          if (originalBookedSlot) {
            expect(originalBookedSlot.isAvailable).toBe(false);
          }
          if (changedBookedSlot) {
            expect(changedBookedSlot.isAvailable).toBe(false);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('confirmed bookings remain unchanged regardless of which availability blocks are provided', () => {
    fc.assert(
      fc.property(
        fc.array(validAvailabilityBlock(15), { minLength: 1, maxLength: 5 }),
        fc.array(validAvailabilityBlock(15), { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 15, max: 60 }),
        (blocksA, blocksB, duration) => {
          // Use a fixed date range
          const date = new Date(2025, 0, 6); // Monday = 1

          // Create some confirmed bookings
          const booking1Start = new Date(date);
          booking1Start.setHours(10, 0, 0, 0);
          const booking2Start = new Date(date);
          booking2Start.setHours(14, 30, 0, 0);

          const confirmedBookings = [
            { startTime: booking1Start, status: 'confirmed' },
            { startTime: booking2Start, status: 'confirmed' },
          ];

          // Deep copy to verify no mutation
          const bookingsCopy = confirmedBookings.map((b) => ({
            startTime: new Date(b.startTime.getTime()),
            status: b.status,
          }));

          // Generate slots with schedule A
          generateTimeSlotsFromBlocks('svc-1', blocksA, duration, { start: date, end: date }, confirmedBookings);

          // Verify bookings are unchanged after first call
          expect(confirmedBookings[0].startTime.getTime()).toBe(bookingsCopy[0].startTime.getTime());
          expect(confirmedBookings[0].status).toBe(bookingsCopy[0].status);
          expect(confirmedBookings[1].startTime.getTime()).toBe(bookingsCopy[1].startTime.getTime());
          expect(confirmedBookings[1].status).toBe(bookingsCopy[1].status);

          // Generate slots with schedule B (schedule change)
          generateTimeSlotsFromBlocks('svc-1', blocksB, duration, { start: date, end: date }, confirmedBookings);

          // Verify bookings are STILL unchanged after schedule change
          expect(confirmedBookings[0].startTime.getTime()).toBe(bookingsCopy[0].startTime.getTime());
          expect(confirmedBookings[0].status).toBe(bookingsCopy[0].status);
          expect(confirmedBookings[1].startTime.getTime()).toBe(bookingsCopy[1].startTime.getTime());
          expect(confirmedBookings[1].status).toBe(bookingsCopy[1].status);
        }
      ),
      { numRuns: 200 }
    );
  });
});
