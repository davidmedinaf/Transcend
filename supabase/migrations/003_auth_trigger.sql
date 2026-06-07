-- ============================================================================
-- Transcend Wellness POC - Auth Trigger for Profile Creation
-- ============================================================================
-- Requirements: 1.4, 3.1
--
-- This migration creates a Postgres function and trigger that automatically
-- creates a row in the `profiles` table whenever a new user is created in
-- `auth.users`. This ensures every authenticated user has a corresponding
-- profile with:
-- - id matching auth.users.id
-- - email matching auth.users.email
-- - role defaulting to 'customer' (for self-registration)
-- - tenant_id set to the POC default UUID
-- ============================================================================

-- ============================================================================
-- Function: handle_new_user()
-- ============================================================================
-- Triggered after a new user is inserted into auth.users.
-- Creates a corresponding profiles row with default customer role and
-- the POC default tenant_id.
--
-- SECURITY DEFINER allows this function to write to the profiles table
-- regardless of the caller's permissions (required because the inserting
-- user won't have direct INSERT rights on profiles via RLS).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role, tenant_id)
    VALUES (
        NEW.id,
        NEW.email,
        'customer',
        '00000000-0000-0000-0000-000000000000'
    );
    RETURN NEW;
END;
$$;

-- ============================================================================
-- Trigger: on_auth_user_created
-- ============================================================================
-- Fires AFTER INSERT on auth.users, calling handle_new_user() for each new row.
-- ============================================================================
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
