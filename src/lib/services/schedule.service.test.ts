import { describe, it, expect } from 'vitest';
import {
  isAligned15Min,
  timeToMinutes,
  blocksOverlap,
  validateBlock,
  generateTimeSlotsFromBlocks,
} from './schedule.service';
import type { AvailabilityBlock, DayOfWeek } from '@/lib/types';

// ─── isAligned15Min ─────────────────────────────────────────────────────────

describe('isAligned15Min', () => {
  it('accepts times aligned to 15-min increments', () => {
    expect(isAligned15Min('00:00')).toBe(true);
    expect(isAligned15Min('00:15')).toBe(true);
    expect(isAligned15Min('00:30')).toBe(true);
    expect(isAligned15Min('00:45')).toBe(true);
    expect(isAligned15Min('09:00')).toBe(true);
    expect(isAligned15Min('23:45')).toBe(true);
    expect(isAligned15Min('12:30')).toBe(true);
  });

  it('rejects times not aligned to 15-min increments', () => {
    expect(isAligned15Min('00:01')).toBe(false);
    expect(isAligned15Min('00:10')).toBe(false);
    expect(isAligned15Min('09:05')).toBe(false);
    expect(isAligned15Min('14:22')).toBe(false);
    expect(isAligned15Min('23:59')).toBe(false);
  });

  it('rejects invalid time formats', () => {
    expect(isAligned15Min('')).toBe(false);
    expect(isAligned15Min('abc')).toBe(false);
    expect(isAligned15Min('25:00')).toBe(false);
    expect(isAligned15Min('12:60')).toBe(false);
    expect(isAligned15Min('-1:00')).toBe(false);
  });
});

// ─── timeToMinutes ──────────────────────────────────────────────────────────

describe('timeToMinutes', () => {
  it('converts HH:MM to total minutes', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('01:00')).toBe(60);
    expect(timeToMinutes('09:30')).toBe(570);
    expect(timeToMinutes('23:45')).toBe(1425);
    expect(timeToMinutes('12:15')).toBe(735);
  });
});

// ─── blocksOverlap ──────────────────────────────────────────────────────────

describe('blocksOverlap', () => {
  it('detects overlapping blocks', () => {
    expect(
      blocksOverlap(
        { startTime: '09:00', endTime: '11:00' },
        { startTime: '10:00', endTime: '12:00' }
      )
    ).toBe(true);
  });

  it('detects one block contained within another', () => {
    expect(
      blocksOverlap(
        { startTime: '09:00', endTime: '17:00' },
        { startTime: '10:00', endTime: '12:00' }
      )
    ).toBe(true);
  });

  it('returns false for non-overlapping blocks', () => {
    expect(
      blocksOverlap(
        { startTime: '09:00', endTime: '11:00' },
        { startTime: '11:00', endTime: '13:00' }
      )
    ).toBe(false);
  });

  it('returns false for blocks that are adjacent (touching)', () => {
    expect(
      blocksOverlap(
        { startTime: '09:00', endTime: '10:00' },
        { startTime: '10:00', endTime: '11:00' }
      )
    ).toBe(false);
  });

  it('returns false for completely separate blocks', () => {
    expect(
      blocksOverlap(
        { startTime: '08:00', endTime: '09:00' },
        { startTime: '14:00', endTime: '16:00' }
      )
    ).toBe(false);
  });
});

// ─── validateBlock ──────────────────────────────────────────────────────────

