'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
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

type PageState = 'form' | 'processing' | 'success' | 'error';

interface BookingConfirmation {
  confirmationId: string;
  serviceName: string;
  date: string;
  time: string;
  duration: number;
  price: number;
}

function getStoredSelection(): BookingSelection | null {
  if (typeof window === 'undefined') return null;
  const stored = sessionStorage.getItem('bookingSelection');
  if (!stored) return null;
  return JSON.parse(stored);
}

export default function PaymentPage() {
  const router = useRouter();
  const [selection] = useState<BookingSelection | null>(getStoredSelection);
  const [pageState, setPageState] = useState<PageState>('form');
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const hasRedirected = useRef(false);

  // Mock form fields (any input accepted)
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');

  useEffect(() => {
    if (!selection && !hasRedirected.current) {
      hasRedirected.current = true;
      router.push('/');
    }
  }, [selection, router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selection) return;

    setPageState('processing');
    setErrorMessage('');

    // Simulated 1-2 second processing delay
    const delay = 1000 + Math.random() * 1000;
    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      // Create the booking via POST /api/bookings
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selection.serviceId,
          slotStart: selection.slotStart,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error?.code === 'slot_unavailable') {
          setErrorMessage(
            'This time slot was just booked by someone else. Please go back and select a different time.'
          );
          setPageState('error');
          return;
        }
        setErrorMessage(
          data.error?.message || 'Unable to complete your booking. Please try again.'
        );
        setPageState('error');
        return;
      }

      // Success — show confirmation
      const booking = data.data;
      const bookingDate = new Date(booking.startTime);

      setConfirmation({
        confirmationId: booking.confirmationId,
        serviceName: booking.serviceName || selection.serviceName,
        date: bookingDate.toLocaleDateString('en-GB', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        time: bookingDate.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        duration: selection.duration,
        price: booking.price ?? selection.price,
      });
      setPageState('success');

      // Clear the booking selection from session storage
      sessionStorage.removeItem('bookingSelection');
    } catch {
      setErrorMessage('Unable to connect. Please check your internet connection and try again.');
      setPageState('error');
    }
  }

  // Loading/redirect if no selection
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
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="mt-3 text-sm text-transcend-brown/70">Loading...</p>
        </div>
      </div>
    );
  }

  // Processing state
  if (pageState === 'processing') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <svg
            className="mx-auto h-10 w-10 animate-spin text-transcend-gold"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="mt-4 font-serif text-lg font-semibold text-transcend-brown">
            Processing Payment...
          </p>
          <p className="mt-1 text-sm text-transcend-brown/70">
            Please wait while we confirm your booking.
          </p>
        </div>
      </div>
    );
  }

  // Success state — Confirmation
  if (pageState === 'success' && confirmation) {
    return (
      <div className="px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-sm text-center">
          {/* Success Icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-transcend-sage/10">
            <svg
              className="h-8 w-8 text-transcend-sage"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <h1 className="mt-4 font-serif text-2xl font-bold text-transcend-brown sm:text-3xl">
            Booking Confirmed
          </h1>
          <p className="mt-2 text-sm text-transcend-brown/70">
            Your appointment has been successfully booked.
          </p>

          {/* Confirmation ID */}
          <div className="mt-5 rounded-brand bg-transcend-gold/10 px-4 py-3">
            <p className="text-xs text-transcend-brown/60">Confirmation ID</p>
            <p className="mt-0.5 font-mono text-lg font-bold text-transcend-gold">
              {confirmation.confirmationId}
            </p>
          </div>

          {/* Booking Details */}
          <div className="mt-6 rounded-brand border border-transcend-khaki/30 bg-white p-5 text-left">
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-transcend-brown/70">Service</dt>
                <dd className="text-sm font-medium text-transcend-brown">{confirmation.serviceName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-transcend-brown/70">Date</dt>
                <dd className="text-sm font-medium text-transcend-brown">{confirmation.date}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-transcend-brown/70">Time</dt>
                <dd className="text-sm font-medium text-transcend-brown">{confirmation.time}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-transcend-brown/70">Duration</dt>
                <dd className="text-sm font-medium text-transcend-brown">{confirmation.duration} minutes</dd>
              </div>
              <div className="flex justify-between border-t border-transcend-khaki/20 pt-3">
                <dt className="text-sm font-semibold text-transcend-brown">Total Paid</dt>
                <dd className="text-sm font-bold text-transcend-gold">€{confirmation.price.toFixed(2)}</dd>
              </div>
            </dl>
          </div>

          {/* Actions */}
          <div className="mt-6 space-y-3">
            <Link
              href="/bookings"
              className="block w-full rounded-brand bg-transcend-sage px-4 py-3 text-center text-sm font-semibold text-white transition-colors duration-brand hover:bg-transcend-sage/90"
            >
              View My Bookings
            </Link>
            <Link
              href="/"
              className="block w-full rounded-brand border border-transcend-brown/20 bg-white px-4 py-3 text-center text-sm font-semibold text-transcend-brown transition-colors duration-brand hover:bg-transcend-off-white"
            >
              Browse More Services
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Error state — slot_unavailable or system error
  if (pageState === 'error') {
    return (
      <div className="px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-sm text-center">
          {/* Error Icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <svg
              className="h-8 w-8 text-red-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>

          <h1 className="mt-4 font-serif text-xl font-bold text-transcend-brown">
            Booking Failed
          </h1>
          <p className="mt-2 text-sm text-transcend-brown/70">
            {errorMessage}
          </p>

          {/* Actions */}
          <div className="mt-6 space-y-3">
            {errorMessage.includes('time slot') ? (
              <Link
                href={`/book/${selection.serviceId}`}
                className="block w-full rounded-brand bg-transcend-sage px-4 py-3 text-center text-sm font-semibold text-white transition-colors duration-brand hover:bg-transcend-sage/90"
              >
                Choose Another Time
              </Link>
            ) : (
              <button
                onClick={() => setPageState('form')}
                className="w-full rounded-brand bg-transcend-sage px-4 py-3 text-sm font-semibold text-white transition-colors duration-brand hover:bg-transcend-sage/90"
              >
                Try Again
              </button>
            )}
            <Link
              href="/"
              className="block w-full rounded-brand border border-transcend-brown/20 bg-white px-4 py-3 text-center text-sm font-semibold text-transcend-brown transition-colors duration-brand hover:bg-transcend-off-white"
            >
              Back to Services
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Default: Payment form
  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8">
      {/* Back Link */}
      <Link
        href="/book/confirm"
        className="mb-6 inline-flex items-center gap-1 text-sm text-transcend-brown/60 hover:text-transcend-brown transition-colors duration-brand"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to summary
      </Link>

      <h1 className="mb-2 font-serif text-2xl font-bold text-transcend-brown sm:text-3xl">
        Payment
      </h1>
      <p className="mb-6 text-sm text-transcend-brown/70">
        Complete your booking for <span className="font-medium text-transcend-brown">{selection.serviceName}</span>
      </p>

      {/* Price Display */}
      <div className="mb-6 flex items-center justify-between rounded-brand bg-transcend-gold/10 px-4 py-3">
        <span className="text-sm text-transcend-brown/70">Amount to pay</span>
        <span className="text-lg font-bold text-transcend-gold">€{selection.price.toFixed(2)}</span>
      </div>

      {/* Payment Form */}
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label
            htmlFor="cardNumber"
            className="mb-1.5 block text-sm font-medium text-transcend-brown"
          >
            Card Number
          </label>
          <input
            id="cardNumber"
            type="text"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            placeholder="4242 4242 4242 4242"
            autoComplete="cc-number"
            className="w-full rounded-brand border border-transcend-khaki/40 bg-white px-4 py-3 text-sm text-transcend-brown placeholder:text-transcend-brown/40 focus:border-transcend-gold focus:outline-none focus:ring-2 focus:ring-transcend-gold/20 transition-colors duration-brand"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="expiry"
              className="mb-1.5 block text-sm font-medium text-transcend-brown"
            >
              Expiry Date
            </label>
            <input
              id="expiry"
              type="text"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              placeholder="MM/YY"
              autoComplete="cc-exp"
              className="w-full rounded-brand border border-transcend-khaki/40 bg-white px-4 py-3 text-sm text-transcend-brown placeholder:text-transcend-brown/40 focus:border-transcend-gold focus:outline-none focus:ring-2 focus:ring-transcend-gold/20 transition-colors duration-brand"
            />
          </div>
          <div>
            <label
              htmlFor="cvc"
              className="mb-1.5 block text-sm font-medium text-transcend-brown"
            >
              CVC
            </label>
            <input
              id="cvc"
              type="text"
              value={cvc}
              onChange={(e) => setCvc(e.target.value)}
              placeholder="123"
              autoComplete="cc-csc"
              className="w-full rounded-brand border border-transcend-khaki/40 bg-white px-4 py-3 text-sm text-transcend-brown placeholder:text-transcend-brown/40 focus:border-transcend-gold focus:outline-none focus:ring-2 focus:ring-transcend-gold/20 transition-colors duration-brand"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-brand bg-transcend-sage px-4 py-3.5 text-sm font-semibold text-white transition-colors duration-brand hover:bg-transcend-sage/90 focus:outline-none focus:ring-2 focus:ring-transcend-sage/50 focus:ring-offset-2"
        >
          Pay €{selection.price.toFixed(2)}
        </button>
      </form>

      {/* Demo Notice */}
      <p className="mt-4 text-center text-xs text-transcend-brown/40">
        This is a simulated payment. Any input will be accepted.
      </p>
    </div>
  );
}
