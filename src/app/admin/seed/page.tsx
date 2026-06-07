'use client';

import { useState } from 'react';
import { SEED_SERVICES } from '@/lib/services/seed.service';

interface SeedResponse {
  success: boolean;
  created: number;
  skipped: number;
}

export default function AdminSeedPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SeedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSeed() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error?.message ?? 'Seed operation failed.');
        return;
      }

      setResult(data as SeedResponse);
    } catch {
      setError('Network error. Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  // Group services by category for display
  const grouped = SEED_SERVICES.reduce(
    (acc, service) => {
      if (!acc[service.category]) acc[service.category] = [];
      acc[service.category].push(service);
      return acc;
    },
    {} as Record<string, typeof SEED_SERVICES>
  );

  return (
    <div>
      <h1 className="font-serif text-2xl text-transcend-gold mb-2">
        Seed Data
      </h1>
      <p className="text-white/60 text-sm mb-8 max-w-2xl">
        Populate the database with Transcend&apos;s real service catalog. This
        operation is idempotent — services that already exist will be skipped,
        and no duplicates will be created.
      </p>

      {/* Action Button */}
      <div className="mb-8">
        <button
          onClick={handleSeed}
          disabled={loading}
          className="px-6 py-3 rounded-brand bg-transcend-gold text-transcend-black font-medium text-sm transition-colors duration-brand hover:bg-transcend-gold/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Seeding...' : 'Run Seed'}
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="rounded-brand border border-white/10 bg-white/5 p-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 border-2 border-transcend-gold border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-white/70">
              Seeding database with service catalog...
            </p>
          </div>
        </div>
      )}

      {/* Success Result */}
      {result && (
        <div className="rounded-brand border border-transcend-gold/30 bg-transcend-gold/5 p-6 mb-8">
          <p className="text-sm font-medium text-transcend-gold mb-2">
            Seed Complete
          </p>
          <p className="text-sm text-white/80">
            Created{' '}
            <span className="font-semibold text-white">{result.created}</span>{' '}
            {result.created === 1 ? 'service' : 'services'}, skipped{' '}
            <span className="font-semibold text-white">{result.skipped}</span>{' '}
            {result.skipped === 1 ? 'service' : 'services'}.
          </p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-brand border border-red-500/30 bg-red-500/5 p-6 mb-8">
          <p className="text-sm font-medium text-red-400 mb-1">
            Seed Failed
          </p>
          <p className="text-sm text-white/70">{error}</p>
        </div>
      )}

      {/* Services to be Seeded */}
      <h2 className="font-serif text-lg text-transcend-gold mb-4">
        Services to be Seeded
      </h2>
      <div className="space-y-6">
        {Object.entries(grouped).map(([category, services]) => (
          <div key={category}>
            <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-2">
              {category}
            </h3>
            <div className="rounded-brand border border-white/10 bg-white/5 divide-y divide-white/5">
              {services.map((service) => (
                <div
                  key={service.name}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div>
                    <p className="text-sm text-white">{service.name}</p>
                    <p className="text-xs text-white/40 mt-0.5">
                      {service.duration} min
                    </p>
                  </div>
                  <p className="text-sm text-transcend-gold">
                    €{service.price}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
