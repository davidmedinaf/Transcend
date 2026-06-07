"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface ServiceCard {
  id: string;
  name: string;
  duration: number;
  price: number;
  category: string;
  imageUrl: string | null;
}

type ServiceCategory = "Recovery" | "Treatments" | "Coaching" | "Events";

const CATEGORY_ORDER: ServiceCategory[] = [
  "Recovery",
  "Treatments",
  "Coaching",
  "Events",
];

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-20" role="status" aria-label="Loading services">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-transcend-khaki/30 border-t-transcend-gold" />
      <p className="mt-4 text-sm text-transcend-brown/60">Loading services...</p>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-transcend-brown/40"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <h2 className="mt-4 font-serif text-lg font-semibold text-transcend-brown">
        Unable to load services
      </h2>
      <p className="mt-2 text-sm text-transcend-brown/60">
        Something went wrong. Please try again.
      </p>
      <button
        onClick={onRetry}
        className="mt-6 rounded-brand bg-transcend-sage px-6 py-3 text-sm font-medium text-white transition-colors duration-brand hover:bg-transcend-sage/90 focus:outline-none focus:ring-2 focus:ring-transcend-sage focus:ring-offset-2"
      >
        Retry
      </button>
    </div>
  );
}

function ServiceCardComponent({
  service,
  isDarkSection,
}: {
  service: ServiceCard;
  isDarkSection: boolean;
}) {
  return (
    <Link
      href={`/services/${service.id}`}
      className={`group block overflow-hidden rounded-brand transition-transform duration-brand hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-transcend-gold focus:ring-offset-2 ${
        isDarkSection
          ? "bg-transcend-brown/80 focus:ring-offset-transcend-black"
          : "bg-white shadow-sm focus:ring-offset-transcend-off-white"
      }`}
    >
      {/* Image placeholder */}
      <div
        className={`relative aspect-[4/3] w-full overflow-hidden ${
          isDarkSection ? "bg-transcend-brown/60" : "bg-transcend-khaki/20"
        }`}
      >
        {service.imageUrl ? (
          <img
            src={service.imageUrl}
            alt={service.name}
            className="h-full w-full object-cover transition-transform duration-brand group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={isDarkSection ? "text-transcend-gold/40" : "text-transcend-khaki/60"}
              aria-hidden="true"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </div>
        )}
      </div>

      {/* Card content */}
      <div className="p-4">
        <h3
          className={`font-serif text-base font-semibold leading-tight sm:text-lg ${
            isDarkSection ? "text-transcend-off-white" : "text-transcend-brown"
          }`}
        >
          {service.name}
        </h3>
        <div className="mt-2 flex items-center justify-between">
          <span
            className={`text-xs sm:text-sm ${
              isDarkSection ? "text-transcend-off-white/60" : "text-transcend-brown/60"
            }`}
          >
            {service.duration} min
          </span>
          <span
            className={`text-sm font-semibold sm:text-base ${
              isDarkSection ? "text-transcend-gold" : "text-transcend-brown"
            }`}
          >
            €{service.price.toFixed(2)}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function CustomerHome() {
  const [servicesByCategory, setServicesByCategory] = useState<
    Record<string, ServiceCard[]> | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchServices = useCallback(async () => {
    setIsLoading(true);
    setError(false);

    try {
      const response = await fetch("/api/services?grouped=true");
      if (!response.ok) {
        throw new Error("Failed to fetch services");
      }
      const json = await response.json();
      setServicesByCategory(json.data);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorState onRetry={fetchServices} />;
  }

  // Filter categories that have services and maintain the required order
  const categoriesWithServices = CATEGORY_ORDER.filter(
    (category) =>
      servicesByCategory?.[category] &&
      servicesByCategory[category].length > 0
  );

  return (
    <div>
      {/* Hero section with video background */}
      <section className="relative h-[70vh] min-h-[400px] overflow-hidden bg-transcend-black">
        {/* YouTube video background */}
        <div className="absolute inset-0 pointer-events-none">
          <iframe
            src="https://www.youtube.com/embed/YjckwWY9rAE?autoplay=1&mute=1&loop=1&playlist=YjckwWY9rAE&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1"
            title="Transcend Health Mallorca"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[177.78vh] min-w-full min-h-full"
            style={{ aspectRatio: '16/9' }}
            allow="autoplay; encrypted-media"
            frameBorder="0"
          />
        </div>
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/40" />
        {/* Content overlay */}
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center">
          <h1 className="font-serif text-3xl font-bold text-white sm:text-4xl md:text-5xl">
            Recover, Enhance, Transcend
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm text-white/80 sm:text-base">
            Advanced technology and personalized care for holistic wellness in Palma de Mallorca.
          </p>
          <div className="mt-8 flex gap-4">
            <a
              href="#services"
              className="rounded-brand bg-transcend-sage px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-transcend-sage/90"
            >
              See Our Services
            </a>
          </div>
        </div>
      </section>

      {/* Services section */}
      <section id="services" className="bg-transcend-black px-4 py-10 text-center sm:px-6 sm:py-14">
        <h2 className="font-serif text-2xl font-bold text-transcend-gold sm:text-3xl">
          Our Services
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-transcend-off-white/70 sm:text-base">
          Discover our range of wellness experiences designed to help you
          recover, rejuvenate, and transcend.
        </p>
      </section>

      {/* Category sections with alternating backgrounds */}
      {categoriesWithServices.map((category, index) => {
        const isDark = index % 2 === 0;
        const services = servicesByCategory![category];

        // Sort services alphabetically within category
        const sortedServices = [...services].sort((a, b) =>
          a.name.localeCompare(b.name)
        );

        return (
          <section
            key={category}
            className={`px-4 py-8 sm:px-6 sm:py-12 ${
              isDark
                ? "bg-transcend-off-white"
                : "bg-transcend-black"
            }`}
          >
            <div className="mx-auto max-w-6xl">
              <h2
                className={`font-serif text-xl font-bold sm:text-2xl ${
                  isDark ? "text-transcend-brown" : "text-transcend-gold"
                }`}
              >
                {category}
              </h2>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sortedServices.map((service) => (
                  <ServiceCardComponent
                    key={service.id}
                    service={service}
                    isDarkSection={!isDark}
                  />
                ))}
              </div>
            </div>
          </section>
        );
      })}

      {/* Empty state if no services at all */}
      {categoriesWithServices.length === 0 && (
        <section className="px-4 py-20 text-center">
          <p className="text-sm text-transcend-brown/60">
            No services available at the moment. Please check back soon.
          </p>
        </section>
      )}
    </div>
  );
}
