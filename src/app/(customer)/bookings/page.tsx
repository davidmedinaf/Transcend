'use client';

import { useState, useEffect, useRef } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Booking {
  id: string;
  serviceName: string;
  startTime: string;
  endTime: string;
  status: string;
  confirmationId: string;
  price: number;
}

interface CancellationFeedback {
  serviceName: string;
  date: string;
  time: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Data fetching ──────────────────────────────────────────────────────────

async function fetchBookings(type: 'upcoming' | 'past'): Promise<Booking[]> {
  const res = await fetch(`/api/bookings?type=${type}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${type} bookings`);
  }
  const json = await res.json();
  return json.data ?? [];
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function BookingsPage() {
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [pastBookings, setPastBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  // Cancellation state
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);
  const [cancelError, setCancelError] = useState('');
  const [cancellationSuccess, setCancellationSuccess] = useState<CancellationFeedback | null>(null);

  const hasFetched = useRef(false);

  // ─── Fetch bookings ─────────────────────────────────────────────────────

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    async function loadBookings() {
      try {
        const [upcoming, past] = await Promise.all([
          fetchBookings('upcoming'),
          fetchBookings('past'),
        ]);
        setUpcomingBookings(upcoming);
        setPastBookings(past);
      } catch {
        setFetchError('Could not load your bookings. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }

    loadBookings();
  }, []);

  function handleRetry() {
    setFetchError('');
    setIsLoading(true);
    hasFetched.current = false;

    async function reload() {
      try {
        const [upcoming, past] = await Promise.all([
          fetchBookings('upcoming'),
          fetchBookings('past'),
        ]);
        setUpcomingBookings(upcoming);
        setPastBookings(past);
      } catch {
        setFetchError('Could not load your bookings. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }

    reload();
  }

  // ─── Cancellation handlers ──────────────────────────────────────────────

  function handleCancelClick(booking: Booking) {
    setCancelError('');
    setCancellationSuccess(null);
    setBookingToCancel(booking);
    setShowConfirmDialog(true);
  }

  function handleCancelDismiss() {
    setShowConfirmDialog(false);
    setBookingToCancel(null);
  }

  async function handleCancelConfirm() {
    if (!bookingToCancel) return;

    setShowConfirmDialog(false);
    setCancellingId(bookingToCancel.id);
    setCancelError('');

    try {
      const res = await fetch(`/api/bookings/${bookingToCancel.id}/cancel`, {
        method: 'POST',
      });

      if (!res.ok) {
        const json = await res.json();
        setCancelError(
          json.error?.message || 'Cancellation was not completed. Please try again.'
        );
        return;
      }

      // Show success feedback
      setCancellationSuccess({
        serviceName: bookingToCancel.serviceName,
        date: formatDate(bookingToCancel.startTime),
        time: formatTime(bookingToCancel.startTime),
      });

      // Remove from upcoming list
      setUpcomingBookings((prev) =>
        prev.filter((b) => b.id !== bookingToCancel.id)
      );
    } catch {
      setCancelError('Cancellation was not completed. Please try again.');
    } finally {
      setCancellingId(null);
      setBookingToCancel(null);
    }
  }

  // ─── Loading state ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center px-4 py-16">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="h-8 w-8 animate-spin text-transcend-gold"
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
          <p className="text-sm text-transcend-brown/60">Loading bookings...</p>
        </div>
      </div>
    );
  }

  // ─── Error state ────────────────────────────────────────────────────────

  if (fetchError && upcomingBookings.length === 0 && pastBookings.length === 0) {
    return (
      <div className="px-4 py-8 sm:px-6">
        <div
          role="alert"
          className="rounded-brand border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {fetchError}
        </div>
        <button
          onClick={handleRetry}
          className="mt-4 rounded-brand bg-transcend-sage px-4 py-2 text-sm font-medium text-white transition-colors duration-brand hover:bg-transcend-sage/90"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="pb-4">
      {/* Page header */}
      <section className="bg-transcend-off-white px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="font-serif text-2xl font-bold text-transcend-brown sm:text-3xl">
          My Bookings
        </h1>
        <p className="mt-1 text-sm text-transcend-brown/70">
          View and manage your appointments
        </p>
      </section>

      {/* Cancellation success feedback */}
      {cancellationSuccess && (
        <div className="mx-4 mt-4 sm:mx-6">
          <div
            role="status"
            className="rounded-brand border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          >
            <p className="font-medium">Booking cancelled successfully</p>
            <p className="mt-1 text-green-700">
              {cancellationSuccess.serviceName} on {cancellationSuccess.date} at{' '}
              {cancellationSuccess.time}
            </p>
            <button
              onClick={() => setCancellationSuccess(null)}
              className="mt-2 text-xs font-medium text-green-600 underline hover:text-green-800 transition-colors duration-brand"
              aria-label="Dismiss success message"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Cancellation error feedback */}
      {cancelError && (
        <div className="mx-4 mt-4 sm:mx-6">
          <div
            role="alert"
            className="rounded-brand border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {cancelError}
            <button
              onClick={() => setCancelError('')}
              className="ml-2 text-xs font-medium text-red-600 underline hover:text-red-800 transition-colors duration-brand"
              aria-label="Dismiss error message"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Upcoming Bookings */}
      <section className="px-4 py-6 sm:px-6">
        <h2 className="mb-4 font-serif text-lg font-bold text-transcend-brown sm:text-xl">
          Upcoming
        </h2>

        {upcomingBookings.length === 0 ? (
          <p className="text-sm text-transcend-brown/60">
            No upcoming bookings. Browse our services to book an appointment.
          </p>
        ) : (
          <ul className="space-y-3" aria-label="Upcoming bookings">
            {upcomingBookings.map((booking) => (
              <li key={booking.id}>
                <div className="rounded-brand border border-transcend-khaki/20 bg-white p-4 shadow-sm transition-shadow duration-brand hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-transcend-brown truncate">
                        {booking.serviceName}
                      </h3>
                      <p className="mt-1 text-sm text-transcend-brown/70">
                        {formatDate(booking.startTime)}
                      </p>
                      <p className="text-sm text-transcend-brown/70">
                        {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
                      </p>
                      <span className="mt-2 inline-block rounded-full bg-transcend-sage/10 px-2.5 py-0.5 text-xs font-medium text-transcend-sage">
                        {booking.status}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCancelClick(booking)}
                      disabled={cancellingId === booking.id}
                      className="shrink-0 rounded-brand border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors duration-brand hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={`Cancel booking for ${booking.serviceName}`}
                    >
                      {cancellingId === booking.id ? 'Cancelling...' : 'Cancel'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Past Bookings */}
      <section className="bg-transcend-black px-4 py-6 sm:px-6">
        <h2 className="mb-4 font-serif text-lg font-bold text-transcend-gold sm:text-xl">
          History
        </h2>

        {pastBookings.length === 0 ? (
          <p className="text-sm text-transcend-off-white/60">
            No past bookings yet.
          </p>
        ) : (
          <ul className="space-y-3" aria-label="Past bookings">
            {pastBookings.map((booking) => (
              <li key={booking.id}>
                <div className="rounded-brand border border-transcend-gold/10 bg-white/5 p-4">
                  <h3 className="font-medium text-transcend-off-white truncate">
                    {booking.serviceName}
                  </h3>
                  <p className="mt-1 text-sm text-transcend-off-white/70">
                    {formatDate(booking.startTime)}
                  </p>
                  <p className="text-sm text-transcend-off-white/70">
                    {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
                  </p>
                  <span
                    className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      booking.status === 'cancelled'
                        ? 'bg-red-900/20 text-red-300'
                        : 'bg-transcend-gold/10 text-transcend-gold'
                    }`}
                  >
                    {booking.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Confirmation Dialog */}
      {showConfirmDialog && bookingToCancel && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-dialog-title"
        >
          <div className="w-full max-w-sm rounded-brand bg-white p-6 shadow-xl">
            <h3
              id="cancel-dialog-title"
              className="font-serif text-lg font-bold text-transcend-brown"
            >
              Cancel Booking?
            </h3>
            <p className="mt-3 text-sm text-transcend-brown/80">
              Are you sure you want to cancel the following booking?
            </p>

            <div className="mt-4 rounded-brand bg-transcend-off-white p-3">
              <p className="font-medium text-transcend-brown">
                {bookingToCancel.serviceName}
              </p>
              <p className="mt-1 text-sm text-transcend-brown/70">
                {formatDate(bookingToCancel.startTime)}
              </p>
              <p className="text-sm text-transcend-brown/70">
                {formatTime(bookingToCancel.startTime)} –{' '}
                {formatTime(bookingToCancel.endTime)}
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleCancelDismiss}
                className="flex-1 rounded-brand border border-transcend-khaki/40 bg-white px-4 py-2.5 text-sm font-medium text-transcend-brown transition-colors duration-brand hover:bg-transcend-off-white"
              >
                Keep Booking
              </button>
              <button
                onClick={handleCancelConfirm}
                className="flex-1 rounded-brand bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-brand hover:bg-red-700"
              >
                Cancel Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
