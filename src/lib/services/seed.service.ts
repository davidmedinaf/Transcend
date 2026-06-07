import { createAdminClient } from '@/lib/supabase/admin';

// ─── Types ──────────────────────────────────────────────────────────────────

type ServiceCategory = 'Recovery' | 'Treatments' | 'Coaching' | 'Events';

export interface SeedServiceEntry {
  name: string;
  description: string;
  duration: number; // minutes (15-120)
  price: number; // EUR (20-300)
  category: ServiceCategory;
}

export interface SeedResult {
  created: number;
  skipped: number;
}

// ─── Seed Data ──────────────────────────────────────────────────────────────

export const SEED_CATEGORIES: { name: ServiceCategory; sort_order: number }[] = [
  { name: 'Recovery', sort_order: 0 },
  { name: 'Treatments', sort_order: 1 },
  { name: 'Coaching', sort_order: 2 },
  { name: 'Events', sort_order: 3 },
];

export const SEED_SERVICES: SeedServiceEntry[] = [
  // ── Recovery services ──
  {
    name: 'Fire & Ice Session',
    description: 'Alternating hot and cold therapy to boost circulation, reduce inflammation, and accelerate recovery.',
    duration: 60,
    price: 75,
    category: 'Recovery',
  },
  {
    name: 'Infrared Sauna',
    description: 'Deep-penetrating infrared heat therapy to relieve muscle tension and promote detoxification.',
    duration: 45,
    price: 45,
    category: 'Recovery',
  },
  {
    name: 'Cold Water Therapy',
    description: 'Invigorating cold immersion to reduce inflammation, boost immunity, and enhance mental clarity.',
    duration: 15,
    price: 30,
    category: 'Recovery',
  },
  {
    name: 'Warm Water Therapy',
    description: 'Soothing warm water immersion designed to relax muscles, ease joint pain, and calm the nervous system.',
    duration: 30,
    price: 35,
    category: 'Recovery',
  },
  {
    name: 'Compression Therapy',
    description: 'Pneumatic compression boots that enhance blood flow, reduce soreness, and speed up muscle recovery.',
    duration: 30,
    price: 40,
    category: 'Recovery',
  },
  {
    name: 'Red Light Therapy',
    description: 'Photobiomodulation using red and near-infrared wavelengths to support cellular repair and skin health.',
    duration: 20,
    price: 35,
    category: 'Recovery',
  },

  // ── Treatment services ──
  {
    name: 'Sports Massage',
    description: 'Targeted deep-tissue massage focused on athletic performance, injury prevention, and recovery.',
    duration: 60,
    price: 95,
    category: 'Treatments',
  },
  {
    name: 'Float Tank',
    description: 'Sensory deprivation floating in magnesium-rich salt water for deep relaxation and mental reset.',
    duration: 60,
    price: 65,
    category: 'Treatments',
  },
  {
    name: 'Cryo T-Shock',
    description: 'Thermal shock therapy alternating hot and cold to sculpt, tone, and rejuvenate targeted areas.',
    duration: 30,
    price: 120,
    category: 'Treatments',
  },

  // ── Coaching services ──
  {
    name: 'One-on-One Gym',
    description: 'Personalised gym coaching session tailored to your fitness goals with expert guidance and support.',
    duration: 60,
    price: 80,
    category: 'Coaching',
  },

  // ── Events ──
  {
    name: 'Breath & Ice Workshops',
    description: 'Group workshop combining breathwork techniques with cold exposure for resilience and stress management.',
    duration: 120,
    price: 55,
    category: 'Events',
  },
  {
    name: 'Wellness Workshops',
    description: 'Educational group sessions covering nutrition, mindfulness, and holistic wellness practices.',
    duration: 90,
    price: 45,
    category: 'Events',
  },
];

// ─── Seed Function ──────────────────────────────────────────────────────────

/**
 * Seeds the database with Transcend's service catalog.
 * Idempotent: skips services that already exist (matched by name).
 * Creates service_categories if they don't already exist.
 * Uses admin client to bypass RLS.
 */
export async function runSeed(): Promise<SeedResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  let created = 0;
  let skipped = 0;

  // ── 1. Ensure categories exist ──
  const categoryIdMap = new Map<ServiceCategory, string>();

  for (const cat of SEED_CATEGORIES) {
    // Check if category already exists
    const { data: existing } = await supabase
      .from('service_categories')
      .select('id')
      .eq('name', cat.name)
      .single();

    if (existing) {
      categoryIdMap.set(cat.name, (existing as { id: string }).id);
    } else {
      // Create the category
      const { data: newCat, error } = await supabase
        .from('service_categories')
        .insert({ name: cat.name, sort_order: cat.sort_order })
        .select('id')
        .single();

      if (error || !newCat) {
        throw new Error(
          `Failed to create category '${cat.name}': ${(error as { message: string })?.message}`
        );
      }
      categoryIdMap.set(cat.name, (newCat as { id: string }).id);
    }
  }

  // ── 2. Seed services (skip duplicates by name) ──
  for (const service of SEED_SERVICES) {
    // Check if a service with this name already exists
    const { data: existing } = await supabase
      .from('services')
      .select('id')
      .eq('name', service.name)
      .limit(1)
      .single();

    if (existing) {
      skipped++;
      continue;
    }

    const categoryId = categoryIdMap.get(service.category);
    if (!categoryId) {
      throw new Error(`Category ID not found for '${service.category}'`);
    }

    const { error } = await supabase.from('services').insert({
      category_id: categoryId,
      name: service.name,
      description: service.description,
      duration_minutes: service.duration,
      price: service.price,
    });

    if (error) {
      throw new Error(
        `Failed to seed service '${service.name}': ${(error as { message: string }).message}`
      );
    }

    created++;
  }

  return { created, skipped };
}
