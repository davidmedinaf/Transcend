'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface BookingSelection {
  serviceId: string;
  serviceName: string;
  duration: number;
  price: number;
  slotStart: string;
  slotEnd: string;
}

function getStoredSelection(): BookingSelection | null {
  if (typeof window === 'undefined') return null;
  const stored = sessionStorage.getItem('bookingSelection');
  if (!stored) return null;
  return JSON.parse(stored);
}

export default function BookingConfirmPage() {
  const router = useRouter();
  const [selection] = useState<BookingSelection | null>(getStoredSelection);
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (!selection && !hasRedirected.current) {
      hasRedirected.current = true;
      router.push('/');
    }
  }, [selection, router]);

  if (!selection) {
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
          <p className="mt-3 text-sm text-transcend-brown/70">Loading booking details...</p>
        </div>
      </div>
    );
  }

  const bookingDate = new Date(selection.slotStart);
  const formattedDate = bookingDate.toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = bookingDate.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  function handleProceedToPayment() {
    router.push('/book/payment');
  }

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8">
      {/* Back Link */}
      <Link
        href={`/book/${selection.serviceId}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-transcend-brown/60 hover:text-transcend-brown transition-colors duration-brand"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Change time
      </Link>

      {/* Page Title */}
      <h1 className="mb-6 font-serif text-2xl font-bold text-transcend-brown sm:text-3xl">
        Booking Summary
      </h1>

      {/* Summary Card */}
      <div className="rounded-brand border border-transcend-khaki/30 bg-white p-5 sm:p-6">
        <h2 className="font-serif text-lg font-bold text-transcend-brown">
          {selection.serviceName}
        </h2>

        <dl className="mt-4 space-y-3">
          <div className="flex justify-between">
            <dt className="text-sm text-transcend-brown/70">Date</dt>
            <dd className="text-sm font-medium text-transcend-brown">{formattedDate}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm text-transcend-brown/70">Time</dt>
            <dd className="text-sm font-medium text-transcend-brown">{formattedTime}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm text-transcend-brown/70">Duration</dt>
            <dd className="text-sm font-medium text-transcend-brown">{selection.duration} minutes</dd>
          </div>
          <div className="flex justify-between border-t border-transcend-khaki/20 pt-3">
            <dt className="text-base font-semibold text-transcend-brown">Total</dt>
            <dd className="text-base font-bold text-transcend-gold">€{selection.price.toFixed(2)}</dd>
          </div>
        </dl>
      </div>

      {/* Proceed to Payment Button */}
      <button
        onClick={handleProceedToPayment}
        className="mt-6 w-full rounded-brand bg-transcend-sage px-4 py-3.5 text-sm font-semibold text-white transition-colors duration-brand hover:bg-transcend-sage/90 focus:outline-none focus:ring-2 focus:ring-transcend-sage/50 focus:ring-offset-2"
      >
        Proceed to Payment
      </button>

      {/* Disclaimer */}
      <p className="mt-4 text-center text-xs text-transcend-brown/50">
        You will be able to cancel your booking from the Bookings page.
      </p>
    </div>
  );
}
