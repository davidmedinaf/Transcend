import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SEED_SERVICES, runSeed } from '@/lib/services/seed.service';

/**
 * Property-based tests for Seed Data service.
 *
 * **Validates: Requirements 14.5, 14.6**
 */

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

// ─── Property 18: Seed data constraints ─────────────────────────────────────

describe('Property 18: Seed data constraints', () => {
  /**
   * **Validates: Requirements 14.5**
   *
   * For any service created by the seed mechanism, the service SHALL have:
   * a non-empty name, a description of at least 20 characters, a duration
   * between 15 and 120 minutes (inclusive), and a price between 20.00 and
   * 300.00 EUR (inclusive).
   */

  it('every seeded service has a non-empty name', () => {
    for (const service of SEED_SERVICES) {
      expect(service.name).toBeDefined();
      expect(typeof service.name).toBe('string');
      expect(service.name.length).toBeGreaterThan(0);
    }
  });

  it('every seeded service has a description of at least 20 characters', () => {
    for (const service of SEED_SERVICES) {
      expect(service.description).toBeDefined();
      expect(typeof service.description).toBe('string');
      expect(service.description.length).toBeGreaterThanOrEqual(20);
    }
  });

  it('every seeded service has a duration between 15 and 120 minutes inclusive', () => {
    for (const service of SEED_SERVICES) {
      expect(service.duration).toBeGreaterThanOrEqual(15);
      expect(service.duration).toBeLessThanOrEqual(120);
    }
  });

  it('every seeded service has a price between 20 and 300 EUR inclusive', () => {
    for (const service of SEED_SERVICES) {
      expect(service.price).toBeGreaterThanOrEqual(20);
      expect(service.price).toBeLessThanOrEqual(300);
    }
  });

  it('all seed data constraints hold simultaneously for every entry', () => {
    // Property: For ALL entries in SEED_SERVICES, the constraints hold
    expect(SEED_SERVICES.length).toBe(12);

    for (const service of SEED_SERVICES) {
      // Non-empty name
      expect(service.name.length).toBeGreaterThan(0);
      // Description >= 20 chars
      expect(service.description.length).toBeGreaterThanOrEqual(20);
      // Duration in [15, 120]
      expect(service.duration).toBeGreaterThanOrEqual(15);
      expect(service.duration).toBeLessThanOrEqual(120);
      // Price in [20, 300]
      expect(service.price).toBeGreaterThanOrEqual(20);
      expect(service.price).toBeLessThanOrEqual(300);
    }
  });
});

// ─── Property 19: Seed idempotency ──────────────────────────────────────────

describe('Property 19: Seed idempotency', () => {
  /**
   * **Validates: Requirements 14.6**
   *
   * For any execution of the seed mechanism when the target services already
   * exist in the database, the system SHALL NOT create duplicate records.
   * The total count of each seeded service before and after re-execution
   * SHALL be identical.
   */

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('first run creates all 12 services, second run skips all 12', async () => {
    const { createAdminClient } = await import('@/lib/supabase/admin');

    let runCount = 0;

    vi.mocked(createAdminClient).mockImplementation(() => {
      runCount++;
      const currentRun = runCount;

      // Track which service we're querying
      let serviceQueryCount = 0;
      let categoryQueryCount = 0;

      const mockClient = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'service_categories') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockImplementation(() => {
                    categoryQueryCount++;
                    // Categories always exist (already created)
                    return Promise.resolve({
                      data: { id: `cat-${categoryQueryCount}` },
                      error: null,
                    });
                  }),
                }),
              }),
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: `new-cat-${categoryQueryCount}` },
                    error: null,
                  }),
                }),
              }),
            };
          }

          if (table === 'services') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockImplementation(() => {
                      serviceQueryCount++;
                      if (currentRun <= 1) {
                        // First run: services don't exist yet
                        return Promise.resolve({ data: null, error: { code: 'PGRST116' } });
                      }
                      // Second run: services already exist
                      return Promise.resolve({
                        data: { id: `service-${serviceQueryCount}` },
                        error: null,
                      });
                    }),
                  }),
                }),
              }),
              insert: vi.fn().mockImplementation(() => {
                return Promise.resolve({ data: null, error: null });
              }),
            };
          }

          return {};
        }),
      };

      return mockClient as never;
    });

    // First run: all services are new → created=12, skipped=0
    const firstResult = await runSeed();
    expect(firstResult.created).toBe(12);
    expect(firstResult.skipped).toBe(0);

    // Second run: all services exist → created=0, skipped=12
    const secondResult = await runSeed();
    expect(secondResult.created).toBe(0);
    expect(secondResult.skipped).toBe(12);
  });

  it('idempotency is maintained regardless of execution count', async () => {
    const { createAdminClient } = await import('@/lib/supabase/admin');

    // All services already exist scenario
    vi.mocked(createAdminClient).mockImplementation(() => {
      const mockClient = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'service_categories') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'existing-cat-id' },
                    error: null,
                  }),
                }),
              }),
            };
          }

          if (table === 'services') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { id: 'existing-service-id' },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }

          return {};
        }),
      };

      return mockClient as never;
    });

    // Run seed multiple times — every run should skip all
    for (let i = 0; i < 3; i++) {
      const result = await runSeed();
      expect(result.created).toBe(0);
      expect(result.skipped).toBe(12);
    }
  });
});
