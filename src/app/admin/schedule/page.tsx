'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ServiceItem {
  id: string;
  name: string;
  category: string;
  duration: number;
}

export default function AdminSchedulePage() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchServices() {
      try {
        const res = await fetch('/api/services?pageSize=100');
        const data = await res.json();

        if (!res.ok) {
          setError(data?.error?.message ?? 'Failed to load services');
          return;
        }

        setServices(data.data ?? []);
      } catch {
        setError('Network error. Could not reach the server.');
      } finally {
        setLoading(false);
      }
    }

    fetchServices();
  }, []);

  // Group services by category
  const grouped = services.reduce(
    (acc, service) => {
      if (!acc[service.category]) acc[service.category] = [];
      acc[service.category].push(service);
      return acc;
    },
    {} as Record<string, ServiceItem[]>
  );

  const categoryOrder = ['Recovery', 'Treatments', 'Coaching', 'Events'];
  const sortedCategories = Object.keys(grouped).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  return (
    <div>
      <h1 className="font-serif text-2xl text-transcend-gold mb-2">
        Schedule Management
      </h1>
      <p className="text-white/60 text-sm mb-8 max-w-2xl">
        Configure weekly availability for each service. Select a service below
        to set its recurring time blocks.
      </p>

      {/* Loading State */}
      {loading && (
        <div className="rounded-brand border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 border-2 border-transcend-gold border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-white/70">Loading services...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-brand border border-red-500/30 bg-red-500/5 p-6">
          <p className="text-sm font-medium text-red-400 mb-1">Error</p>
          <p className="text-sm text-white/70">{error}</p>
        </div>
      )}

      {/* Service List by Category */}
      {!loading && !error && services.length === 0 && (
        <div className="rounded-brand border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-white/60">
            No services found. Create services first via the{' '}
            <Link href="/admin/services" className="text-transcend-gold hover:underline">
              Services
            </Link>{' '}
            page.
          </p>
        </div>
      )}

      {!loading && !error && sortedCategories.length > 0 && (
        <div className="space-y-6">
          {sortedCategories.map((category) => (
            <div key={category}>
              <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-2">
                {category}
              </h3>
              <div className="rounded-brand border border-white/10 bg-white/5 divide-y divide-white/5">
                {grouped[category].map((service) => (
                  <Link
                    key={service.id}
                    href={`/admin/schedule/${service.id}`}
                    className="flex items-center justify-between px-5 py-4 transition-colors duration-brand hover:bg-transcend-gold/5"
                  >
                    <div>
                      <p className="text-sm text-white font-medium">
                        {service.name}
                      </p>
                      <p className="text-xs text-white/40 mt-0.5">
                        {service.duration} min per session
                      </p>
                    </div>
                    <span className="text-xs text-transcend-gold">
                      Configure →
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
