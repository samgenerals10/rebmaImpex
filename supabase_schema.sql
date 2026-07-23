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
    role TEXT NOT NULL, -- Database checks match normalized keys ('CEO', 'HR', 'management', 'marketing', 'operations', 'finance', 'production', 'receptionist', 'dispatch', 'logistics')
    ghana_card_id TEXT,
    phone TEXT,
    status TEXT DEFAULT 'PENDING_APPROVAL', -- 'ACTIVE', 'PENDING_APPROVAL', 'REJECTED'
    is_admin BOOLEAN DEFAULT FALSE, -- true only for the CEO/superuser account, not the 'management' department role
    requires_password_reset BOOLEAN DEFAULT FALSE,
    photo TEXT,
    password_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB,
    magic_link_sent_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ
);

-- Ensure profiles check constraint matches the application roles.
-- 'management' is the Management department's real role value; 'admin' is kept
-- in the allowed list only for backward compatibility with any row that
-- predates the admin->management rename migration (see bottom of this file) —
-- the app itself never writes 'admin' anymore.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (
    role IN ('CEO', 'HR', 'admin', 'marketing', 'operations', 'finance', 'production', 'receptionist', 'dispatch', 'logistics', 'management', 'Staff')
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
    payment_mode TEXT DEFAULT 'CASH',
    created_by TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Migration: add missing columns if table already exists
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'CASH';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS metadata JSONB;
-- Links an order back to a real customer record so a per-customer discount can be
-- looked up reliably — orders previously only stored the free-text client_name.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_id TEXT REFERENCES public.customers(id);

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
    company_name TEXT,
    phone TEXT,
    email TEXT,
    location TEXT,
    ghana_card_id TEXT,
    customer_photo TEXT,
    ghana_card_front TEXT,
    ghana_card_back TEXT,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Migration: add missing columns if table already exists
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS ghana_card_id TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS customer_photo TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS ghana_card_front TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS ghana_card_back TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
-- Special-customer flag (set by Marketing at registration, informational only) and
-- the discount Management awards based on the customer's actual performance/loyalty —
-- the discount is not gated by the flag; any customer can earn one.
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_special_customer BOOLEAN DEFAULT false;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS discount_percent NUMERIC DEFAULT 0;

-- GOODS PRICES (CATALOG) TABLE
CREATE TABLE IF NOT EXISTS public.goods_prices (
    id TEXT PRIMARY KEY DEFAULT 'PRC-' || substring(md5(random()::text) from 1 for 8),
    product_name TEXT UNIQUE NOT NULL,
    unit_price NUMERIC NOT NULL,
    cost_price NUMERIC,
    currency TEXT DEFAULT 'GHS',
    category TEXT DEFAULT 'INCOMING_GOODS',
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    product_image TEXT
);
-- Migration: if the table already exists, run these to add missing columns:
-- ALTER TABLE public.goods_prices ADD COLUMN IF NOT EXISTS cost_price NUMERIC;
-- ALTER TABLE public.goods_prices ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'GHS';
-- ALTER TABLE public.goods_prices ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'INCOMING_GOODS';
-- ALTER TABLE public.goods_prices ADD COLUMN IF NOT EXISTS updated_by TEXT;
-- ALTER TABLE public.goods_prices ADD COLUMN IF NOT EXISTS product_image TEXT;

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
  INSERT INTO public.profiles (id, email, full_name, role, status, is_admin, requires_password_reset)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Employee'),
    COALESCE(new.raw_user_meta_data->>'department', 'Staff'),
    CASE
      WHEN (new.raw_user_meta_data->>'role') IN ('CEO', 'HR') THEN 'ACTIVE'
      ELSE 'PENDING_APPROVAL'
    END,
    COALESCE((new.raw_user_meta_data->>'is_admin')::boolean, (new.raw_user_meta_data->>'department' = 'CEO'), false),
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

-- Stock table (finished goods inventory — auto-populated when Management approves cargo)
CREATE TABLE IF NOT EXISTS public.stock (
    id TEXT PRIMARY KEY DEFAULT 'STK-' || substring(md5(random()::text) from 1 for 8),
    product_name TEXT UNIQUE NOT NULL,
    product_code TEXT,
    category TEXT DEFAULT 'INCOMING_GOODS',
    quantity NUMERIC NOT NULL DEFAULT 0,
    maximum_level NUMERIC DEFAULT 1000,
    minimum_level NUMERIC DEFAULT 50,
    unit TEXT DEFAULT 'units',
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to stock" ON public.stock FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock;

-- Stock ledger (movement log — appended on every stock change)
CREATE TABLE IF NOT EXISTS public.stock_ledger (
    id TEXT PRIMARY KEY DEFAULT 'LEDG-' || substring(md5(random()::text) from 1 for 8),
    product_name TEXT NOT NULL,
    movement_type TEXT NOT NULL DEFAULT 'ADD',
    quantity NUMERIC NOT NULL DEFAULT 0,
    reference TEXT,
    notes TEXT,
    performed_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.stock_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to stock_ledger" ON public.stock_ledger FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_ledger;

-- Migration: if stock or stock_ledger already exist, add any missing columns:
ALTER TABLE public.stock ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'INCOMING_GOODS';
ALTER TABLE public.stock ADD COLUMN IF NOT EXISTS product_code TEXT;
ALTER TABLE public.stock ADD COLUMN IF NOT EXISTS maximum_level NUMERIC DEFAULT 1000;
ALTER TABLE public.stock ADD COLUMN IF NOT EXISTS minimum_level NUMERIC DEFAULT 50;
ALTER TABLE public.stock ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'units';
ALTER TABLE public.stock ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.stock ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE public.stock ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- FINANCE EXPENSES TABLE
CREATE TABLE IF NOT EXISTS public.finance_expenses (
    id TEXT PRIMARY KEY DEFAULT 'EXP-' || substring(md5(random()::text) from 1 for 8),
    category TEXT NOT NULL,
    description TEXT,
    amount NUMERIC NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    receipt BOOLEAN DEFAULT FALSE,
    submitted_by TEXT,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FINANCE CHEQUES TABLE
CREATE TABLE IF NOT EXISTS public.finance_cheques (
    id TEXT PRIMARY KEY DEFAULT 'CHQ-' || substring(md5(random()::text) from 1 for 8),
    cheque_number TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_number TEXT,
    amount NUMERIC NOT NULL,
    cheque_date DATE NOT NULL,
    expected_clearing DATE,
    status TEXT NOT NULL DEFAULT 'Received' CHECK (status IN ('Received', 'Deposited', 'Cleared', 'Bounced')),
    customer_ref TEXT,
    order_ref TEXT,
    recorded_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FINANCE PETTY CASH TABLE
CREATE TABLE IF NOT EXISTS public.finance_petty_cash (
    id TEXT PRIMARY KEY DEFAULT 'PC-' || substring(md5(random()::text) from 1 for 8),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    disbursed_to TEXT,
    category TEXT NOT NULL,
    receipt BOOLEAN DEFAULT FALSE,
    balance_after NUMERIC NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('disbursement', 'replenishment')),
    notes TEXT,
    recorded_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MAINTENANCE SCHEDULE TABLE
CREATE TABLE IF NOT EXISTS public.maintenance_schedule (
    id TEXT PRIMARY KEY DEFAULT 'MAIN-' || substring(md5(random()::text) from 1 for 8),
    date DATE NOT NULL,
    vehicle_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Service', 'Repair', 'Inspection')),
    description TEXT NOT NULL,
    cost NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'In Progress', 'Completed')),
    mechanic TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FUEL LOGS TABLE
CREATE TABLE IF NOT EXISTS public.fuel_logs (
    id TEXT PRIMARY KEY DEFAULT 'FUEL-' || substring(md5(random()::text) from 1 for 8),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    vehicle_id TEXT NOT NULL,
    driver TEXT,
    liters NUMERIC NOT NULL,
    cost NUMERIC NOT NULL,
    station TEXT,
    odometer NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on the new tables
ALTER TABLE public.finance_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_cheques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_petty_cash ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_logs ENABLE ROW LEVEL SECURITY;

-- Setup full RLS access for authenticated users on new tables
CREATE POLICY "Allow authenticated users full access to finance_expenses" ON public.finance_expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users full access to finance_cheques" ON public.finance_cheques FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users full access to finance_petty_cash" ON public.finance_petty_cash FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users full access to maintenance_schedule" ON public.maintenance_schedule FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users full access to fuel_logs" ON public.fuel_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable Realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_cheques;
ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_petty_cash;
ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_schedule;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fuel_logs;

-- ─────────────────────────────────────────────────────────────────────────────
-- GENERAL PURCHASES TABLE (Operations logs supply purchases, Management approves)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.general_purchases (
    id TEXT PRIMARY KEY DEFAULT 'GP-' || substring(md5(random()::text) from 1 for 8),
    item_name TEXT NOT NULL,
    item_code TEXT,
    category TEXT DEFAULT 'General',
    quantity NUMERIC NOT NULL DEFAULT 1,
    cost NUMERIC NOT NULL DEFAULT 0,
    date_received DATE,
    status TEXT NOT NULL DEFAULT 'PENDING_MANAGEMENT_APPROVAL',
    -- 'PENDING_MANAGEMENT_APPROVAL' | 'APPROVED' | 'REJECTED'
    approved_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    department TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.general_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to general_purchases" ON public.general_purchases FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.general_purchases;

-- ─────────────────────────────────────────────────────────────────────────────
-- MATERIAL REQUISITIONS TABLE (Production team requests raw materials)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.material_requisitions (
    id TEXT PRIMARY KEY DEFAULT 'MR-' || substring(md5(random()::text) from 1 for 8),
    requested_by TEXT NOT NULL,
    department TEXT DEFAULT 'PRODUCTION',
    items JSONB NOT NULL DEFAULT '[]',
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    -- 'PENDING' | 'APPROVED' | 'REJECTED' | 'FULFILLED'
    production_request_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.material_requisitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to material_requisitions" ON public.material_requisitions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- DISPATCH LIVE GPS TRACKING
-- Links a driver roster row (public.drivers, created outside this file) to a
-- real login account, and stores an append-only ping log so the dispatch map
-- can show both a driver's current position and a recent trail.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.driver_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id TEXT REFERENCES public.drivers(driver_id) ON DELETE CASCADE,
    delivery_id TEXT REFERENCES public.delivery_logs(id) ON DELETE SET NULL,
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    accuracy NUMERIC,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to driver_locations" ON public.driver_locations FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_recorded ON public.driver_locations(driver_id, recorded_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.material_requisitions;

-- ─────────────────────────────────────────────────────────────────────────────
-- LOGISTICS FLEET MANAGEMENT
-- These three tables back the Logistics department's Fleet/Fuel/Maintenance
-- screens, which were built against tables that were never actually created —
-- every "save" in those screens has been silently local-only until now.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fleet_vehicles (
    id TEXT PRIMARY KEY DEFAULT 'VEH-' || substring(md5(random()::text) from 1 for 8),
    vehicle_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Pickup', -- 'Pickup' | 'Container' | 'Tanker'
    driver TEXT,
    status TEXT NOT NULL DEFAULT 'Operational', -- 'Operational' | 'In Maintenance' | 'Retired'
    last_maintenance DATE,
    total_deliveries NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.fleet_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to fleet_vehicles" ON public.fleet_vehicles FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.fleet_vehicles;

CREATE TABLE IF NOT EXISTS public.fuel_logs (
    id TEXT PRIMARY KEY DEFAULT 'FUEL-' || substring(md5(random()::text) from 1 for 8),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    vehicle_id TEXT NOT NULL,
    driver TEXT,
    liters NUMERIC NOT NULL DEFAULT 0,
    cost NUMERIC NOT NULL DEFAULT 0,
    station TEXT,
    odometer NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.fuel_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to fuel_logs" ON public.fuel_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.fuel_logs;

CREATE TABLE IF NOT EXISTS public.maintenance_schedule (
    id TEXT PRIMARY KEY DEFAULT 'MAINT-' || substring(md5(random()::text) from 1 for 8),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    vehicle_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Service', -- 'Service' | 'Repair' | 'Inspection'
    description TEXT,
    cost NUMERIC DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Scheduled', -- 'Scheduled' | 'In Progress' | 'Completed'
    mechanic TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.maintenance_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to maintenance_schedule" ON public.maintenance_schedule FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_schedule;

-- Proforma invoices: on-demand quotes generated before payment, addressable
-- from Marketing/Finance/Management/CEO. Distinct from finance_ledger
-- (issued after payment) and finance_payments (the receipt).
CREATE TABLE IF NOT EXISTS public.proforma_invoices (
    id TEXT PRIMARY KEY DEFAULT 'PRO-' || substring(md5(random()::text) from 1 for 8),
    order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
    client_name TEXT NOT NULL,
    line_items JSONB NOT NULL DEFAULT '[]',
    subtotal NUMERIC NOT NULL DEFAULT 0,
    tax_amount NUMERIC NOT NULL DEFAULT 0,
    grand_total NUMERIC NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'GHS',
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'CONVERTED')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.proforma_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to proforma_invoices" ON public.proforma_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.proforma_invoices;

-- Notes and Tasks (personal productivity panels) were created directly in
-- Supabase without RLS policies, so every insert/select silently failed
-- under the anon/authenticated role even though the tables exist and the
-- app code was correct — the UI showed a fake "Saved" toast regardless.
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users full access to notes" ON public.notes;
CREATE POLICY "Allow authenticated users full access to notes" ON public.notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users full access to tasks" ON public.tasks;
CREATE POLICY "Allow authenticated users full access to tasks" ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- CHAT MESSENGER + MEETING APP
-- Replaces the flat chat_messages/boardroom_meetings/in-memory-only pattern
-- with real channels, attachments, reactions, threaded replies, read
-- receipts, scheduled meetings with dynamic Jitsi rooms, and per-user
-- persisted notifications (meeting invites, new messages).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    type TEXT NOT NULL DEFAULT 'group' CHECK (type IN ('group', 'dm', 'everyone')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users full access to channels" ON public.channels;
CREATE POLICY "Allow authenticated users full access to channels" ON public.channels FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;

CREATE TABLE IF NOT EXISTS public.channel_members (
    channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (channel_id, user_id)
);
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users full access to channel_members" ON public.channel_members;
CREATE POLICY "Allow authenticated users full access to channel_members" ON public.channel_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_members;

-- Extend the existing flat chat_messages table rather than replace it.
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS attachment_type TEXT;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS attachment_name TEXT;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.chat_message_reactions (
    message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id, emoji)
);
ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users full access to chat_message_reactions" ON public.chat_message_reactions;
CREATE POLICY "Allow authenticated users full access to chat_message_reactions" ON public.chat_message_reactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reactions;

CREATE TABLE IF NOT EXISTS public.chat_message_reads (
    message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id)
);
ALTER TABLE public.chat_message_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users full access to chat_message_reads" ON public.chat_message_reads;
CREATE POLICY "Allow authenticated users full access to chat_message_reads" ON public.chat_message_reads FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reads;

CREATE TABLE IF NOT EXISTS public.meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    organizer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    jitsi_room TEXT UNIQUE NOT NULL,
    recap_notes TEXT,
    status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users full access to meetings" ON public.meetings;
CREATE POLICY "Allow authenticated users full access to meetings" ON public.meetings FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;

CREATE TABLE IF NOT EXISTS public.meeting_attendees (
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rsvp_status TEXT NOT NULL DEFAULT 'INVITED' CHECK (rsvp_status IN ('INVITED', 'ACCEPTED', 'DECLINED')),
    joined_at TIMESTAMPTZ,
    PRIMARY KEY (meeting_id, user_id)
);
ALTER TABLE public.meeting_attendees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users full access to meeting_attendees" ON public.meeting_attendees;
CREATE POLICY "Allow authenticated users full access to meeting_attendees" ON public.meeting_attendees FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_attendees;

CREATE TABLE IF NOT EXISTS public.user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    link_ref TEXT,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users full access to user_notifications" ON public.user_notifications;
CREATE POLICY "Allow authenticated users full access to user_notifications" ON public.user_notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;

-- chat-attachments Storage bucket is private (unlike this app's other public
-- buckets) — access is via signed URLs generated on demand, gated by these
-- storage.objects policies restricted to authenticated users.
DROP POLICY IF EXISTS "Allow authenticated read chat-attachments" ON storage.objects;
CREATE POLICY "Allow authenticated read chat-attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'chat-attachments');
DROP POLICY IF EXISTS "Allow authenticated upload chat-attachments" ON storage.objects;
CREATE POLICY "Allow authenticated upload chat-attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-attachments');

-- ─────────────────────────────────────────────────────────────────────────────
-- Records the real person who approved a payment/order, so the Operations
-- dispatch ticket can print an actual name instead of falling back to the
-- generic "Finance Department" placeholder.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS finance_approved_by TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS finance_approved_by_email TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Formalizes the raw-material requisition pipeline: Production requests raw
-- materials → Management approves (PENDING_FINANCE) → Finance records the
-- internal credit entry and forwards it (APPROVED) → Operations releases the
-- materials to Production (FULFILLED). Mirrors the existing Credit Order
-- (orders.status = PENDING_FINANCE) pattern already used elsewhere.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.material_requisitions DROP CONSTRAINT IF EXISTS material_requisitions_status_check;
ALTER TABLE public.material_requisitions ADD CONSTRAINT material_requisitions_status_check
  CHECK (status IN ('PENDING_MANAGEMENT', 'PENDING_FINANCE', 'APPROVED', 'REJECTED', 'FULFILLED'));
ALTER TABLE public.material_requisitions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Float/replenishment requests (e.g. Finance's Petty Cash "Request
-- Replenishment") as a real approvable record, so they actually show up in
-- Management's Approvals queue instead of only firing a notification.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.float_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department TEXT NOT NULL DEFAULT 'FINANCE',
    requested_by TEXT,
    amount NUMERIC NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING_MANAGEMENT' CHECK (status IN ('PENDING_MANAGEMENT', 'APPROVED', 'REJECTED')),
    approved_by TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.float_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users full access to float_requests" ON public.float_requests;
CREATE POLICY "Allow authenticated users full access to float_requests" ON public.float_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.float_requests;

-- ─────────────────────────────────────────────────────────────────────────────
-- Financial Statements & Reports History — src/views/finance/ReportsView.tsx
-- has been inserting into this table on every "Generate & Download" click
-- since it was built, but the table never actually existed, so every insert
-- silently failed (the error wasn't checked) and the history list was always
-- empty. Also referenced as a deletable target in the CEO Control Center's
-- Data Reset Center (Finance / ALL Departments sections).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.finance_report_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    type TEXT NOT NULL,
    period TEXT NOT NULL,
    generated_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.finance_report_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users full access to finance_report_history" ON public.finance_report_history;
CREATE POLICY "Allow authenticated users full access to finance_report_history" ON public.finance_report_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- WHATSAPP DISPATCH — lets a driver navigate + confirm stops entirely from
-- WhatsApp (no app needed): dispatch_sequence numbers a driver's stops for the
-- day so a driver's "DONE 2" reply unambiguously maps back to one delivery_logs
-- row; whatsapp_sent_at records whether/when the directions text went out.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.delivery_logs ADD COLUMN IF NOT EXISTS dispatch_sequence INTEGER;
ALTER TABLE public.delivery_logs ADD COLUMN IF NOT EXISTS whatsapp_sent_at TIMESTAMPTZ;
ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_report_history;

-- ─────────────────────────────────────────────────────────────────────────────
-- NAMING CLEANUP — 'admin' (profiles.role) was the internal label for the
-- Management department, which read backwards next to the CEO's actual
-- superuser flag (is_ceo). This renames both so they mean what they look like
-- they mean: role value 'admin' -> 'management' (the app has written/read
-- 'management' as an accepted alias since the role check constraint was
-- extended above, so this is safe to run any time), and column is_ceo ->
-- is_admin. Pure rename — no behavior change once applied. RUN THIS ONLY
-- AFTER deploying the matching application code (the app now reads/writes
-- is_admin and 'management' exclusively), since the two must land together
-- for CEO/Management gating to keep working.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.profiles SET role = 'management' WHERE role = 'admin';
ALTER TABLE public.profiles RENAME COLUMN is_ceo TO is_admin;

-- ─────────────────────────────────────────────────────────────────────────────
-- DESTINATION GEOCODING — Dispatch can now enter a delivery destination as a
-- place name (geocoded via Nominatim) or raw "lat, lng" coordinates when
-- creating/assigning a delivery; these store the resolved point so it can be
-- shown/navigated to on the map later. Additive — the app falls back to
-- skipping them on insert if this hasn't been run yet.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.delivery_logs ADD COLUMN IF NOT EXISTS destination_lat NUMERIC;
ALTER TABLE public.delivery_logs ADD COLUMN IF NOT EXISTS destination_lng NUMERIC;
