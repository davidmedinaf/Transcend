'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface ServiceData {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  category: string;
  imageUrl: string | null;
}

interface SlotData {
  serviceId: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

interface GroupedSlots {
  [date: string]: SlotData[];
}

export default function TimeSlotSelectionPage() {
  const router = useRouter();
  const params = useParams();
  const serviceId = params.serviceId as string;

  const [service, setService] = useState<ServiceData | null>(null);
  const [slots, setSlots] = useState<SlotData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<SlotData | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError('');

      try {
        // Fetch service details and time slots in parallel
        const [serviceRes, slotsRes] = await Promise.all([
          fetch(`/api/services/${serviceId}`),
          fetch(`/api/timeslots/${serviceId}`),
        ]);

        if (!serviceRes.ok) {
          setError('Service not found. Please go back and try again.');
          return;
        }

        const serviceData = await serviceRes.json();
        setService(serviceData.data);

        if (!slotsRes.ok) {
          setError('Unable to load available times. Please try again.');
          return;
        }

        const slotsData = await slotsRes.json();
        setSlots(slotsData.data || []);
      } catch {
        setError('Unable to connect. Please check your internet connection and try again.');
      } finally {
        setIsLoading(false);
      }
    }

    if (serviceId) {
      fetchData();
    }
  }, [serviceId]);

  function groupSlotsByDate(slots: SlotData[]): GroupedSlots {
    const grouped: GroupedSlots = {};
    for (const slot of slots) {
      const date = new Date(slot.startTime).toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(slot);
    }
    return grouped;
  }

  function formatTime(isoString: string): string {
    return new Date(isoString).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function handleSlotSelect(slot: SlotData) {
    setSelectedSlot(slot);
    // Store selection in sessionStorage for the confirm page
    sessionStorage.setItem(
      'bookingSelection',
      JSON.stringify({
        serviceId: service?.id,
        serviceName: service?.name,
        duration: service?.duration,
        price: service?.price,
        slotStart: slot.startTime,
        slotEnd: slot.endTime,
      })
    );
    router.push('/book/confirm');
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <svg
            className="mx-auto h-8 w-8 animate-spin text-transcend-gold"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="mt-3 text-sm text-transcend-brown/70">Loading available times...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="px-4 py-8 sm:px-6">
        <div role="alert" className="rounded-brand border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
        <Link
          href="/"
          className="mt-4 inline-block text-sm font-medium text-transcend-gold hover:text-transcend-gold/80 transition-colors duration-brand"
        >
          ← Back to services
        </Link>
      </div>
    );
  }

  const groupedSlots = groupSlotsByDate(slots);
  const hasSlots = slots.length > 0;

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8">
      {/* Service Header */}
      <div className="mb-6">
        <Link
          href="/"
          className="mb-3 inline-flex items-center gap-1 text-sm text-transcend-brown/60 hover:text-transcend-brown transition-colors duration-brand"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </Link>
        <h1 className="font-serif text-2xl font-bold text-transcend-brown sm:text-3xl">
          Select a Time
        </h1>
        {service && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-transcend-brown/70">
            <span className="font-medium text-transcend-brown">{service.name}</span>
            <span className="text-transcend-khaki">•</span>
            <span>{service.duration} min</span>
            <span className="text-transcend-khaki">•</span>
            <span>€{service.price.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* No Available Times */}
      {!hasSlots && (
        <div className="rounded-brand border border-transcend-khaki/30 bg-white p-6 text-center">
          <svg
            className="mx-auto h-12 w-12 text-transcend-khaki/50"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <line x1="9" y1="16" x2="15" y2="16" />
          </svg>
          <h2 className="mt-4 font-serif text-lg font-bold text-transcend-brown">
            No Available Times
          </h2>
          <p className="mt-2 text-sm text-transcend-brown/70">
            There are no available time slots for this service in the next 14 days. Please check back later or choose a different service.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-brand bg-transcend-sage px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-brand hover:bg-transcend-sage/90"
          >
            Browse Services
          </Link>
        </div>
      )}

      {/* Time Slots by Day */}
      {hasSlots && (
        <div className="space-y-6">
          {Object.entries(groupedSlots).map(([date, daySlots]) => (
            <div key={date}>
              <h2 className="mb-3 font-serif text-base font-semibold text-transcend-brown sm:text-lg">
                {date}
              </h2>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {daySlots.map((slot) => {
                  const isSelected = selectedSlot?.startTime === slot.startTime;
                  return (
                    <button
                      key={slot.startTime}
                      onClick={() => handleSlotSelect(slot)}
                      className={`rounded-brand border px-3 py-2.5 text-sm font-medium transition-all duration-brand focus:outline-none focus:ring-2 focus:ring-transcend-gold/30 ${
                        isSelected
                          ? 'border-transcend-gold bg-transcend-gold/10 text-transcend-gold'
                          : 'border-transcend-khaki/30 bg-white text-transcend-brown hover:border-transcend-gold hover:bg-transcend-gold/5'
                      }`}
                      aria-label={`Book at ${formatTime(slot.startTime)} on ${date}`}
                    >
                      {formatTime(slot.startTime)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
