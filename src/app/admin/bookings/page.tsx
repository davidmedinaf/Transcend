'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Booking {
  id: string;
  customerId: string;
  serviceId: string;
  serviceName: string;
  customerEmail: string;
  startTime: string;
  endTime: string;
  price: number;
  status: string;
  confirmationId: string;
  createdAt: string;
}

interface PaginatedResponse {
  data: Booking[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ServiceOption {
  id: string;
  name: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-GB', {
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

function toInputDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysBetween(dateA: Date, dateB: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.abs(Math.floor((dateB.getTime() - dateA.getTime()) / msPerDay));
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AdminBookingsPage() {
  // Data state
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  // Filter state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [dateRangeError, setDateRangeError] = useState('');

  // Services list for filter dropdown
  const [services, setServices] = useState<ServiceOption[]>([]);

  // Cancellation state
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);
  const [cancelError, setCancelError] = useState('');
  const [cancelSuccess, setCancelSuccess] = useState('');

  const hasLoadedServices = useRef(false);
  const PAGE_SIZE = 20;

  // ─── Fetch services for filter dropdown ─────────────────────────────────

  useEffect(() => {
    if (hasLoadedServices.current) return;
    hasLoadedServices.current = true;

    async function loadServices() {
      try {
        const res = await fetch('/api/services?pageSize=100');
        if (res.ok) {
          const json = await res.json();
          const serviceList: ServiceOption[] = (json.data ?? []).map(
            (s: { id: string; name: string }) => ({
              id: s.id,
              name: s.name,
            })
          );
          setServices(serviceList);
        }
      } catch {
        // Non-critical: filter will just be unavailable
      }
    }

    loadServices();
  }, []);

  // ─── Fetch bookings ─────────────────────────────────────────────────────

  const fetchBookings = useCallback(
    async (page: number) => {
      setIsLoading(true);
      setFetchError('');

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
        });

        if (dateFrom) params.set('dateFrom', new Date(dateFrom).toISOString());
        if (dateTo) params.set('dateTo', new Date(dateTo).toISOString());
        if (selectedServiceId) params.set('serviceId', selectedServiceId);

        const res = await fetch(`/api/bookings?${params.toString()}`);
        if (!res.ok) {
          throw new Error('Failed to fetch bookings');
        }

        const json: PaginatedResponse = await res.json();
        setBookings(json.data);
        setTotalPages(json.totalPages);
        setTotal(json.total);
        setCurrentPage(json.page);
      } catch {
        setFetchError('Failed to load bookings. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [dateFrom, dateTo, selectedServiceId]
  );

  // Fetch on mount and whenever filters change
  useEffect(() => {
    fetchBookings(1);
  }, [fetchBookings]);

  // ─── Filter handlers ────────────────────────────────────────────────────

  function handleDateFromChange(value: string) {
    setDateRangeError('');
    setDateFrom(value);

    if (value && dateTo) {
      const from = new Date(value);
      const to = new Date(dateTo);
      if (daysBetween(from, to) > 90) {
        setDateRangeError('Date range cannot exceed 90 days.');
      }
    }
  }

  function handleDateToChange(value: string) {
    setDateRangeError('');
    setDateTo(value);

    if (dateFrom && value) {
      const from = new Date(dateFrom);
      const to = new Date(value);
      if (daysBetween(from, to) > 90) {
        setDateRangeError('Date range cannot exceed 90 days.');
      }
    }
  }

  function handleClearFilters() {
    setDateFrom('');
    setDateTo('');
    setSelectedServiceId('');
    setDateRangeError('');
  }

  // ─── Pagination handlers ────────────────────────────────────────────────

  function handlePrevPage() {
    if (currentPage > 1) {
      fetchBookings(currentPage - 1);
    }
  }

  function handleNextPage() {
    if (currentPage < totalPages) {
      fetchBookings(currentPage + 1);
    }
  }

  // ─── Cancellation handlers ──────────────────────────────────────────────

  function handleCancelClick(booking: Booking) {
    setCancelError('');
    setCancelSuccess('');
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
        const errorCode = json.error?.code;

        if (errorCode === 'already_cancelled') {
          setCancelError('This booking has already been cancelled.');
          // Refresh to show updated status
          fetchBookings(currentPage);
        } else {
          setCancelError(
            json.error?.message || 'Cancellation was unsuccessful. The booking status remains unchanged.'
          );
        }
        return;
      }

      setCancelSuccess(
        `Booking for ${bookingToCancel.customerEmail} — ${bookingToCancel.serviceName} cancelled successfully.`
      );

      // Update the booking status locally
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingToCancel.id ? { ...b, status: 'cancelled' } : b
        )
      );
    } catch {
      setCancelError('Cancellation was unsuccessful. The booking status remains unchanged.');
    } finally {
      setCancellingId(null);
      setBookingToCancel(null);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div>
      <h1 className="font-serif text-2xl text-transcend-gold mb-6">
        Booking Management
      </h1>

      {/* Filters */}
      <div className="rounded-brand border border-white/10 bg-white/5 p-5 mb-6">
        <h2 className="text-sm font-medium text-white/80 mb-4">Filters</h2>
        <div className="flex flex-wrap items-end gap-4">
          {/* Date From */}
          <div className="flex flex-col gap-1">
            <label htmlFor="dateFrom" className="text-xs text-white/60">
              Date from
            </label>
            <input
              type="date"
              id="dateFrom"
              value={dateFrom}
              onChange={(e) => handleDateFromChange(e.target.value)}
              max={dateTo || toInputDateString(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000))}
              className="rounded-brand border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-transcend-gold/50 focus:outline-none focus:ring-1 focus:ring-transcend-gold/30"
            />
          </div>

