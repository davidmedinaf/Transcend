import { createAdminClient } from '@/lib/supabase/admin';
import type {
  Booking,
  BookingResult,
  BookingError,
  BookingFilters,
  PaginationInput,
  PaginatedResult,
} from '@/lib/types';

// ─── Result Types ───────────────────────────────────────────────────────────

export interface CancelResult {
  success: boolean;
  error?: 'already_cancelled' | 'not_found' | 'unauthorized' | 'system_error';
}

// ─── Interface ──────────────────────────────────────────────────────────────

export interface IBookingService {
  createBooking(
    customerId: string,
    serviceId: string,
    slotStart: Date
  ): Promise<BookingResult>;
  cancelBooking(bookingId: string, cancelledBy: string): Promise<CancelResult>;
  getBookingsByCustomer(
    customerId: string,
    type: 'upcoming' | 'past'
  ): Promise<Booking[]>;
  getBookingsAdmin(
    filters: BookingFilters,
    pagination: PaginationInput
  ): Promise<PaginatedResult<Booking>>;
}

// ─── DB Row Types ───────────────────────────────────────────────────────────

interface BookingRow {
  id: string;
  tenant_id: string;
  customer_id: string;
  service_id: string;
  confirmation_id: string;
  start_time: string;
  end_time: string;
  price: number;
  status: 'confirmed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

interface BookingRowWithJoins extends BookingRow {
  services: { name: string } | null;
  profiles: { email: string } | null;
}

// ─── Row-to-Domain Mapper ───────────────────────────────────────────────────

function mapRowToBooking(row: BookingRowWithJoins): Booking {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    customerId: row.customer_id,
    serviceId: row.service_id,
    serviceName: row.services?.name ?? '',
    customerEmail: row.profiles?.email ?? '',
    startTime: new Date(row.start_time),
    endTime: new Date(row.end_time),
    price: row.price,
    status: row.status,
    confirmationId: row.confirmation_id,
    createdAt: new Date(row.created_at),
  };
}

// ─── Service Implementation ─────────────────────────────────────────────────