describe('validateBlock', () => {
  it('accepts a valid block', () => {
    const result = validateBlock(
      { dayOfWeek: 1 as DayOfWeek, startTime: '09:00', endTime: '12:00' },
      60
    );
    expect(result).toBeNull();
  });

  it('rejects block where end <= start', () => {
    const result = validateBlock(
      { dayOfWeek: 1 as DayOfWeek, startTime: '12:00', endTime: '09:00' },
      60
    );
    expect(result).toContain('End time must be after start time');
  });

  it('rejects block where end == start', () => {
    const result = validateBlock(
      { dayOfWeek: 1 as DayOfWeek, startTime: '09:00', endTime: '09:00' },
      60
    );
    expect(result).toContain('End time must be after start time');
  });

  it('rejects non-aligned start time', () => {
    const result = validateBlock(
      { dayOfWeek: 1 as DayOfWeek, startTime: '09:07', endTime: '12:00' },
      60
    );
    expect(result).toContain('not aligned to a 15-minute increment');
  });

  it('rejects non-aligned end time', () => {
    const result = validateBlock(
      { dayOfWeek: 1 as DayOfWeek, startTime: '09:00', endTime: '12:10' },
      60
    );
    expect(result).toContain('not aligned to a 15-minute increment');
  });

  it('rejects block shorter than service duration', () => {
    const result = validateBlock(
      { dayOfWeek: 1 as DayOfWeek, startTime: '09:00', endTime: '09:30' },
      60
    );
    expect(result).toContain('must be at least the service duration');
  });

  it('accepts block exactly equal to service duration', () => {
    const result = validateBlock(
      { dayOfWeek: 1 as DayOfWeek, startTime: '09:00', endTime: '10:00' },
      60
    );
    expect(result).toBeNull();
  });
});

// ─── generateTimeSlotsFromBlocks ────────────────────────────────────────────

