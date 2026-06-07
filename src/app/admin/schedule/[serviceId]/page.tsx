'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AvailabilityBlock {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface ServiceInfo {
  id: string;
  name: string;
  duration: number;
  category: string;
}

interface ConfirmedBooking {
  id: string;
  startTime: string;
  endTime: string;
  customerEmail: string;
  confirmationId: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * Generate time options in 15-minute increments from 00:00 to 23:45
 */
function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      options.push(
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
      );
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

// ─── Component ──────────────────────────────────────────────────────────────

export default function AdminScheduleServicePage() {
  const params = useParams();
  const serviceId = params.serviceId as string;

  const [service, setService] = useState<ServiceInfo | null>(null);
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [confirmedBookings, setConfirmedBookings] = useState<ConfirmedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const hasFetched = useRef(false);

  // ─── Fetch Data ─────────────────────────────────────────────────────────

  async function fetchData() {
    setLoading(true);
    setError(null);

    try {
      // Fetch service info and availability in parallel
      const [serviceRes, availRes, bookingsRes] = await Promise.all([
        fetch(`/api/services/${serviceId}`),
        fetch(`/api/availability/${serviceId}`),
        fetch(`/api/bookings?serviceId=${serviceId}&status=confirmed`),
      ]);

      if (!serviceRes.ok) {
        const serviceData = await serviceRes.json();
        setError(serviceData?.error?.message ?? 'Service not found');
        setLoading(false);
        return;
      }

      const serviceData = await serviceRes.json();
      setService(serviceData.data);

      if (availRes.ok) {
        const availData = await availRes.json();
        setBlocks(availData.data ?? []);
      }

      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json();
        // Only show future confirmed bookings
        const now = new Date().toISOString();
        const futureBookings = (bookingsData.data ?? []).filter(
          (b: ConfirmedBooking) => b.startTime > now
        );
        setConfirmedBookings(futureBookings);
      }
    } catch {
      setError('Network error. Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  // ─── Local Validation ───────────────────────────────────────────────────

  function validateLocally(): string[] {
    const errors: string[] = [];
    if (!service) return errors;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];

      // Check end > start
      if (block.endTime <= block.startTime) {
        errors.push(
          `Block ${i + 1} (${DAYS_OF_WEEK[block.dayOfWeek]}): End time must be after start time`
        );
      } else {
        // Check block duration >= service duration
        const startMins = timeToMinutes(block.startTime);
        const endMins = timeToMinutes(block.endTime);
        const blockDuration = endMins - startMins;
        if (blockDuration < service.duration) {
          errors.push(
            `Block ${i + 1} (${DAYS_OF_WEEK[block.dayOfWeek]}): Block duration (${blockDuration} min) must be at least the service duration (${service.duration} min)`
          );
        }
      }
    }

    // Check for overlaps on the same day
    const blocksByDay = new Map<number, Array<{ index: number; startTime: string; endTime: string }>>();
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const dayBlocks = blocksByDay.get(block.dayOfWeek) ?? [];
      dayBlocks.push({ index: i, startTime: block.startTime, endTime: block.endTime });
      blocksByDay.set(block.dayOfWeek, dayBlocks);
    }

    for (const [day, dayBlocks] of blocksByDay) {
      for (let i = 0; i < dayBlocks.length; i++) {
        for (let j = i + 1; j < dayBlocks.length; j++) {
          if (blocksOverlap(dayBlocks[i], dayBlocks[j])) {
            errors.push(
              `Blocks ${dayBlocks[i].index + 1} and ${dayBlocks[j].index + 1} overlap on ${DAYS_OF_WEEK[day]}`
            );
          }
        }
      }
    }

    return errors;
  }

  // ─── Save Handler ───────────────────────────────────────────────────────

