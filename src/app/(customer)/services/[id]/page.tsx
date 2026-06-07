"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface ServiceDetail {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  category: string;
  imageUrl: string | null;
}

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-20" role="status" aria-label="Loading service details">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-transcend-khaki/30 border-t-transcend-gold" />
      <p className="mt-4 text-sm text-transcend-brown/60">Loading service...</p>
    </div>
  );
}

function NotFoundState() {
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
        <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
      <h2 className="mt-4 font-serif text-lg font-semibold text-transcend-brown">
        Service not found
      </h2>
      <p className="mt-2 text-sm text-transcend-brown/60">
        This service may have been removed or is no longer available.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-brand bg-transcend-sage px-6 py-3 text-sm font-medium text-white transition-colors duration-brand hover:bg-transcend-sage/90 focus:outline-none focus:ring-2 focus:ring-transcend-sage focus:ring-offset-2"
      >
        Browse Services
      </Link>
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
        Unable to load service
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

export default function ServiceDetailPage() {
  const params = useParams();
  const serviceId = params.id as string;

  const [service, setService] = useState<ServiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const fetchService = useCallback(async () => {
    if (!serviceId) return;

    setIsLoading(true);
    setError(false);
    setNotFound(false);

    try {
      const response = await fetch(`/api/services/${serviceId}`);

      if (response.status === 404) {
        setNotFound(true);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch service");
      }

      const json = await response.json();
      setService(json.data);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    fetchService();
  }, [fetchService]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (notFound) {
    return <NotFoundState />;
  }

  if (error) {
    return <ErrorState onRetry={fetchService} />;
  }

  if (!service) {
    return <NotFoundState />;
  }

  return (
    <div>
      {/* Back navigation */}
      <div className="border-b border-transcend-khaki/20 bg-transcend-off-white px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-transcend-brown/60 transition-colors duration-brand hover:text-transcend-brown"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Services
        </Link>
      </div>

      {/* Service image */}
      <div className="relative h-[200px] w-full overflow-hidden bg-transcend-black sm:h-[240px]">
        {service.imageUrl ? (
          <img
            src={service.imageUrl}
            alt={service.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-transcend-brown/40 to-transcend-black">
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-transcend-gold/30"
              aria-hidden="true"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </div>
        )}
        {/* Category badge */}
        <div className="absolute bottom-4 left-4">
          <span className="rounded-brand bg-transcend-black/70 px-3 py-1 text-xs font-medium text-transcend-gold backdrop-blur-sm">
            {service.category}
          </span>
        </div>
      </div>

      {/* Service details */}
      <section className="px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="font-serif text-2xl font-bold text-transcend-brown sm:text-3xl">
            {service.name}
          </h1>

          {/* Duration and Price */}
          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-transcend-brown/50"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="text-sm text-transcend-brown/70">
                {service.duration} min
              </span>
            </div>
            <div className="h-4 w-px bg-transcend-khaki/30" aria-hidden="true" />
            <span className="text-lg font-semibold text-transcend-brown">
              €{service.price.toFixed(2)}
            </span>
          </div>

          {/* Description */}
          <div className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-transcend-brown/50">
              About this service
            </h2>
            <p className="mt-2 leading-relaxed text-transcend-brown/80">
              {service.description}
            </p>
          </div>

          {/* Book Now CTA */}
          <div className="mt-8">
            <Link
              href={`/book/${service.id}`}
              className="block w-full rounded-brand bg-transcend-sage py-4 text-center text-base font-semibold text-white transition-colors duration-brand hover:bg-transcend-sage/90 focus:outline-none focus:ring-2 focus:ring-transcend-sage focus:ring-offset-2 sm:inline-block sm:w-auto sm:px-10"
            >
              Book Now
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