describe('generateTimeSlotsFromBlocks', () => {
  const serviceId = 'test-service-id';

  it('generates contiguous slots for a single block', () => {
    const blocks: AvailabilityBlock[] = [
      {
        id: 'block-1',
        serviceId,
        dayOfWeek: 1 as DayOfWeek, // Monday
        startTime: '09:00',
        endTime: '12:00',
      },
    ];

    // Pick a Monday
    const monday = new Date('2025-01-06'); // A Monday
    const dateRange = { start: monday, end: monday };

    const slots = generateTimeSlotsFromBlocks(serviceId, blocks, 60, dateRange, []);

    // 3 hours / 60 min = 3 slots
    expect(slots).toHaveLength(3);
    expect(slots[0].startTime.getHours()).toBe(9);
    expect(slots[0].startTime.getMinutes()).toBe(0);
    expect(slots[0].endTime.getHours()).toBe(10);
    expect(slots[0].endTime.getMinutes()).toBe(0);
    expect(slots[1].startTime.getHours()).toBe(10);
    expect(slots[1].endTime.getHours()).toBe(11);
    expect(slots[2].startTime.getHours()).toBe(11);
    expect(slots[2].endTime.getHours()).toBe(12);
    // All available
    expect(slots.every((s) => s.isAvailable)).toBe(true);
  });

  it('discards remaining time shorter than service duration', () => {
    const blocks: AvailabilityBlock[] = [
      {
        id: 'block-1',
        serviceId,
        dayOfWeek: 1 as DayOfWeek,
        startTime: '09:00',
        endTime: '11:30', // 150 min, 60 min service => 2 slots, 30 min discarded
      },
    ];

    const monday = new Date('2025-01-06');
    const dateRange = { start: monday, end: monday };

    const slots = generateTimeSlotsFromBlocks(serviceId, blocks, 60, dateRange, []);

    expect(slots).toHaveLength(2);
    // Last slot ends at 11:00, leaving 30 min discarded
    expect(slots[1].endTime.getHours()).toBe(11);
    expect(slots[1].endTime.getMinutes()).toBe(0);
  });

  it('marks booked slots as unavailable', () => {
    const blocks: AvailabilityBlock[] = [
      {
        id: 'block-1',
        serviceId,
        dayOfWeek: 1 as DayOfWeek,
        startTime: '09:00',
        endTime: '12:00',
      },
    ];

    const monday = new Date('2025-01-06');
    const dateRange = { start: monday, end: monday };

    // Book the 10:00 slot
    const bookedTime = new Date('2025-01-06');
    bookedTime.setHours(10, 0, 0, 0);

    const existingBookings = [{ startTime: bookedTime, status: 'confirmed' }];

    const slots = generateTimeSlotsFromBlocks(
      serviceId,
      blocks,
      60,
      dateRange,
      existingBookings
    );

    expect(slots).toHaveLength(3);
    expect(slots[0].isAvailable).toBe(true); // 09:00
    expect(slots[1].isAvailable).toBe(false); // 10:00 - booked
    expect(slots[2].isAvailable).toBe(true); // 11:00
  });

  it('does not mark cancelled bookings as unavailable', () => {
    const blocks: AvailabilityBlock[] = [
      {
        id: 'block-1',
        serviceId,
        dayOfWeek: 1 as DayOfWeek,
        startTime: '09:00',
        endTime: '11:00',
      },
    ];

    const monday = new Date('2025-01-06');
    const dateRange = { start: monday, end: monday };

    const cancelledTime = new Date('2025-01-06');
    cancelledTime.setHours(9, 0, 0, 0);

    const existingBookings = [{ startTime: cancelledTime, status: 'cancelled' }];

    const slots = generateTimeSlotsFromBlocks(
      serviceId,
      blocks,
      60,
      dateRange,
      existingBookings
    );

    expect(slots).toHaveLength(2);
    expect(slots[0].isAvailable).toBe(true); // cancelled booking doesn't block
    expect(slots[1].isAvailable).toBe(true);
  });

  it('generates slots across multiple days in range', () => {
    const blocks: AvailabilityBlock[] = [
      {
        id: 'block-1',
        serviceId,
        dayOfWeek: 1 as DayOfWeek, // Monday
        startTime: '09:00',
        endTime: '10:00',
      },
      {
        id: 'block-2',
        serviceId,
        dayOfWeek: 3 as DayOfWeek, // Wednesday
        startTime: '14:00',
        endTime: '15:00',
      },
    ];

    // Mon Jan 6 through Fri Jan 10
    const dateRange = {
      start: new Date('2025-01-06'),
      end: new Date('2025-01-10'),
    };

    const slots = generateTimeSlotsFromBlocks(serviceId, blocks, 60, dateRange, []);

    // 1 slot on Monday (09:00-10:00), 1 slot on Wednesday (14:00-15:00)
    expect(slots).toHaveLength(2);
    expect(slots[0].startTime.getDay()).toBe(1); // Monday
    expect(slots[1].startTime.getDay()).toBe(3); // Wednesday
  });

  it('returns empty array when no blocks match the date range days', () => {
    const blocks: AvailabilityBlock[] = [
      {
        id: 'block-1',
        serviceId,
        dayOfWeek: 6 as DayOfWeek, // Saturday
        startTime: '09:00',
        endTime: '12:00',
      },
    ];

    // Only Mon-Fri
    const dateRange = {
      start: new Date('2025-01-06'), // Monday
      end: new Date('2025-01-10'), // Friday
    };

    const slots = generateTimeSlotsFromBlocks(serviceId, blocks, 60, dateRange, []);
    expect(slots).toHaveLength(0);
  });

  it('handles 15-minute service duration with contiguous slots', () => {
    const blocks: AvailabilityBlock[] = [
      {
        id: 'block-1',
        serviceId,
        dayOfWeek: 1 as DayOfWeek,
        startTime: '09:00',
        endTime: '10:00', // 60 min / 15 min = 4 slots
      },
    ];

    const monday = new Date('2025-01-06');
    const dateRange = { start: monday, end: monday };

    const slots = generateTimeSlotsFromBlocks(serviceId, blocks, 15, dateRange, []);

    expect(slots).toHaveLength(4);
    // Verify contiguity: each slot's end = next slot's start
    for (let i = 0; i < slots.length - 1; i++) {
      expect(slots[i].endTime.getTime()).toBe(slots[i + 1].startTime.getTime());
    }
  });

  it('all slots have correct serviceId', () => {
    const blocks: AvailabilityBlock[] = [
      {
        id: 'block-1',
        serviceId,
        dayOfWeek: 1 as DayOfWeek,
        startTime: '09:00',
        endTime: '11:00',
      },
    ];

    const monday = new Date('2025-01-06');
    const dateRange = { start: monday, end: monday };

    const slots = generateTimeSlotsFromBlocks(serviceId, blocks, 30, dateRange, []);
    expect(slots.every((s) => s.serviceId === serviceId)).toBe(true);
  });
});
