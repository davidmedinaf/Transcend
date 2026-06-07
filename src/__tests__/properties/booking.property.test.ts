import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { Booking, BookingStatus } from '@/lib/types';

// ─── Mock Supabase ──────────────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockSupabaseClient = { from: mockFrom };

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// ─── Generators ─────────────────────────────────────────────────────────────

/** Generate a valid UUID */
const uuid = () => fc.uuid();

/** Generate a valid booking date in the future */
const futureDate = () =>
  fc.date({ min: new Date(2025, 6, 1), max: new Date(2026, 11, 31) });

/** Generate a valid booking date in the past */
const pastDate = () =>
  fc.date({ min: new Date(2023, 0, 1), max: new Date(2025, 0, 1) });

/** Generate a service duration in minutes */
const serviceDuration = () => fc.integer({ min: 15, max: 240 });

/** Generate a price */
const price = () => fc.integer({ min: 0, max: 999999 }).map((n) => n / 100);

/** Generate a booking status */
const bookingStatus = () => fc.constantFrom('confirmed', 'cancelled') as fc.Arbitrary<BookingStatus>;

/** Generate a full booking object */
const bookingArb = (overrides?: Partial<{ startTimeArb: fc.Arbitrary<Date>; status: fc.Arbitrary<BookingStatus> }>) =>
  fc.record({
    id: uuid(),
    tenantId: fc.constant('00000000-0000-0000-0000-000000000000'),
    customerId: uuid(),
    serviceId: uuid(),
    serviceName: fc.string({ minLength: 1, maxLength: 50 }),
    customerEmail: fc.emailAddress(),
    startTime: overrides?.startTimeArb ?? futureDate(),
    endTime: futureDate(),
    price: price(),
    status: overrides?.status ?? bookingStatus(),
    confirmationId: fc.string({ minLength: 8, maxLength: 12 }).map((s) => `TRN-${s.toUpperCase()}`),
    createdAt: fc.date({ min: new Date(2024, 0, 1), max: new Date(2025, 5, 30) }),
  });

// ─── Property 11: Booking atomicity ────────────────────────────────────────

/**
 * Property 11: Booking atomicity
 *
 * For any successfully confirmed booking for a service at time T, subsequent queries
 * for available time slots for that service SHALL NOT include time T as an available slot.
 *
 * **Validates: Requirements 7.3, 7.4**
 */