export class BookingService implements IBookingService {
  /**
   * Creates a booking atomically. Uses the partial unique index on
   * bookings(service_id, start_time) WHERE status = 'confirmed' to prevent
   * double-booking. If a race condition occurs, the second insert will fail
   * with error code 23505 (unique_violation).
   */
  async createBooking(
    customerId: string,
    serviceId: string,
    slotStart: Date
  ): Promise<BookingResult> {
    try {
      const supabase = createAdminClient();

      // Get service details to compute end_time and store price
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: serviceData, error: serviceError } = await (supabase as any)
        .from('services')
        .select('duration_minutes, price')
        .eq('id', serviceId)
        .eq('is_active', true)
        .single();

      if (serviceError || !serviceData) {
        return { success: false, error: 'system_error' as BookingError };
      }

      const service = serviceData as { duration_minutes: number; price: number };

      // Compute end_time from start_time + duration
      const slotEnd = new Date(slotStart.getTime() + service.duration_minutes * 60 * 1000);

      // Atomic INSERT — the partial unique index handles race conditions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('bookings')
        .insert({
          customer_id: customerId,
          service_id: serviceId,
          start_time: slotStart.toISOString(),
          end_time: slotEnd.toISOString(),
          price: service.price,
          status: 'confirmed',
        })
        .select(`
          *,
          services:service_id ( name ),
          profiles:customer_id ( email )
        `)
        .single();

      if (error) {
        // Check for unique_violation (error code 23505) — slot already booked
        if ((error as { code?: string }).code === '23505') {
          return { success: false, error: 'slot_unavailable' as BookingError };
        }
        return { success: false, error: 'system_error' as BookingError };
      }

      if (!data) {
        return { success: false, error: 'system_error' as BookingError };
      }

      return {
        success: true,
        booking: mapRowToBooking(data as BookingRowWithJoins),
      };
    } catch {
      return { success: false, error: 'system_error' as BookingError };
    }
  }

  /**
   * Cancels a booking. Checks that:
   * 1. The booking exists
   * 2. The booking is not already cancelled
   * 3. The cancelledBy user is the booking's customer or an admin
   *
   * When cancelled, the partial unique index releases the slot automatically
   * (the constraint only applies WHERE status = 'confirmed').
   */
  async cancelBooking(
    bookingId: string,
    cancelledBy: string
  ): Promise<CancelResult> {
    try {
      const supabase = createAdminClient();

      // Fetch the booking and check current status
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: booking, error: fetchError } = await (supabase as any)
        .from('bookings')
        .select('id, customer_id, status')
        .eq('id', bookingId)
        .single();

      if (fetchError || !booking) {
        return { success: false, error: 'not_found' };
      }

      const bookingData = booking as { id: string; customer_id: string; status: string };

      // Guard: already cancelled
      if (bookingData.status === 'cancelled') {
        return { success: false, error: 'already_cancelled' };
      }

      // Authorization check: must be the customer who owns the booking or an admin
      if (bookingData.customer_id !== cancelledBy) {
        // Check if cancelledBy is an admin
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profile, error: profileError } = await (supabase as any)
          .from('profiles')
          .select('role')
          .eq('id', cancelledBy)
          .single();

        if (profileError || !profile) {
          return { success: false, error: 'unauthorized' };
        }

        const profileData = profile as { role: string };
        if (profileData.role !== 'admin') {
          return { success: false, error: 'unauthorized' };
        }
      }

      // Update status to cancelled
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('bookings')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', bookingId);

      if (updateError) {
        return { success: false, error: 'system_error' };
      }

      return { success: true };
    } catch {
      return { success: false, error: 'system_error' };
    }
  }

  /**
   * Gets bookings for a customer, split by type:
   * - upcoming: start_time > NOW(), sorted ascending
   * - past: start_time <= NOW(), sorted descending, limited to 50
   */
  async getBookingsByCustomer(
    customerId: string,
    type: 'upcoming' | 'past'
  ): Promise<Booking[]> {
    try {
      const supabase = createAdminClient();
      const now = new Date().toISOString();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('bookings')
        .select(`
          *,
          services:service_id ( name ),
          profiles:customer_id ( email )
        `)
        .eq('customer_id', customerId);

      if (type === 'upcoming') {
        query = query
          .gt('start_time', now)
          .order('start_time', { ascending: true });
      } else {
        // past bookings: start_time <= now, descending, limit 50
        query = query
          .lte('start_time', now)
          .order('start_time', { ascending: false })
          .limit(50);
      }

      const { data, error } = await query;

      if (error || !data) {
        return [];
      }

      return (data as BookingRowWithJoins[]).map(mapRowToBooking);
    } catch {
      return [];
    }
  }

  /**
   * Gets bookings for admin view with filtering and pagination.
   * - Supports date range filter (max 90 days enforced)
   * - Supports service filter
   * - Paginated (default 20/page)
   * - Sorted by start_time ascending (nearest upcoming first)
   */
  async getBookingsAdmin(
    filters: BookingFilters,
    pagination: PaginationInput
  ): Promise<PaginatedResult<Booking>> {
    try {
      const supabase = createAdminClient();

      const page = pagination.page ?? 1;
      const pageSize = pagination.pageSize ?? 20;

      // Enforce max 90-day date range if both dates provided
      if (filters.dateFrom && filters.dateTo) {
        const diffMs = filters.dateTo.getTime() - filters.dateFrom.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (diffDays > 90) {
          return {
            data: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0,
          };
        }
      }

      // Calculate offset
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Build query
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('bookings')
        .select(
          `
          *,
          services:service_id ( name ),
          profiles:customer_id ( email )
        `,
          { count: 'exact' }
        );

      // Apply date range filter
      if (filters.dateFrom) {
        query = query.gte('start_time', filters.dateFrom.toISOString());
      }
      if (filters.dateTo) {
        query = query.lte('start_time', filters.dateTo.toISOString());
      }

      // Apply service filter
      if (filters.serviceId) {
        query = query.eq('service_id', filters.serviceId);
      }

      // Apply sorting and pagination
      query = query
        .order('start_time', { ascending: true })
        .range(from, to);

      const { data, error, count } = await query;

      if (error || !data) {
        return {
          data: [],
          total: 0,
          page,
          pageSize,
          totalPages: 0,
        };
      }

      const total = (count as number) ?? 0;

      return {
        data: (data as BookingRowWithJoins[]).map(mapRowToBooking),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch {
      return {
        data: [],
        total: 0,
        page: pagination.page ?? 1,
        pageSize: pagination.pageSize ?? 20,
        totalPages: 0,
      };
    }
  }
}
