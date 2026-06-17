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

-- CARGO INTAKE TABLE
CREATE TABLE IF NOT EXISTS public.cargo_intake (
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

-- DELIVERY LOGS TABLE
CREATE TABLE IF NOT EXISTS public.delivery_logs (
    id TEXT PRIMARY KEY DEFAULT 'DEL-' || substring(md5(random()::text) from 1 for 8),
    order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
    vehicle_id TEXT,
    driver_name TEXT,
    status TEXT NOT NULL DEFAULT 'ASSIGNED',
    active_coordinates JSONB,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ENABLE ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargo_intake ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_logs ENABLE ROW LEVEL SECURITY;
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. INCREMENTAL MIGRATIONS & ALTERATIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- Safe alterations to public.orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_mode TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS phone TEXT;

-- Safe alterations to public.finance_payments table
ALTER TABLE public.finance_payments ADD COLUMN IF NOT EXISTS order_ref TEXT;
ALTER TABLE public.finance_payments ADD COLUMN IF NOT EXISTS recorded_by TEXT;
ALTER TABLE public.finance_payments ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE public.finance_payments ADD COLUMN IF NOT EXISTS network TEXT;
ALTER TABLE public.finance_payments ADD COLUMN IF NOT EXISTS momo_number TEXT;
ALTER TABLE public.finance_payments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Verified';

-- Missing tables creation
CREATE TABLE IF NOT EXISTS public.invoices (
    id TEXT PRIMARY KEY DEFAULT 'INV-' || substring(md5(random()::text) from 1 for 8),
    invoice_no TEXT UNIQUE NOT NULL,
    customer TEXT NOT NULL,
    department TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('paid', 'pending', 'overdue')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY DEFAULT 'TRX-' || substring(md5(random()::text) from 1 for 8),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    department TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('in', 'out')),
    account TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('completed', 'pending', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.recurring_payments (
    id TEXT PRIMARY KEY DEFAULT 'REC-' || substring(md5(random()::text) from 1 for 8),
    name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'annually')),
    next_date DATE NOT NULL,
    account TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
    category TEXT NOT NULL DEFAULT 'General',
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.departments (
    id TEXT PRIMARY KEY DEFAULT 'DEPT-' || substring(md5(random()::text) from 1 for 8),
    name TEXT UNIQUE NOT NULL,
    head_name TEXT,
    head_role TEXT,
    budget NUMERIC DEFAULT 0,
    headcount INTEGER DEFAULT 0,
    active_projects INTEGER DEFAULT 0,
    performance_score INTEGER DEFAULT 80
);

CREATE TABLE IF NOT EXISTS public.finance_vat_periods (
    period TEXT PRIMARY KEY,
    invoice_count INTEGER NOT NULL DEFAULT 0,
    gross_sales NUMERIC NOT NULL DEFAULT 0,
    vat_amount NUMERIC NOT NULL DEFAULT 0,
    net_sales NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('Filed', 'Pending', 'Draft'))
);

CREATE TABLE IF NOT EXISTS public.supplier_order_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT,
    message TEXT NOT NULL,
    notified_department TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Missing Production Requests definition
CREATE TABLE IF NOT EXISTS public.production_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    items JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING_MANAGEMENT', 'APPROVED', 'TICKETS_ISSUED', 'COMPLETED', 'REJECTED')),
    notes TEXT,
    extended_data JSONB,
    produced_goods TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Missing Finance Ledger definition
CREATE TABLE IF NOT EXISTS public.finance_ledger (
    id TEXT PRIMARY KEY DEFAULT 'LED-' || substring(md5(random()::text) from 1 for 8),
    order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
    invoice_no TEXT UNIQUE NOT NULL,
    amount NUMERIC NOT NULL,
    tax_amount NUMERIC NOT NULL,
    grand_total NUMERIC NOT NULL,
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Missing Fulfillment Tickets definition
CREATE TABLE IF NOT EXISTS public.fulfillment_tickets (
    id TEXT PRIMARY KEY DEFAULT 'TKT-' || substring(md5(random()::text) from 1 for 8),
    order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
    production_request_id UUID REFERENCES public.production_requests(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    details JSONB,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'PROCESSING')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_vat_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_order_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fulfillment_tickets ENABLE ROW LEVEL SECURITY;

-- Setup full RLS access for authenticated users on new tables
CREATE POLICY "Allow authenticated users full access to invoices" ON public.invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users full access to transactions" ON public.transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users full access to recurring_payments" ON public.recurring_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users full access to departments" ON public.departments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users full access to finance_vat_periods" ON public.finance_vat_periods FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users full access to supplier_order_notifications" ON public.supplier_order_notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users full access to production_requests" ON public.production_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users full access to finance_ledger" ON public.finance_ledger FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users full access to fulfillment_tickets" ON public.fulfillment_tickets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable Realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recurring_payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.departments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_vat_periods;
ALTER PUBLICATION supabase_realtime ADD TABLE public.supplier_order_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_ledger;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fulfillment_tickets;

-- Categories (User-managed stock categories)
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY DEFAULT 'CAT-' || substring(md5(random()::text) from 1 for 8),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to categories" ON public.categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;

-- WIP Stock (Work in progress stock tracking)
CREATE TABLE IF NOT EXISTS public.wip_stock (
    id TEXT PRIMARY KEY DEFAULT 'WIP-' || substring(md5(random()::text) from 1 for 8),
    product_name TEXT NOT NULL,
    stage TEXT NOT NULL,
    qty NUMERIC NOT NULL DEFAULT 0,
    unit TEXT NOT NULL,
    batch_ref TEXT,
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.wip_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to wip_stock" ON public.wip_stock FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.wip_stock;

-- Alter stock table to include category
ALTER TABLE public.stock ADD COLUMN IF NOT EXISTS category TEXT;



