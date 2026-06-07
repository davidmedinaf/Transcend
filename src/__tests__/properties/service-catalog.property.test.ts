import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  validateCreateInput,
  validateName,
  validateDescription,
  validateDuration,
  validatePrice,
  validateCategory,
  VALID_CATEGORIES,
} from '@/lib/services/service-catalog.service';
import type { CreateServiceInput, ServiceCategory } from '@/lib/types';

// ─── Mock Supabase ──────────────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockSupabaseClient = { from: mockFrom };

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// ─── Property 4: Service field validation ───────────────────────────────────

/**
 * Property 4: Service field validation
 *
 * For any service creation or update input, the system SHALL accept the input if and only if:
 * name length is 1–100 characters, description length is 1–500 characters, duration is an
 * integer between 1 and 480, price is a non-negative number with at most 2 decimal places
 * between 0.00 and 9999.99, and category is one of the valid ServiceCategory values.
 *
 * **Validates: Requirements 4.1, 4.5, 4.6, 4.7**
 */
describe('Property 4: Service field validation', () => {
  it('validateName accepts strings of length 1-100 and rejects others', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (name: string) => {
        const result = validateName(name, true);
        if (name.length >= 1 && name.length <= 100) {
          expect(result).toBeNull();
        } else {
          expect(result).not.toBeNull();
        }
      }),
      { numRuns: 500 }
    );
  });

  it('validateName always accepts valid names (1-100 chars)', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (name: string) => {
        const result = validateName(name, true);
        expect(result).toBeNull();
      }),
      { numRuns: 300 }
    );
  });

  it('validateName rejects empty string', () => {
    const result = validateName('', true);
    expect(result).not.toBeNull();
  });

  it('validateName rejects strings longer than 100 characters', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 101, maxLength: 500 }), (name: string) => {
        const result = validateName(name, true);
        expect(result).not.toBeNull();
      }),
      { numRuns: 200 }
    );
  });

  it('validateDescription accepts strings of length 1-500 and rejects others', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 600 }), (desc: string) => {
        const result = validateDescription(desc, true);
        if (desc.length >= 1 && desc.length <= 500) {
          expect(result).toBeNull();
        } else {
          expect(result).not.toBeNull();
        }
      }),
      { numRuns: 500 }
    );
  });

  it('validateDescription always accepts valid descriptions (1-500 chars)', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 500 }), (desc: string) => {
        const result = validateDescription(desc, true);
        expect(result).toBeNull();
      }),
      { numRuns: 300 }
    );
  });

  it('validateDescription rejects strings longer than 500 characters', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 501, maxLength: 700 }), (desc: string) => {
        const result = validateDescription(desc, true);
        expect(result).not.toBeNull();
      }),
      { numRuns: 200 }
    );
  });

  it('validateDuration accepts integers 1-480 and rejects others', () => {
    fc.assert(
      fc.property(fc.integer({ min: -100, max: 600 }), (duration: number) => {
        const result = validateDuration(duration, true);
        if (duration >= 1 && duration <= 480) {
          expect(result).toBeNull();
        } else {
          expect(result).not.toBeNull();
        }
      }),
      { numRuns: 500 }
    );
  });

  it('validateDuration rejects non-integer values', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 480, noNaN: true }).filter((n) => !Number.isInteger(n)),
        (duration: number) => {
          const result = validateDuration(duration, true);
          expect(result).not.toBeNull();
        }
      ),
      { numRuns: 200 }
    );
  });

  it('validatePrice accepts non-negative numbers 0.00-9999.99 with max 2 decimal places', () => {
    // Generate valid prices: integers or up to 2 decimal places within range
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999999 }).map((n) => n / 100), // generates 0.00 to 9999.99 with max 2 decimals
        (price: number) => {
          const result = validatePrice(price, true);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 500 }
    );
  });

  it('validatePrice rejects negative numbers', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -10000, max: -0.01, noNaN: true }),
        (price: number) => {
          const result = validatePrice(price, true);
          expect(result).not.toBeNull();
        }
      ),
      { numRuns: 200 }
    );
  });

  it('validatePrice rejects numbers above 9999.99', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 10000, max: 99999, noNaN: true }),
        (price: number) => {
          const result = validatePrice(price, true);
          expect(result).not.toBeNull();
        }
      ),
      { numRuns: 200 }
    );
  });

  it('validatePrice rejects numbers with more than 2 decimal places', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9999999 }).map((n) => n / 1000), // generates numbers with 3 decimal places
        (price: number) => {
          // Only test prices that actually have more than 2 decimal places and are in valid range
          const decimalStr = price.toString();
          const decimalPart = decimalStr.includes('.') ? decimalStr.split('.')[1] : '';
          if (decimalPart.length > 2 && price >= 0 && price <= 9999.99) {
            const result = validatePrice(price, true);
            expect(result).not.toBeNull();
          }
        }
      ),
      { numRuns: 300 }
    );
  });

  it('validateCategory accepts only valid categories', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_CATEGORIES),
        (category: ServiceCategory) => {
          const result = validateCategory(category, true);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validateCategory rejects invalid category strings', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !VALID_CATEGORIES.includes(s as ServiceCategory)),
        (category: string) => {
          const result = validateCategory(category as ServiceCategory, true);
          expect(result).not.toBeNull();
        }
      ),
      { numRuns: 300 }
    );
  });

  it('validateCreateInput accepts valid full inputs and rejects any invalid field', () => {
    // Generate valid inputs — all fields within constraints
    const validInput = fc.record({
      name: fc.string({ minLength: 1, maxLength: 100 }),
      description: fc.string({ minLength: 1, maxLength: 500 }),
      duration: fc.integer({ min: 1, max: 480 }),
      price: fc.integer({ min: 0, max: 999999 }).map((n) => n / 100),
      category: fc.constantFrom(...VALID_CATEGORIES) as fc.Arbitrary<ServiceCategory>,
    });

    fc.assert(
      fc.property(validInput, (input: CreateServiceInput) => {
        const result = validateCreateInput(input);
        expect(result).toBeNull();
      }),
      { numRuns: 300 }
    );
  });

  it('validateCreateInput rejects inputs with at least one invalid field', () => {
    // Input with invalid name (too long)
    const invalidNameInput: CreateServiceInput = {
      name: 'a'.repeat(101),
      description: 'Valid description',
      duration: 60,
      price: 50.0,
      category: 'Recovery',
    };
    expect(validateCreateInput(invalidNameInput)).not.toBeNull();
    expect(validateCreateInput(invalidNameInput)!.name).toBeDefined();

    // Input with invalid duration (non-integer)
    const invalidDurationInput: CreateServiceInput = {
      name: 'Valid Name',
      description: 'Valid description',
      duration: 60.5,
      price: 50.0,
      category: 'Recovery',
    };
    expect(validateCreateInput(invalidDurationInput)).not.toBeNull();
    expect(validateCreateInput(invalidDurationInput)!.duration).toBeDefined();

    // Input with invalid price (too many decimals)
    const invalidPriceInput: CreateServiceInput = {
      name: 'Valid Name',
      description: 'Valid description',
      duration: 60,
      price: 50.123,
      category: 'Recovery',
    };
    expect(validateCreateInput(invalidPriceInput)).not.toBeNull();
    expect(validateCreateInput(invalidPriceInput)!.price).toBeDefined();
  });
});

