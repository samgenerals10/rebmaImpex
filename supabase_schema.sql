-- Supabase PostgreSQL Schema for REBMA IMPEX ERP
-- Execute this script in your Supabase project's SQL Editor.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL, -- Database checks match normalized keys ('CEO', 'HR', 'admin', 'marketing', 'operations', 'finance', 'production', 'receptionist', 'dispatch', 'logistics')
    ghana_card_id TEXT,
    phone TEXT,
    status TEXT DEFAULT 'PENDING_APPROVAL', -- 'ACTIVE', 'PENDING_APPROVAL', 'REJECTED'
    is_ceo BOOLEAN DEFAULT FALSE,
    requires_password_reset BOOLEAN DEFAULT FALSE,
    photo TEXT,
    password_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB,
    magic_link_sent_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ
);

-- Ensure profiles check constraint matches the application roles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (
    role IN ('CEO', 'HR', 'admin', 'marketing', 'operations', 'finance', 'production', 'receptionist', 'dispatch', 'logistics', 'Staff')
);

-- ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS public.attendance (
    id TEXT PRIMARY KEY DEFAULT 'ATT-' || substring(md5(random()::text) from 1 for 8),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    check_out_time TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('PRESENT', 'LATE')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VISITORS TABLE
CREATE TABLE IF NOT EXISTS public.visitors (
    id TEXT PRIMARY KEY DEFAULT 'V-' || substring(md5(random()::text) from 1 for 8),
    full_name TEXT NOT NULL,
    purpose TEXT NOT NULL,
    host_name TEXT NOT NULL,
    checked_in_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    check_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    check_out_time TIMESTAMPTZ
);

-- INCOMING GOODS (CARGO INTAKE) TABLE
CREATE TABLE IF NOT EXISTS public.incoming_goods (
    id TEXT PRIMARY KEY DEFAULT 'CARGO-' || substring(md5(random()::text) from 1 for 8),
    product_name TEXT NOT NULL,
    goods_code TEXT UNIQUE NOT NULL,
    destination TEXT,
    product_image TEXT,
    country TEXT,
    company TEXT,
    quantity INTEGER NOT NULL,
    weight NUMERIC NOT NULL,
    discrepancies TEXT,
    is_fault_or_damaged BOOLEAN DEFAULT FALSE,
    status TEXT NOT NULL, -- 'PENDING_APPROVAL', 'APPROVED', 'DISCREPANCY_FLAGGED'
    unit_price NUMERIC,
    approved_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ORDERS (SALES INVOICES) TABLE
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY DEFAULT 'ORD-' || substring(md5(random()::text) from 1 for 8),
    client_name TEXT NOT NULL,
    destination TEXT,
    product_name TEXT,
    quantity INTEGER,
    total_amount NUMERIC NOT NULL,
    status TEXT NOT NULL, -- 'PENDING_FINANCE', 'PENDING_MANAGEMENT', 'APPROVED', 'REJECTED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED'
    ticket_number TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- GLOBAL AUDIT HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.global_audit_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    department TEXT NOT NULL,
    performed_by TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    details TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- FINANCE PAYMENTS (RECEIPTS) TABLE
CREATE TABLE IF NOT EXISTS public.finance_payments (
    id TEXT PRIMARY KEY DEFAULT 'PAY-' || substring(md5(random()::text) from 1 for 8),
    client_name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    payment_mode TEXT NOT NULL, -- 'Cash', 'Bank Transfer', 'Mobile Money', 'Cheque'
    payment_type TEXT NOT NULL, -- 'Full Payment', 'Part Payment'
    order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CUSTOMERS (DIRECTORY) TABLE
CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY DEFAULT 'CUST-' || substring(md5(random()::text) from 1 for 8),
    name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    phone TEXT,
    location TEXT,
    registered_at TIMESTAMPTZ DEFAULT NOW()
);

-- GOODS PRICES (CATALOG) TABLE
CREATE TABLE IF NOT EXISTS public.goods_prices (
    id TEXT PRIMARY KEY DEFAULT 'PRC-' || substring(md5(random()::text) from 1 for 8),
    product_name TEXT UNIQUE NOT NULL,
    unit_price NUMERIC NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BOARDROOM MEETINGS TABLE
CREATE TABLE IF NOT EXISTS public.boardroom_meetings (
    id TEXT PRIMARY KEY DEFAULT 'MTG-' || substring(md5(random()::text) from 1 for 8),
    title TEXT NOT NULL,
    date DATE NOT NULL,
    time TEXT NOT NULL,
    organizer TEXT NOT NULL,
    participants TEXT[]
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ENABLE ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incoming_goods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_audit_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boardroom_meetings ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CREATE RLS POLICIES (Allow authenticated users access to read/write)
-- ─────────────────────────────────────────────────────────────────────────────

-- Profiles policies:
-- Anyone authenticated can read teammate profiles (needed for dashboards)
CREATE POLICY "Allow authenticated users to read profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Users can update their own profile
CREATE POLICY "Allow users to update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Service role or administrative bypass policy
CREATE POLICY "Allow admin operations"
ON public.profiles FOR ALL
TO service_role
USING (true);

-- Public insert policy for signup page
CREATE POLICY "Allow public inserts on profiles"
ON public.profiles FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Policy for other tables:
-- Authenticated users have full select/insert/update/delete permissions
-- This fits the internal ERP dashboard client model perfectly where RLS handles session checks
DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name NOT IN ('profiles')
    LOOP
        EXECUTE format('
            CREATE POLICY %I ON public.%I FOR ALL 
            TO authenticated 
            USING (true) 
            WITH CHECK (true);', 
            'Allow authenticated users full access to ' || tbl.table_name, 
            tbl.table_name
        );
    END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. AUTH TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

-- Trigger to auto-create profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status, is_ceo, requires_password_reset)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Employee'),
    COALESCE(new.raw_user_meta_data->>'department', 'Staff'),
    CASE 
      WHEN (new.raw_user_meta_data->>'role') IN ('CEO', 'HR') THEN 'ACTIVE'
      ELSE 'PENDING_APPROVAL'
    END,
    COALESCE((new.raw_user_meta_data->>'is_ceo')::boolean, (new.raw_user_meta_data->>'department' = 'CEO'), false),
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. REALTIME CHAT MESSAGES TABLE & POLICIES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender TEXT NOT NULL,
    content TEXT NOT NULL,
    time TEXT NOT NULL,
    receiver TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read chat_messages"
ON public.chat_messages FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert chat_messages"
ON public.chat_messages FOR INSERT
TO authenticated
WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ENABLE SUPABASE REALTIME PUBLICATIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- Ensure publication exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END
$$;

-- Add tables to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cargo_intake;
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.goods_prices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

