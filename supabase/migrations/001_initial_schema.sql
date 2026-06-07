-- ============================================================================
-- Transcend Wellness POC - Initial Database Schema
-- ============================================================================
-- Requirements: 4.1, 4.5, 4.6, 5.1, 5.5, 7.3, 7.5
-- 
-- This migration creates the core database tables for the Transcend Wellness
-- booking system. It includes:
-- - profiles (extends auth.users with tenant_id and role)
-- - service_categories (grouping for services)
-- - services (wellness offerings with validation constraints)
-- - availability_schedules (weekly recurring time blocks with overlap prevention)
-- - bookings (appointments with race-condition safety via partial unique index)
-- ============================================================================

-- Enable btree_gist extension for EXCLUDE USING gist constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================================
-- Profiles (extends Supabase auth.users)
-- ============================================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'customer')) DEFAULT 'customer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Service Categories
-- ============================================================================
CREATE TABLE service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    name TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

-- ============================================================================
-- Services
-- ============================================================================
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    category_id UUID NOT NULL REFERENCES service_categories(id),
    name TEXT NOT NULL CHECK (char_length(name) <= 100),
    description TEXT NOT NULL CHECK (char_length(description) <= 500),
    duration_minutes INT NOT NULL CHECK (duration_minutes BETWEEN 1 AND 480),
    price DECIMAL(6,2) NOT NULL CHECK (price BETWEEN 0.00 AND 9999.99),
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Availability Schedules
-- ============================================================================
CREATE TABLE availability_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Prevent overlapping availability blocks for same service on same day
    EXCLUDE USING gist (
        service_id WITH =,
        day_of_week WITH =,
        tsrange(
            ('2000-01-01'::date + start_time)::timestamp,
            ('2000-01-01'::date + end_time)::timestamp
        ) WITH &&
    ),
    -- End time must be after start time
    CHECK (end_time > start_time),
    -- Start time must be aligned to 15-minute increments
    CHECK (EXTRACT(MINUTE FROM start_time)::int % 15 = 0),
    -- End time must be aligned to 15-minute increments
    CHECK (EXTRACT(MINUTE FROM end_time)::int % 15 = 0)
);

-- ============================================================================
-- Bookings
-- ============================================================================
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    customer_id UUID NOT NULL REFERENCES profiles(id),
    service_id UUID NOT NULL REFERENCES services(id),
    confirmation_id TEXT NOT NULL UNIQUE DEFAULT ('TRN-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8))),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    price DECIMAL(6,2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('confirmed', 'cancelled')) DEFAULT 'confirmed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique index: Prevent double-booking (race-condition safety)
-- Only one confirmed booking per service per start_time
CREATE UNIQUE INDEX idx_bookings_no_double_book
    ON bookings(service_id, start_time)
    WHERE (status = 'confirmed');

-- ============================================================================
-- Performance Indexes
-- ============================================================================
CREATE INDEX idx_bookings_customer ON bookings(customer_id, start_time);
CREATE INDEX idx_bookings_service_time ON bookings(service_id, start_time) WHERE status = 'confirmed';
CREATE INDEX idx_services_category ON services(category_id) WHERE is_active = true;
CREATE INDEX idx_availability_service ON availability_schedules(service_id);