// ─── Property 5: Service edit preserves existing bookings ───────────────────

/**
 * Property 5: Service edit preserves existing bookings
 *
 * For any service that has existing confirmed bookings, editing any of the service's
 * fields (name, description, duration, price, category, image) SHALL NOT modify the
 * start_time, end_time, price, status, or any other field of those existing bookings.
 *
 * **Validates: Requirements 4.2**
 */
describe('Property 5: Service edit preserves existing bookings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updateService only calls update on services table, never on bookings table', async () => {
    // Track which tables are accessed and with which operations
    const tableAccess: Array<{ table: string; operation: string }> = [];

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'svc-1',
            tenant_id: 'tenant-1',
            category_id: 'cat-1',
            name: 'Original Name',
            description: 'Original description',
            duration_minutes: 60,
            price: 50.0,
            image_url: null,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'svc-1',
              tenant_id: 'tenant-1',
              category_id: 'cat-1',
              name: 'Updated Name',
              description: 'Original description',
              duration_minutes: 60,
              price: 50.0,
              image_url: null,
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'services') {
        return {
          select: (...args: unknown[]) => {
            tableAccess.push({ table: 'services', operation: 'select' });
            return mockSelect(...args);
          },
          update: (...args: unknown[]) => {
            tableAccess.push({ table: 'services', operation: 'update' });
            return mockUpdate(...args);
          },
        };
      }
      if (table === 'service_categories') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'cat-1', name: 'Recovery' },
                error: null,
              }),
            }),
          }),
        };
      }
      // Track any access to bookings table — this should NEVER happen during update
      tableAccess.push({ table, operation: 'unknown' });
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    });

    // Import ServiceCatalogService dynamically to use the mocked supabase
    const { ServiceCatalogService } = await import(
      '@/lib/services/service-catalog.service'
    );
    const service = new ServiceCatalogService();

    // Generate arbitrary valid update inputs
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
          description: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: undefined }),
          duration: fc.option(fc.integer({ min: 1, max: 480 }), { nil: undefined }),
          price: fc.option(
            fc.integer({ min: 0, max: 999999 }).map((n) => n / 100),
            { nil: undefined }
          ),
        }),
        async (updateData) => {
          // Reset tracking
          tableAccess.length = 0;

          await service.updateService('svc-1', updateData);

          // Verify bookings table was never accessed
          const bookingsAccess = tableAccess.filter((a) => a.table === 'bookings');
          expect(bookingsAccess).toHaveLength(0);

          // The only data-modifying operation should be on 'services' table
          const dataModifications = tableAccess.filter(
            (a) => a.operation === 'update' || a.operation === 'insert' || a.operation === 'delete'
          );
          for (const mod of dataModifications) {
            expect(mod.table).toBe('services');
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ─── Property 6: Service deletion guard ─────────────────────────────────────

/**
 * Property 6: Service deletion guard
 *
 * For any service that has at least one booking with status 'confirmed' and start_time
 * in the future, a delete operation on that service SHALL be rejected with an error
 * indicating active bookings exist.
 *
 * **Validates: Requirements 4.4**
 */
describe('Property 6: Service deletion guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deleteService rejects deletion when future confirmed bookings exist', async () => {
    // Mock: bookings query returns at least one future confirmed booking
    const mockBookingsSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gt: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [{ id: 'booking-1' }], // at least one future booking
              error: null,
            }),
          }),
        }),
      }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'bookings') {
        return { select: mockBookingsSelect };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    });

    const { ServiceCatalogService } = await import(
      '@/lib/services/service-catalog.service'
    );
    const service = new ServiceCatalogService();

    // Generate arbitrary service IDs
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (serviceId: string) => {
        const result = await service.deleteService(serviceId);

        // Deletion must be rejected
        expect(result.success).toBe(false);

        // Error message must indicate active bookings
        expect(result.error).toBeDefined();
        expect(result.error!.toLowerCase()).toContain('active');
        expect(result.error!.toLowerCase()).toContain('booking');
      }),
      { numRuns: 100 }
    );
  });

  it('deleteService succeeds when no future confirmed bookings exist', async () => {
    // Mock: bookings query returns empty array (no future bookings)
    const mockBookingsSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gt: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [], // no future bookings
              error: null,
            }),
          }),
        }),
      }),
    });

    const mockServicesUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'bookings') {
        return { select: mockBookingsSelect };
      }
      if (table === 'services') {
        return { update: mockServicesUpdate };
      }
      return {};
    });

    const { ServiceCatalogService } = await import(
      '@/lib/services/service-catalog.service'
    );
    const service = new ServiceCatalogService();

    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (serviceId: string) => {
        const result = await service.deleteService(serviceId);

        // Deletion should succeed
        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });
});