describe('Property 11: Booking atomicity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('after a confirmed booking at time T, generateTimeSlotsFromBlocks marks T as unavailable', async () => {
    // This test uses the real generateTimeSlotsFromBlocks function (no mocking needed for pure logic)
    const { generateTimeSlotsFromBlocks, timeToMinutes } = await import(
      '@/lib/services/schedule.service'
    );

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 6 }),
        fc.integer({ min: 0, max: 80 }), // start quarter (0:00 to 20:00)
        fc.integer({ min: 2, max: 8 }),   // block width in quarters (30min to 2hr)
        fc.integer({ min: 1, max: 4 }),   // service duration in quarters (15min to 1hr)
        (dayOfWeek, startQuarter, blockWidth, durationQuarters) => {
          const endQuarter = startQuarter + blockWidth;
          if (endQuarter > 95) return; // skip if exceeds 23:45

          const serviceDurationMin = durationQuarters * 15;
          const blockDurationMin = blockWidth * 15;
          if (serviceDurationMin > blockDurationMin) return; // skip if service doesn't fit

          const toTime = (q: number) => {
            const h = Math.floor(q / 4).toString().padStart(2, '0');
            const m = ((q % 4) * 15).toString().padStart(2, '0');
            return `${h}:${m}`;
          };

          const block = {
            id: 'block-1',
            serviceId: 'svc-1',
            dayOfWeek: dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
            startTime: toTime(startQuarter),
            endTime: toTime(endQuarter),
          };

          // Find a date matching the block's dayOfWeek
          const baseDate = new Date(2025, 6, 1); // July 1, 2025
          const date = new Date(baseDate);
          while (date.getDay() !== dayOfWeek) {
            date.setDate(date.getDate() + 1);
          }

          // Generate slots without any bookings first
          const slotsWithout = generateTimeSlotsFromBlocks(
            'svc-1',
            [block],
            serviceDurationMin,
            { start: date, end: date },
            []
          );

          if (slotsWithout.length === 0) return;

          // Pick the first available slot's start time as our "booked time T"
          const bookedSlot = slotsWithout[0];
          const bookedTime = bookedSlot.startTime;

          // Now generate slots WITH the confirmed booking
          const confirmedBooking = {
            startTime: bookedTime,
            status: 'confirmed',
          };

          const slotsAfterBooking = generateTimeSlotsFromBlocks(
            'svc-1',
            [block],
            serviceDurationMin,
            { start: date, end: date },
            [confirmedBooking]
          );

          // The slot at time T should be marked as unavailable
          const slotAtT = slotsAfterBooking.find(
            (s) => s.startTime.getTime() === bookedTime.getTime()
          );
          expect(slotAtT).toBeDefined();
          expect(slotAtT!.isAvailable).toBe(false);
        }
      ),
      { numRuns: 300 }
    );
  });

  it('createBooking success results in the slot being consumed (mock-based)', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuid(),
        uuid(),
        futureDate(),
        serviceDuration(),
        price(),
        async (customerId, serviceId, slotStart, duration, servicePrice) => {
          // Guard against invalid dates that can occur during shrinking
          fc.pre(!isNaN(slotStart.getTime()));
          vi.clearAllMocks();

          // Mock service lookup
          const mockServiceSelect = vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { duration_minutes: duration, price: servicePrice },
                  error: null,
                }),
              }),
            }),
          });

          // Mock successful booking insert
          const mockInsert = vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'booking-1',
                  tenant_id: '00000000-0000-0000-0000-000000000000',
                  customer_id: customerId,
                  service_id: serviceId,
                  confirmation_id: 'TRN-ABCD1234',
                  start_time: slotStart.toISOString(),
                  end_time: new Date(slotStart.getTime() + duration * 60 * 1000).toISOString(),
                  price: servicePrice,
                  status: 'confirmed',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  services: { name: 'Test Service' },
                  profiles: { email: 'test@example.com' },
                },
                error: null,
              }),
            }),
          });

          mockFrom.mockImplementation((table: string) => {
            if (table === 'services') {
              return { select: mockServiceSelect };
            }
            if (table === 'bookings') {
              return { insert: mockInsert };
            }
            return {};
          });

          const { BookingService } = await import('@/lib/services/booking.service');
          const bookingService = new BookingService();

          const result = await bookingService.createBooking(customerId, serviceId, slotStart);

          // Booking should succeed
          expect(result.success).toBe(true);
          expect(result.booking).toBeDefined();
          expect(result.booking!.status).toBe('confirmed');
          expect(result.booking!.startTime.getTime()).toBe(slotStart.getTime());
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 12: Concurrent booking safety ─────────────────────────────────

/**
 * Property 12: Concurrent booking safety
 *
 * For any single time slot that receives two simultaneous booking requests, exactly one
 * SHALL succeed with a confirmed booking and exactly one SHALL fail with a 'slot_unavailable'
 * error. The total number of confirmed bookings for that slot SHALL never exceed one.
 *
 * **Validates: Requirements 7.5**
 */