  async function handleSave() {
    setSaveSuccess(false);
    setValidationErrors([]);

    // Run local validation first
    const localErrors = validateLocally();
    if (localErrors.length > 0) {
      setValidationErrors(localErrors);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = blocks.map((block) => ({
        dayOfWeek: block.dayOfWeek,
        startTime: block.startTime,
        endTime: block.endTime,
      }));

      const res = await fetch(`/api/availability/${serviceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data?.error?.message ?? 'Failed to save availability';
        setValidationErrors([errorMsg]);
        return;
      }

      setSaveSuccess(true);
      // Re-fetch to get persisted IDs
      hasFetched.current = false;
      fetchData();
    } catch {
      setError('Network error. Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  // ─── Block Manipulation ─────────────────────────────────────────────────

  function addBlock() {
    setBlocks((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        dayOfWeek: 1, // Default: Monday
        startTime: '09:00',
        endTime: '17:00',
      },
    ]);
    setSaveSuccess(false);
    setValidationErrors([]);
  }

  function removeBlock(index: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
    setSaveSuccess(false);
    setValidationErrors([]);
  }

  function updateBlock(index: number, field: keyof AvailabilityBlock, value: string | number) {
    setBlocks((prev) =>
      prev.map((block, i) => (i === index ? { ...block, [field]: value } : block))
    );
    setSaveSuccess(false);
    setValidationErrors([]);
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <Link
            href="/admin/schedule"
            className="text-sm text-white/50 hover:text-transcend-gold transition-colors duration-brand"
          >
            ← Back to Schedule
          </Link>
        </div>
        <div className="rounded-brand border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 border-2 border-transcend-gold border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-white/70">Loading schedule...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !service) {
    return (
      <div>
        <div className="mb-6">
          <Link
            href="/admin/schedule"
            className="text-sm text-white/50 hover:text-transcend-gold transition-colors duration-brand"
          >
            ← Back to Schedule
          </Link>
        </div>
        <div className="rounded-brand border border-red-500/30 bg-red-500/5 p-6">
          <p className="text-sm font-medium text-red-400 mb-1">Error</p>
          <p className="text-sm text-white/70">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/schedule"
          className="text-sm text-white/50 hover:text-transcend-gold transition-colors duration-brand"
        >
          ← Back to Schedule
        </Link>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl text-transcend-gold mb-1">
            {service?.name}
          </h1>
          <p className="text-white/60 text-sm">
            {service?.category} · {service?.duration} min per session
          </p>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="rounded-brand border border-red-500/30 bg-red-500/5 p-5 mb-6">
          <p className="text-sm font-medium text-red-400 mb-2">
            Validation Errors
          </p>
          <ul className="space-y-1">
            {validationErrors.map((err, i) => (
              <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                <span className="text-red-400 mt-0.5">•</span>
                {err}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Save Success */}
      {saveSuccess && (
        <div className="rounded-brand border border-transcend-gold/30 bg-transcend-gold/5 p-5 mb-6">
          <p className="text-sm text-transcend-gold">
            Availability saved successfully.
          </p>
        </div>
      )}

      {/* Network Error */}
      {error && service && (
        <div className="rounded-brand border border-red-500/30 bg-red-500/5 p-5 mb-6">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Availability Blocks */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg text-transcend-gold">
            Weekly Availability Blocks
          </h2>
          <button
            onClick={addBlock}
            className="px-4 py-2 rounded-brand bg-transcend-gold text-transcend-black font-medium text-sm transition-colors duration-brand hover:bg-transcend-gold/90"
          >
            + Add Block
          </button>
        </div>

        {blocks.length === 0 ? (
          <div className="rounded-brand border border-white/10 bg-white/5 p-6 text-center">
            <p className="text-sm text-white/50">
              No availability blocks configured. This service is not currently
              bookable.
            </p>
            <button
              onClick={addBlock}
              className="mt-3 px-4 py-2 rounded-brand border border-transcend-gold/50 text-transcend-gold text-sm transition-colors duration-brand hover:bg-transcend-gold/10"
            >
              + Add First Block
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {blocks.map((block, index) => (
              <div
                key={block.id || index}
                className="rounded-brand border border-white/10 bg-white/5 p-4"
              >
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Block number */}
                  <span className="text-xs text-white/40 font-mono w-6">
                    #{index + 1}
                  </span>

                  {/* Day of Week */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/40">Day</label>
                    <select
                      value={block.dayOfWeek}
                      onChange={(e) =>
                        updateBlock(index, 'dayOfWeek', parseInt(e.target.value, 10))
                      }
                      className="rounded-brand bg-white/10 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-transcend-gold/50 min-w-[140px]"
                    >
                      {DAYS_OF_WEEK.map((day, i) => (
                        <option key={i} value={i} className="bg-[#2a2a2a] text-white">
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Start Time */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/40">Start</label>
                    <select
                      value={block.startTime}
                      onChange={(e) =>
                        updateBlock(index, 'startTime', e.target.value)
                      }
                      className="rounded-brand bg-white/10 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-transcend-gold/50 min-w-[100px]"
                    >
                      {TIME_OPTIONS.map((time) => (
                        <option key={time} value={time} className="bg-[#2a2a2a] text-white">
                          {time}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* End Time */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/40">End</label>
                    <select
                      value={block.endTime}
                      onChange={(e) =>
                        updateBlock(index, 'endTime', e.target.value)
                      }
                      className="rounded-brand bg-white/10 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-transcend-gold/50 min-w-[100px]"
                    >
                      {TIME_OPTIONS.map((time) => (
                        <option key={time} value={time} className="bg-[#2a2a2a] text-white">
                          {time}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Slots info */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/40">Slots</label>
                    <span className="text-sm text-white/60 py-2">
                      {block.endTime > block.startTime && service
                        ? `${Math.floor((timeToMinutes(block.endTime) - timeToMinutes(block.startTime)) / service.duration)} × ${service.duration} min`
                        : '—'}
                    </span>
                  </div>

                  {/* Remove button */}
                  <div className="ml-auto">
                    <button
                      onClick={() => removeBlock(index)}
                      className="px-3 py-2 rounded-brand border border-red-500/30 text-red-400 text-sm transition-colors duration-brand hover:bg-red-500/10 hover:border-red-500/50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-4 mb-10">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 rounded-brand bg-transcend-gold text-transcend-black font-medium text-sm transition-colors duration-brand hover:bg-transcend-gold/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Schedule'}
        </button>
        {saving && (
          <div className="h-4 w-4 border-2 border-transcend-gold border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Confirmed Bookings Section */}
      {confirmedBookings.length > 0 && (
        <div>
          <h2 className="font-serif text-lg text-transcend-gold mb-2">
            Existing Confirmed Bookings
          </h2>
          <p className="text-xs text-white/50 mb-4">
            These bookings will not be affected by schedule changes.
          </p>
          <div className="rounded-brand border border-white/10 bg-white/5 divide-y divide-white/5">
            {confirmedBookings.slice(0, 20).map((booking) => (
              <div
                key={booking.id}
                className="flex items-center justify-between px-5 py-3"
              >
                <div>
                  <p className="text-sm text-white">
                    {formatDateTime(booking.startTime)} –{' '}
                    {formatTime(booking.endTime)}
                  </p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {booking.customerEmail} · {booking.confirmationId}
                  </p>
                </div>
                <span className="text-xs text-transcend-gold/70 px-2 py-1 rounded bg-transcend-gold/10">
                  Confirmed
                </span>
              </div>
            ))}
            {confirmedBookings.length > 20 && (
              <div className="px-5 py-3">
                <p className="text-xs text-white/40">
                  ... and {confirmedBookings.length - 20} more bookings
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Utility Functions ──────────────────────────────────────────────────────

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function blocksOverlap(
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string }
): boolean {
  const aStart = timeToMinutes(a.startTime);
  const aEnd = timeToMinutes(a.endTime);
  const bStart = timeToMinutes(b.startTime);
  const bEnd = timeToMinutes(b.endTime);
  return aStart < bEnd && bStart < aEnd;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
