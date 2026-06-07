-- ============================================================
-- Row-Level Security (RLS) Policies
-- Transcend Wellness POC
-- 
-- Enables RLS on all tables and defines access policies:
-- - Profiles: admins see all, customers see own
-- - Services: anyone reads active, admins manage all
-- - Service categories: anyone reads, admins manage
-- - Availability schedules: anyone reads, admins manage
-- - Bookings: customers see own, admins see all, customers can insert own
--
-- Requirements: 13.1, 13.4
-- ============================================================

-- ============================================================
-- Enable Row-Level Security on all tables
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper: Check if current user is an admin
-- Using a subquery on the profiles table with auth.uid()
-- ============================================================

-- ============================================================
-- Profiles Policies
-- Admins can view all profiles, customers can only see their own
-- ============================================================

CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Admins can insert profiles" ON profiles
    FOR INSERT WITH CHECK (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "Admins can update all profiles" ON profiles
    FOR UPDATE USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (id = auth.uid());

-- ============================================================
-- Services Policies
-- Anyone can read active services, admins can manage all
-- ============================================================

CREATE POLICY "Anyone can view active services" ON services
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage services" ON services
    FOR ALL USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );

-- ============================================================
-- Service Categories Policies
-- Anyone can read categories, admins can manage
-- ============================================================

CREATE POLICY "Anyone can view service categories" ON service_categories
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage service categories" ON service_categories
    FOR ALL USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );

-- ============================================================
-- Availability Schedules Policies
-- Anyone can read schedules, admins can manage
-- ============================================================

CREATE POLICY "Anyone can view availability schedules" ON availability_schedules
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage availability schedules" ON availability_schedules
    FOR ALL USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );

-- ============================================================
-- Bookings Policies
-- Customers see own bookings, admins see all, customers can insert own
-- ============================================================

CREATE POLICY "Customers see own bookings" ON bookings
    FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Admins see all bookings" ON bookings
    FOR SELECT USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "Customers can create bookings" ON bookings
    FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Admins can manage bookings" ON bookings
    FOR UPDATE USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "Customers can cancel own bookings" ON bookings
    FOR UPDATE USING (customer_id = auth.uid());