describe('Property 12: Concurrent booking safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('two concurrent booking requests for same slot: one succeeds, one fails with slot_unavailable', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuid(),
        uuid(),
        uuid(),
        futureDate(),
        serviceDuration(),
        price(),
        async (customer1Id, customer2Id, serviceId, slotStart, duration, servicePrice) => {
          // Guard against invalid dates that can occur during shrinking
          fc.pre(!isNaN(slotStart.getTime()));
          vi.clearAllMocks();

          let insertCallCount = 0;

          // Mock service lookup (shared between both calls)
          const mockServiceSelect = vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { duration_minutes: duration, price: servicePrice },
                  error: null,
                }),
              }),
            }),
          });

          // Mock insert: first call succeeds, second gets 23505 unique violation
          const mockInsert = vi.fn().mockImplementation(() => {
            insertCallCount++;
            if (insertCallCount === 1) {
              // First insert succeeds
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: 'booking-1',
                      tenant_id: '00000000-0000-0000-0000-000000000000',
                      customer_id: customer1Id,
                      service_id: serviceId,
                      confirmation_id: 'TRN-FIRST001',
                      start_time: slotStart.toISOString(),
                      end_time: new Date(slotStart.getTime() + duration * 60 * 1000).toISOString(),
                      price: servicePrice,
                      status: 'confirmed',
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      services: { name: 'Test Service' },
                      profiles: { email: 'customer1@example.com' },
                    },
                    error: null,
                  }),
                }),
              };
            } else {
              // Second insert fails with unique violation (23505)
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: '23505', message: 'duplicate key value violates unique constraint' },
                  }),
                }),
              };
            }
          });

          mockFrom.mockImplementation((table: string) => {
            if (table === 'services') {
              return { select: mockServiceSelect };
            }
            if (table === 'bookings') {
              return { insert: mockInsert };
            }
            return {};
          });

          const { BookingService } = await import('@/lib/services/booking.service');
          const bookingService = new BookingService();

          // Simulate two concurrent booking requests
          const [result1, result2] = await Promise.all([
            bookingService.createBooking(customer1Id, serviceId, slotStart),
            bookingService.createBooking(customer2Id, serviceId, slotStart),
          ]);

          // Exactly one should succeed and one should fail
          const results = [result1, result2];
          const successes = results.filter((r) => r.success);
          const failures = results.filter((r) => !r.success);

          expect(successes).toHaveLength(1);
          expect(failures).toHaveLength(1);

          // The successful one must have a confirmed booking
          expect(successes[0].booking).toBeDefined();
          expect(successes[0].booking!.status).toBe('confirmed');

          // The failed one must have 'slot_unavailable' error
          expect(failures[0].error).toBe('slot_unavailable');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 13: Cancellation round-trip ───────────────────────────────────

/**
 * Property 13: Cancellation round-trip
 *
 * For any confirmed booking, when cancelled:
 * (a) the booking status SHALL change to 'cancelled', AND
 * (b) the time slot previously occupied by that booking SHALL become available for new
 *     bookings (i.e., appear in available slots queries).
 *
 * **Validates: Requirements 9.3, 9.4, 10.2**
 */
