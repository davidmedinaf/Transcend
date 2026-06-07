/**
 * Domain types for the Transcend Wellness application.
 * These represent the business-layer abstractions used across services and components.
 */

export type UserRole = 'admin' | 'customer';
export type BookingStatus = 'confirmed' | 'cancelled';
export type ServiceCategory = 'Recovery' | 'Treatments' | 'Coaching' | 'Events';
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// ─── User & Auth ────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}

export interface Session {
  token: string;
  expiresAt: Date;
  user: { id: string; email: string; role: UserRole };
}

export type AuthError =
  | 'email_taken'
  | 'invalid_credentials'
  | 'account_locked'
  | 'invalid_email'
  | 'invalid_password';

export interface AuthResult {
  success: boolean;
  session?: Session;
  error?: AuthError;
}

// ─── Services ───────────────────────────────────────────────────────────────

export interface Service {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  duration: number; // minutes
  price: number; // EUR
  category: ServiceCategory;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateServiceInput {
  name: string;
  description: string;
  duration: number;
  price: number;
  category: ServiceCategory;
  imageFile?: File;
}

export interface UpdateServiceInput {
  name?: string;
  description?: string;
  duration?: number;
  price?: number;
  category?: ServiceCategory;
  imageFile?: File;
}

// ─── Availability & Time Slots ──────────────────────────────────────────────

export interface AvailabilityBlock {
  id: string;
  serviceId: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // HH:MM in 15-min increments, CET/CEST
  endTime: string; // HH:MM in 15-min increments, CET/CEST
}

export interface TimeSlot {
  serviceId: string;
  startTime: Date;
  endTime: Date;
  isAvailable: boolean;
}

// ─── Bookings ───────────────────────────────────────────────────────────────

export interface Booking {
  id: string;
  tenantId: string;
  customerId: string;
  serviceId: string;
  serviceName: string;
  customerEmail: string;
  startTime: Date;
  endTime: Date;
  price: number;
  status: BookingStatus;
  confirmationId: string;
  createdAt: Date;
}

export type BookingError = 'slot_unavailable' | 'system_error';

export interface BookingResult {
  success: boolean;
  booking?: Booking;
  error?: BookingError;
}

export interface BookingFilters {
  dateFrom?: Date;
  dateTo?: Date; // max 90 days range
  serviceId?: string;
}

// ─── Pagination ─────────────────────────────────────────────────────────────

export interface PaginationInput {
  page: number;
  pageSize: number; // default 20
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Payment (Simulated) ────────────────────────────────────────────────────

export interface PaymentResult {
  success: boolean; // always true in POC
  transactionId: string;
  processedAt: Date;
}

// ─── API Error ──────────────────────────────────────────────────────────────

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, string>;
  };
}