          {/* Date To */}
          <div className="flex flex-col gap-1">
            <label htmlFor="dateTo" className="text-xs text-white/60">
              Date to
            </label>
            <input
              type="date"
              id="dateTo"
              value={dateTo}
              onChange={(e) => handleDateToChange(e.target.value)}
              min={dateFrom || undefined}
              className="rounded-brand border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-transcend-gold/50 focus:outline-none focus:ring-1 focus:ring-transcend-gold/30"
            />
          </div>

          {/* Service Filter */}
          <div className="flex flex-col gap-1">
            <label htmlFor="serviceFilter" className="text-xs text-white/60">
              Service
            </label>
            <select
              id="serviceFilter"
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              className="rounded-brand border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-transcend-gold/50 focus:outline-none focus:ring-1 focus:ring-transcend-gold/30"
            >
              <option value="" className="bg-[#1a1a1a] text-white">
                All services
              </option>
              {services.map((service) => (
                <option
                  key={service.id}
                  value={service.id}
                  className="bg-[#1a1a1a] text-white"
                >
                  {service.name}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          <button
            onClick={handleClearFilters}
            className="rounded-brand border border-white/20 bg-white/5 px-4 py-2 text-sm text-white/70 transition-colors duration-brand hover:text-white hover:bg-white/10"
          >
            Clear filters
          </button>
        </div>

        {/* Date range validation error */}
        {dateRangeError && (
          <p className="mt-3 text-sm text-red-400" role="alert">
            {dateRangeError}
          </p>
        )}
      </div>

      {/* Success message */}
      {cancelSuccess && (
        <div className="mb-4 rounded-brand border border-green-500/30 bg-green-900/20 px-4 py-3 text-sm text-green-300">
          {cancelSuccess}
          <button
            onClick={() => setCancelSuccess('')}
            className="ml-3 text-xs text-green-400 underline hover:text-green-200 transition-colors duration-brand"
            aria-label="Dismiss success message"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error message */}
      {cancelError && (
        <div className="mb-4 rounded-brand border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-300" role="alert">
          {cancelError}
          <button
            onClick={() => setCancelError('')}
            className="ml-3 text-xs text-red-400 underline hover:text-red-200 transition-colors duration-brand"
            aria-label="Dismiss error message"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
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
            <p className="text-sm text-white/60">Loading bookings...</p>
          </div>
        </div>
      )}

      {/* Fetch error */}
      {fetchError && !isLoading && (
        <div className="rounded-brand border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-300" role="alert">
          {fetchError}
          <button
            onClick={() => fetchBookings(currentPage)}
            className="ml-3 text-xs text-red-400 underline hover:text-red-200 transition-colors duration-brand"
          >
            Retry
          </button>
        </div>
      )}

      {/* Bookings table */}
      {!isLoading && !fetchError && (
        <>
          {bookings.length === 0 ? (
            <div className="rounded-brand border border-white/10 bg-white/5 px-6 py-12 text-center">
              <p className="text-sm text-white/60">
                No bookings found{dateFrom || dateTo || selectedServiceId ? ' matching your filters.' : '.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-brand border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="px-4 py-3 text-left font-medium text-white/70">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-white/70">
                      Service
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-white/70">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-white/70">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-white/70">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-white/70">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => (
                    <tr
                      key={booking.id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors duration-brand"
                    >
                      <td className="px-4 py-3 text-white/90">
                        {booking.customerEmail}
                      </td>
                      <td className="px-4 py-3 text-white/90">
                        {booking.serviceName}
                      </td>
                      <td className="px-4 py-3 text-white/70">
                        {formatDate(booking.startTime)}
                      </td>
                      <td className="px-4 py-3 text-white/70">
                        {formatTime(booking.startTime)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            booking.status === 'confirmed'
                              ? 'bg-transcend-gold/10 text-transcend-gold'
                              : 'bg-red-900/20 text-red-300'
                          }`}
                        >
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {booking.status === 'confirmed' && (
                          <button
                            onClick={() => handleCancelClick(booking)}
                            disabled={cancellingId === booking.id}
                            className="rounded-brand border border-red-500/30 bg-red-900/20 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors duration-brand hover:bg-red-900/40 hover:text-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label={`Cancel booking for ${booking.customerEmail}`}
                          >
                            {cancellingId === booking.id ? 'Cancelling...' : 'Cancel'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-white/60">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, total)} of {total} bookings
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage <= 1}
                  className="rounded-brand border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-white/70 transition-colors duration-brand hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  ← Prev
                </button>
                <span className="text-sm text-white/60">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages}
                  className="rounded-brand border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-white/70 transition-colors duration-brand hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Cancellation Confirmation Dialog */}
      {showConfirmDialog && bookingToCancel && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-dialog-title"
        >
          <div className="w-full max-w-md rounded-brand border border-white/10 bg-[#1a1a1a] p-6 shadow-xl">
            <h3
              id="cancel-dialog-title"
              className="font-serif text-lg text-transcend-gold"
            >
              Cancel Booking?
            </h3>
            <p className="mt-3 text-sm text-white/70">
              Are you sure you want to cancel this booking?
            </p>

            <div className="mt-4 rounded-brand border border-white/10 bg-white/5 p-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">Customer:</span>
                  <span className="text-white">{bookingToCancel.customerEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Service:</span>
                  <span className="text-white">{bookingToCancel.serviceName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Date:</span>
                  <span className="text-white">
                    {formatDate(bookingToCancel.startTime)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Time:</span>
                  <span className="text-white">
                    {formatTime(bookingToCancel.startTime)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleCancelDismiss}
                className="flex-1 rounded-brand border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition-colors duration-brand hover:bg-white/10 hover:text-white"
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
