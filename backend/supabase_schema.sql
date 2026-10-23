-- ====================================================================
-- SHELFSENSE AI — AUTHORITATIVE SUPABASE SCHEMA & RESET SCRIPT
-- ====================================================================
-- Run this complete script in your Supabase SQL Editor:
-- Dashboard: https://supabase.com/dashboard/project/tokzyzqmvpnvqvrzwbzn/sql
-- ====================================================================

-- 1. CLEAN SLATE: DROP OLD TRIGGERS, FUNCTIONS AND TABLES (CASCADE)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

DROP TABLE IF EXISTS public.misplacements CASCADE;
DROP TABLE IF EXISTS public.inventory CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- Enable UUID extension for cryptographic primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- 2. USER PROFILES TABLE (CONNECTED TO AUTH.USERS)
-- ====================================================================
-- Stores locked personas (staff, manager, inventory, analyst, admin)
-- Linked directly to Supabase Auth (auth.users)
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT DEFAULT 'Retail Operator',
    role TEXT DEFAULT 'staff' CHECK (role IN ('staff', 'manager', 'inventory', 'analyst', 'admin', 'guest')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for instant email lookups and persona authentication
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);

-- ====================================================================
-- 3. AUTOMATIC TRIGGER: AUTH.USERS -> PUBLIC.USER_PROFILES
-- ====================================================================
-- Whenever any user registers via Email/Password OR Google OAuth,
-- this trigger automatically registers them in public.user_profiles!
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, email, full_name, role)
    VALUES (
        new.id,
        new.email,
        COALESCE(
            new.raw_user_meta_data->>'full_name',
            new.raw_user_meta_data->>'name',
            split_part(new.email, '@', 1)
        ),
        COALESCE(new.raw_user_meta_data->>'role', 'staff')
    )
    ON CONFLICT (email) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        full_name = COALESCE(EXCLUDED.full_name, public.user_profiles.full_name),
        updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill any existing users from auth.users into user_profiles
INSERT INTO public.user_profiles (user_id, email, full_name, role)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1)),
    COALESCE(raw_user_meta_data->>'role', 'staff')
FROM auth.users
ON CONFLICT (email) DO NOTHING;

-- ====================================================================
-- 4. INVENTORY TABLE WITH CURRENT RETAIL SKUs
-- ====================================================================
CREATE TABLE public.inventory (
    id BIGSERIAL PRIMARY KEY,
    sku TEXT UNIQUE NOT NULL,
    product_name TEXT NOT NULL,
    current_stock INTEGER DEFAULT 0 NOT NULL,
    min_threshold INTEGER DEFAULT 2 NOT NULL,
    shelf_zone TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed initial records matching physical shelf layout
INSERT INTO public.inventory (sku, product_name, current_stock, min_threshold, shelf_zone)
VALUES
    ('COKE-001', 'CocaCola', 1, 2, 'Top-Right Deck'),
    ('KITKAT-001', 'KitKat', 3, 2, 'Bottom-Left Shelf'),
    ('LAYS-001', 'Lays', 1, 2, 'Top-Left Deck'),
    ('OREO-001', 'Oreo', 1, 2, 'Bottom-Right Shelf')
ON CONFLICT (sku) DO UPDATE
SET current_stock = EXCLUDED.current_stock,
    shelf_zone = EXCLUDED.shelf_zone,
    updated_at = timezone('utc'::text, now());

-- ====================================================================
-- 5. MISPLACEMENTS TABLE (LIVE SPATIAL FORENSICS)
-- ====================================================================
CREATE TABLE public.misplacements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product TEXT NOT NULL,
    current_zone TEXT NOT NULL,
    expected_zone TEXT NOT NULL,
    neighbor_sku TEXT,
    message TEXT NOT NULL,
    severity TEXT DEFAULT 'WARNING' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    resolved BOOLEAN DEFAULT FALSE NOT NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_misplacements_resolved ON public.misplacements(resolved);
CREATE INDEX IF NOT EXISTS idx_misplacements_created ON public.misplacements(created_at DESC);

-- ====================================================================
-- 6. AUDIT LOGS TABLE
-- ====================================================================
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    user_email TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- 7. ROW LEVEL SECURITY (RLS) & PUBLIC ACCESS POLICIES
-- ====================================================================
-- Disabling RLS prevents silent 403 Forbidden / empty result sets
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.misplacements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;

-- Grant permissions to public anon, authenticated, and service roles
GRANT ALL ON TABLE public.user_profiles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.inventory TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.misplacements TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.audit_logs TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- ====================================================================
-- 8. REALTIME REPLICATION PUBLICATION
-- ====================================================================
-- Add all retail tables to Supabase Realtime broadcast publication
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.misplacements;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;