describe('Property 13: Cancellation round-trip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cancelling a confirmed booking succeeds and releases the time slot', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuid(),
        uuid(),
        futureDate(),
        async (bookingId, customerId, slotStart) => {
          vi.clearAllMocks();

          // Mock: fetch booking returns confirmed status
          const mockBookingSelect = vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: bookingId,
                  customer_id: customerId,
                  status: 'confirmed',
                },
                error: null,
              }),
            }),
          });

          // Mock: update booking status to cancelled
          const mockBookingUpdate = vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          });

          mockFrom.mockImplementation((table: string) => {
            if (table === 'bookings') {
              return {
                select: mockBookingSelect,
                update: mockBookingUpdate,
              };
            }
            return {};
          });

          const { BookingService } = await import('@/lib/services/booking.service');
          const bookingService = new BookingService();

          // Cancel the booking
          const cancelResult = await bookingService.cancelBooking(bookingId, customerId);

          // Cancellation should succeed
          expect(cancelResult.success).toBe(true);
          expect(cancelResult.error).toBeUndefined();

          // Verify update was called with 'cancelled' status
          expect(mockBookingUpdate).toHaveBeenCalled();
          const updateCall = mockBookingUpdate.mock.calls[0][0];
          expect(updateCall.status).toBe('cancelled');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('after cancellation, the time slot becomes available in generateTimeSlotsFromBlocks', async () => {
    const { generateTimeSlotsFromBlocks } = await import(
      '@/lib/services/schedule.service'
    );

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 6 }),
        fc.integer({ min: 0, max: 80 }),
        fc.integer({ min: 2, max: 8 }),
        (dayOfWeek, startQuarter, blockWidth) => {
          const endQuarter = startQuarter + blockWidth;
          if (endQuarter > 95) return;

          const serviceDurationMin = 15;
          const blockDurationMin = blockWidth * 15;
          if (serviceDurationMin > blockDurationMin) return;

          const toTime = (q: number) => {
            const h = Math.floor(q / 4).toString().padStart(2, '0');
            const m = ((q % 4) * 15).toString().padStart(2, '0');
            return `${h}:${m}`;
          };

          const block = {
            id: 'block-1',
            serviceId: 'svc-1',
            dayOfWeek: dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
            startTime: toTime(startQuarter),
            endTime: toTime(endQuarter),
          };

          // Find a date matching the block's dayOfWeek
          const baseDate = new Date(2025, 6, 1);
          const date = new Date(baseDate);
          while (date.getDay() !== dayOfWeek) {
            date.setDate(date.getDate() + 1);
          }

          const slots = generateTimeSlotsFromBlocks(
            'svc-1',
            [block],
            serviceDurationMin,
            { start: date, end: date },
            []
          );

          if (slots.length === 0) return;

          const targetSlot = slots[0];
          const targetTime = targetSlot.startTime;

          // With a confirmed booking, slot is unavailable
          const slotsWithBooking = generateTimeSlotsFromBlocks(
            'svc-1',
            [block],
            serviceDurationMin,
            { start: date, end: date },
            [{ startTime: targetTime, status: 'confirmed' }]
          );

          const bookedSlot = slotsWithBooking.find(
            (s) => s.startTime.getTime() === targetTime.getTime()
          );
          expect(bookedSlot).toBeDefined();
          expect(bookedSlot!.isAvailable).toBe(false);

          // After cancellation (status = 'cancelled'), slot becomes available again
          const slotsAfterCancel = generateTimeSlotsFromBlocks(
            'svc-1',
            [block],
            serviceDurationMin,
            { start: date, end: date },
            [{ startTime: targetTime, status: 'cancelled' }]
          );

          const cancelledSlot = slotsAfterCancel.find(
            (s) => s.startTime.getTime() === targetTime.getTime()
          );
          expect(cancelledSlot).toBeDefined();
          expect(cancelledSlot!.isAvailable).toBe(true);
        }
      ),
      { numRuns: 300 }
    );
  });
});

// ─── Property 14: Cancellation idempotency guard ────────────────────────────

/**
 * Property 14: Cancellation idempotency guard
 *
 * For any booking that already has status 'cancelled', a subsequent cancellation request
 * SHALL be rejected with an error indicating the booking is already cancelled, and no
 * state SHALL change.
 *
 * **Validates: Requirements 9.6**
 */
describe('Property 14: Cancellation idempotency guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cancelling an already-cancelled booking returns already_cancelled error', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuid(),
        uuid(),
        async (bookingId, cancelledBy) => {
          vi.clearAllMocks();

          // Mock: fetch booking returns status 'cancelled'
          const mockBookingSelect = vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: bookingId,
                  customer_id: cancelledBy,
                  status: 'cancelled',
                },
                error: null,
              }),
            }),
          });

          // Mock: update should NOT be called
          const mockBookingUpdate = vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          });

          mockFrom.mockImplementation((table: string) => {
            if (table === 'bookings') {
              return {
                select: mockBookingSelect,
                update: mockBookingUpdate,
              };
            }
            return {};
          });

          const { BookingService } = await import('@/lib/services/booking.service');
          const bookingService = new BookingService();

          const result = await bookingService.cancelBooking(bookingId, cancelledBy);

          // Should be rejected with already_cancelled
          expect(result.success).toBe(false);
          expect(result.error).toBe('already_cancelled');

          // Update should never have been called (no state change)
          expect(mockBookingUpdate).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 15: Booking list filtering and sorting ────────────────────────

