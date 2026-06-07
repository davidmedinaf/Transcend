import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { ServiceCategory } from '@/lib/types';

// ─── Mock Supabase ──────────────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockSupabaseClient = { from: mockFrom };

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// ─── Generators ─────────────────────────────────────────────────────────────

const CATEGORIES: ServiceCategory[] = ['Recovery', 'Treatments', 'Coaching', 'Events'];

const categoryArb = fc.constantFrom(...CATEGORIES);

const serviceRowArb = (categoryId: string) =>
  fc.record({
    id: fc.uuid(),
    tenant_id: fc.constant('00000000-0000-0000-0000-000000000000'),
    category_id: fc.constant(categoryId),
    name: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
    description: fc.string({ minLength: 1, maxLength: 500 }),
    duration_minutes: fc.integer({ min: 1, max: 480 }),
    price: fc.integer({ min: 0, max: 999999 }).map((n) => n / 100),
    image_url: fc.option(fc.webUrl(), { nil: null }),
    is_active: fc.constant(true),
    created_at: fc.constant(new Date().toISOString()),
    updated_at: fc.constant(new Date().toISOString()),
  });

/**
 * Generates an arbitrary set of services spread across random categories.
 * Returns the generated rows along with the category mapping used.
 */
const servicesSetArb = fc
  .array(
    fc.record({
      category: categoryArb,
      name: fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length > 0),
      description: fc.string({ minLength: 1, maxLength: 500 }),
      duration_minutes: fc.integer({ min: 1, max: 480 }),
      price: fc.integer({ min: 0, max: 999999 }).map((n) => n / 100),
    }),
    { minLength: 0, maxLength: 20 }
  )
  .map((items) => {
    // Create stable category IDs
    const categoryMap: Record<ServiceCategory, string> = {
      Recovery: 'cat-recovery',
      Treatments: 'cat-treatments',
      Coaching: 'cat-coaching',
      Events: 'cat-events',
    };

    const rows = items.map((item, idx) => ({
      id: `svc-${idx}`,
      tenant_id: '00000000-0000-0000-0000-000000000000',
      category_id: categoryMap[item.category],
      name: item.name,
      description: item.description,
      duration_minutes: item.duration_minutes,
      price: item.price,
      image_url: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    return { rows, categoryMap, items };
  });

// ─── Property 10: Service listing correctness ───────────────────────────────

/**
 * Property 10: Service listing correctness
 *
 * For any set of active services in the database, the customer-facing service listing SHALL:
 * (a) group services by their category,
 * (b) order categories as Recovery → Treatments → Coaching → Events,
 * (c) sort services alphabetically within each category,
 * (d) include name, duration, and price for each service card, and
 * (e) exclude any category that contains zero active services.
 *
 * **Validates: Requirements 6.1, 6.2, 6.5**
 */
describe('Property 10: Service listing correctness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('categories in result are ordered: Recovery → Treatments → Coaching → Events', async () => {
    await fc.assert(
      fc.asyncProperty(servicesSetArb, async ({ rows, categoryMap }) => {
        // Setup mocks
        setupMocks(rows, categoryMap);

        const { ServiceCatalogService, CATEGORY_ORDER } = await import(
          '@/lib/services/service-catalog.service'
        );
        const service = new ServiceCatalogService();

        const result = await service.getServicesByCategory();

        // Verify category ordering
        const resultCategories = [...result.keys()];
        for (let i = 1; i < resultCategories.length; i++) {
          const prevOrder = CATEGORY_ORDER[resultCategories[i - 1]];
          const currOrder = CATEGORY_ORDER[resultCategories[i]];
          expect(prevOrder).toBeLessThan(currOrder);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('services within each category are sorted alphabetically by name', async () => {
    await fc.assert(
      fc.asyncProperty(servicesSetArb, async ({ rows, categoryMap }) => {
        setupMocks(rows, categoryMap);

        const { ServiceCatalogService } = await import(
          '@/lib/services/service-catalog.service'
        );
        const service = new ServiceCatalogService();

        const result = await service.getServicesByCategory();

        for (const [, services] of result) {
          for (let i = 1; i < services.length; i++) {
            const cmp = services[i - 1].name.localeCompare(services[i].name);
            expect(cmp).toBeLessThanOrEqual(0);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('each service includes name, duration, and price fields', async () => {
    await fc.assert(
      fc.asyncProperty(servicesSetArb, async ({ rows, categoryMap }) => {
        setupMocks(rows, categoryMap);

        const { ServiceCatalogService } = await import(
          '@/lib/services/service-catalog.service'
        );
        const service = new ServiceCatalogService();

        const result = await service.getServicesByCategory();

        for (const [, services] of result) {
          for (const svc of services) {
            // name must be a non-empty string
            expect(typeof svc.name).toBe('string');
            expect(svc.name.length).toBeGreaterThan(0);

            // duration must be a positive number
            expect(typeof svc.duration).toBe('number');
            expect(svc.duration).toBeGreaterThan(0);

            // price must be a non-negative number
            expect(typeof svc.price).toBe('number');
            expect(svc.price).toBeGreaterThanOrEqual(0);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('empty categories (with 0 services) are excluded from the result', async () => {
    await fc.assert(
      fc.asyncProperty(servicesSetArb, async ({ rows, categoryMap, items }) => {
        setupMocks(rows, categoryMap);

        const { ServiceCatalogService } = await import(
          '@/lib/services/service-catalog.service'
        );
        const service = new ServiceCatalogService();

        const result = await service.getServicesByCategory();

        // Determine which categories actually have services
        const populatedCategories = new Set(items.map((item) => item.category));

        // Every category in the result must have at least one service
        for (const [cat, services] of result) {
          expect(services.length).toBeGreaterThan(0);
          expect(populatedCategories.has(cat)).toBe(true);
        }

        // Categories NOT in the result should have 0 services in the input
        for (const cat of CATEGORIES) {
          if (!result.has(cat)) {
            expect(populatedCategories.has(cat)).toBe(false);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('all services belong to their correct category', async () => {
    await fc.assert(
      fc.asyncProperty(servicesSetArb, async ({ rows, categoryMap, items }) => {
        setupMocks(rows, categoryMap);

        const { ServiceCatalogService } = await import(
          '@/lib/services/service-catalog.service'
        );
        const service = new ServiceCatalogService();

        const result = await service.getServicesByCategory();

        // Build expected mapping: service name → category from original input
        // Note: multiple items may share same name so we track by category_id from rows
        const rowCategoryMap = new Map<string, ServiceCategory>();
        for (let i = 0; i < rows.length; i++) {
          const catId = rows[i].category_id;
          const catName = Object.entries(categoryMap).find(
            ([, id]) => id === catId
          )?.[0] as ServiceCategory;
          if (catName) {
            rowCategoryMap.set(rows[i].id, catName);
          }
        }

        // Every service in the result should be under the correct category
        for (const [cat, services] of result) {
          for (const svc of services) {
            expect(svc.category).toBe(cat);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Mock Setup Helper ──────────────────────────────────────────────────────

function setupMocks(
  rows: Array<{
    id: string;
    tenant_id: string;
    category_id: string;
    name: string;
    description: string;
    duration_minutes: number;
    price: number;
    image_url: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }>,
  categoryMap: Record<ServiceCategory, string>
) {
  const categoryRows = Object.entries(categoryMap).map(([name, id]) => ({
    id,
    name,
  }));

  mockFrom.mockImplementation((table: string) => {
    if (table === 'services') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: rows,
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === 'service_categories') {
      return {
        select: vi.fn().mockResolvedValue({
          data: categoryRows,
          error: null,
        }),
      };
    }
    return {
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
  });
}