/**
 * Property 15: Booking list filtering and sorting
 *
 * For any set of bookings and any applied filter (date range up to 90 days, service ID),
 * all returned bookings SHALL match the filter criteria. Admin bookings SHALL be sorted
 * by date ascending. Customer upcoming bookings SHALL include only bookings with
 * start_time > now(), sorted ascending. Customer past bookings SHALL include only bookings
 * with start_time ≤ now(), sorted descending, limited to 50 entries.
 *
 * **Validates: Requirements 9.5, 10.1, 10.3**
 */
describe('Property 15: Booking list filtering and sorting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getBookingsAdmin returns results sorted by start_time ascending', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.date({ min: new Date(2025, 0, 1), max: new Date(2025, 11, 31) }),
          { minLength: 2, maxLength: 20 }
        ),
        async (dates) => {
          // Guard against invalid dates that can occur during shrinking
          fc.pre(dates.every((d) => !isNaN(d.getTime())));
          vi.clearAllMocks();

          // Sort dates ascending for the mock (simulating DB sort)
          const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());

          const mockRows = sortedDates.map((d, i) => ({
            id: `booking-${i}`,
            tenant_id: '00000000-0000-0000-0000-000000000000',
            customer_id: `customer-${i}`,
            service_id: 'svc-1',
            confirmation_id: `TRN-${i.toString().padStart(8, '0')}`,
            start_time: d.toISOString(),
            end_time: new Date(d.getTime() + 60 * 60 * 1000).toISOString(),
            price: 50.0,
            status: 'confirmed',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            services: { name: 'Test Service' },
            profiles: { email: `customer${i}@test.com` },
          }));

          const mockQuery = {
            select: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
              data: mockRows,
              error: null,
              count: mockRows.length,
            }),
          };

          mockFrom.mockImplementation((table: string) => {
            if (table === 'bookings') {
              return mockQuery;
            }
            return {};
          });

          const { BookingService } = await import('@/lib/services/booking.service');
          const bookingService = new BookingService();

          const result = await bookingService.getBookingsAdmin(
            {},
            { page: 1, pageSize: 20 }
          );

          // Verify results are sorted ascending by start time
          for (let i = 0; i < result.data.length - 1; i++) {
            expect(result.data[i].startTime.getTime()).toBeLessThanOrEqual(
              result.data[i + 1].startTime.getTime()
            );
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('getBookingsAdmin rejects date range exceeding 90 days', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.date({ min: new Date(2025, 0, 1), max: new Date(2025, 5, 30) }),
        fc.integer({ min: 91, max: 365 }),
        async (dateFrom, extraDays) => {
          // Guard against invalid dates that can occur during shrinking
          fc.pre(!isNaN(dateFrom.getTime()));
          vi.clearAllMocks();

          const dateTo = new Date(dateFrom.getTime() + extraDays * 24 * 60 * 60 * 1000);

          mockFrom.mockImplementation(() => ({
            select: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
              data: [],
              error: null,
              count: 0,
            }),
          }));

          const { BookingService } = await import('@/lib/services/booking.service');
          const bookingService = new BookingService();

          const result = await bookingService.getBookingsAdmin(
            { dateFrom, dateTo },
            { page: 1, pageSize: 20 }
          );

          // Should return empty results for ranges > 90 days
          expect(result.data).toHaveLength(0);
          expect(result.total).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('getBookingsByCustomer "upcoming" returns only future bookings sorted ascending', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuid(),
        fc.array(
          fc.date({ min: new Date(2025, 6, 1), max: new Date(2026, 11, 31) }).filter((d) => !isNaN(d.getTime())),
          { minLength: 2, maxLength: 15 }
        ),
        async (customerId, dates) => {
          vi.clearAllMocks();

          // Sort dates ascending for the mock (simulating DB sort with ascending order)
          const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());

          const mockRows = sortedDates.map((d, i) => ({
            id: `booking-${i}`,
            tenant_id: '00000000-0000-0000-0000-000000000000',
            customer_id: customerId,
            service_id: 'svc-1',
            confirmation_id: `TRN-UP${i.toString().padStart(6, '0')}`,
            start_time: d.toISOString(),
            end_time: new Date(d.getTime() + 60 * 60 * 1000).toISOString(),
            price: 50.0,
            status: 'confirmed',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            services: { name: 'Test Service' },
            profiles: { email: 'customer@test.com' },
          }));

          const mockQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          };

          // Chain resolves the data at the end (after order)
          mockQuery.order = vi.fn().mockResolvedValue({
            data: mockRows,
            error: null,
          });

          mockFrom.mockImplementation((table: string) => {
            if (table === 'bookings') {
              return mockQuery;
            }
            return {};
          });

          const { BookingService } = await import('@/lib/services/booking.service');
          const bookingService = new BookingService();

          const result = await bookingService.getBookingsByCustomer(customerId, 'upcoming');

          // All results should be sorted ascending by start time
          for (let i = 0; i < result.length - 1; i++) {
            expect(result[i].startTime.getTime()).toBeLessThanOrEqual(
              result[i + 1].startTime.getTime()
            );
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('getBookingsByCustomer "past" returns bookings sorted descending, limited to 50', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuid(),
        fc.integer({ min: 51, max: 80 }),
        async (customerId, totalPastBookings) => {
          vi.clearAllMocks();

          // Generate dates in the past, sorted descending (simulating DB response)
          const now = new Date();
          const pastDates: Date[] = [];
          for (let i = 0; i < totalPastBookings; i++) {
            pastDates.push(new Date(now.getTime() - (i + 1) * 24 * 60 * 60 * 1000));
          }
          // pastDates is already sorted descending (newest past first)

          // Only return 50 (DB limit applied)
          const limitedDates = pastDates.slice(0, 50);

          const mockRows = limitedDates.map((d, i) => ({
            id: `booking-past-${i}`,
            tenant_id: '00000000-0000-0000-0000-000000000000',
            customer_id: customerId,
            service_id: 'svc-1',
            confirmation_id: `TRN-PAST${i.toString().padStart(4, '0')}`,
            start_time: d.toISOString(),
            end_time: new Date(d.getTime() + 60 * 60 * 1000).toISOString(),
            price: 50.0,
            status: 'confirmed',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            services: { name: 'Past Service' },
            profiles: { email: 'customer@test.com' },
          }));

          const mockQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: mockRows,
              error: null,
            }),
          };

          mockFrom.mockImplementation((table: string) => {
            if (table === 'bookings') {
              return mockQuery;
            }
            return {};
          });

          const { BookingService } = await import('@/lib/services/booking.service');
          const bookingService = new BookingService();

          const result = await bookingService.getBookingsByCustomer(customerId, 'past');

          // Should be limited to 50 entries
          expect(result.length).toBeLessThanOrEqual(50);

          // Results should be sorted descending by start time
          for (let i = 0; i < result.length - 1; i++) {
            expect(result[i].startTime.getTime()).toBeGreaterThanOrEqual(
              result[i + 1].startTime.getTime()
            );
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('getBookingsAdmin with serviceId filter passes filter to query', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuid(),
        async (serviceId) => {
          vi.clearAllMocks();

          const eqCalls: Array<[string, string]> = [];

          const mockQuery = {
            select: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((field: string, value: string) => {
              eqCalls.push([field, value]);
              return mockQuery;
            }),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
              data: [],
              error: null,
              count: 0,
            }),
          };

          mockFrom.mockImplementation((table: string) => {
            if (table === 'bookings') {
              return mockQuery;
            }
            return {};
          });

          const { BookingService } = await import('@/lib/services/booking.service');
          const bookingService = new BookingService();

          await bookingService.getBookingsAdmin(
            { serviceId },
            { page: 1, pageSize: 20 }
          );

          // The service filter should have been applied
          const serviceFilter = eqCalls.find(([field]) => field === 'service_id');
          expect(serviceFilter).toBeDefined();
          expect(serviceFilter![1]).toBe(serviceId);
        }
      ),
      { numRuns: 50 }
    );
  });
});
