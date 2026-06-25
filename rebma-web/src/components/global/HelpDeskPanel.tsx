// src/components/global/HelpDeskPanel.tsx
import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Newspaper, Plus, Search, ChevronDown, ChevronUp, X, Check } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { CurrentUser } from '../../types/erp';

interface HelpArticle {
  id: string;
  title: string;
  body: string;
  category: string;
  department: string | null;
  created_by: string;
  created_at: string;
}

interface NewsItem {
  id: string;
  title: string;
  body: string;
  author: string;
  pinned: boolean;
  created_at: string;
}

interface HelpDeskPanelProps {
  currentUser: CurrentUser | null;
  addNotification: (msg: string) => void;
}

const SEED_ARTICLES: Omit<HelpArticle, 'id' | 'created_at'>[] = [
  // Navigation & General
  { title: 'How to switch departments', body: 'Use the department selector in the sidebar to switch between departments. Only departments assigned to your profile will appear. Contact your administrator if a department is missing.', category: 'Navigation', department: null, created_by: 'system' },
  { title: 'Using the Boardroom', body: 'The Boardroom is a company-wide communication hub. Click "Boardroom" in the sidebar to post updates, share reports, or broadcast announcements to all departments. All staff can read posts; only Management and CEO can pin announcements.', category: 'Navigation', department: null, created_by: 'system' },
  { title: 'Managing your profile', body: 'Click your avatar or name at the bottom of the sidebar to open Profile Settings. You can update your full name, avatar, and notification preferences. Department changes require an administrator.', category: 'Navigation', department: null, created_by: 'system' },
  { title: 'Real-time notifications', body: 'The bell icon in the top bar shows your unread notification count. Click it to see all alerts — order approvals, cargo updates, delivery confirmations, leave decisions, and system messages all arrive here in real time.', category: 'Navigation', department: null, created_by: 'system' },
  { title: 'Dark mode and themes', body: 'Click the sun/moon toggle in the top-right corner to switch between light and dark mode. Your preference is saved automatically for your next session.', category: 'Navigation', department: null, created_by: 'system' },
  { title: 'Sharing notes with your team', body: 'In the Notes panel (accessible from the sidebar), toggle "Share with my department" when creating or editing a note. Colleagues in the same department will see it under the Shared filter.', category: 'Navigation', department: null, created_by: 'system' },
  // Marketing
  { title: 'How to create a new sales order', body: 'Go to Marketing → Orders → click "+ New Order". Enter the client name, select products from the catalogue, choose a payment mode (Cash, Cheque, Mobile Money, Credit, or Bank Transfer), and set the total amount. Click Submit — the order is sent to Finance for payment approval. Credit orders also require Management approval before Finance can process them.', category: 'Marketing', department: null, created_by: 'system' },
  { title: 'How to add a new customer', body: 'Go to Marketing → Customers → click "+ Add Customer". Enter the customer\'s full name, phone number, email, and Ghana Card number. Click Save. The customer is immediately available when creating orders.', category: 'Marketing', department: null, created_by: 'system' },
  { title: 'How to view sales history and revenue', body: 'Go to Marketing → Sales History. The Sales tab shows total revenue, average order value, best month, and a 6-month revenue chart. The Credit Requests tab shows all orders placed on credit with their approval status.', category: 'Marketing', department: null, created_by: 'system' },
  { title: 'How to track an order status', body: 'Go to Marketing → Orders. Each order card shows its current status: Pending Finance, Pending Management, Approved, Processing, Out for Delivery, or Delivered. Click any order to view full details including payment mode, destination, and timeline.', category: 'Marketing', department: null, created_by: 'system' },
  { title: 'How to export order data', body: 'Go to Marketing → Orders. Use the CSV or PDF buttons at the top right to export the current filtered order list. The export includes all visible columns: ticket number, client, product, amount, status, and date.', category: 'Marketing', department: null, created_by: 'system' },
  // Finance
  { title: 'How to approve or reject an order in Finance', body: 'Go to Finance → Orders Queue. Orders pending finance approval appear with a "PENDING FINANCE" badge. Click any order to open it. Review the payment details, then click Approve (green) to move the order to Operations and Dispatch, or Reject (red) and enter a reason. The marketing team and customer are notified automatically.', category: 'Finance', department: null, created_by: 'system' },
  { title: 'How to process a cheque payment', body: 'When approving an order with payment mode CHEQUE, a cheque form will appear. Enter the cheque number, bank name, account name, account number, branch, cheque date, and expected clearing date. Click Confirm. The cheque record is saved to the Cheques register and the order is approved.', category: 'Finance', department: null, created_by: 'system' },
  { title: 'How to process a Mobile Money payment', body: 'When approving an order with payment mode MOBILE MONEY, enter the MoMo network (MTN, Vodafone, AirtelTigo), the sender\'s phone number, account name, and transaction ID. Click Confirm. The payment record is saved to the Mobile Money register.', category: 'Finance', department: null, created_by: 'system' },
  { title: 'How to process a credit payment', body: 'Credit orders must first be approved by Management before reaching Finance. Once they arrive in the Orders Queue, enter the customer\'s Ghana Card number, due date, credit amount, and payment terms. Click Confirm. A credit record is created and the customer\'s balance is tracked.', category: 'Finance', department: null, created_by: 'system' },
  { title: 'How to view invoices', body: 'Go to Finance → Invoices (or CEO → Invoices). All approved orders automatically generate an invoice. You can filter by status (Paid, Pending, Overdue) and department. Click any row to view full invoice details. Use "Print All" to print the current filtered list, or open an invoice and click "Print" for a single formatted invoice.', category: 'Finance', department: null, created_by: 'system' },
  { title: 'How to view company wallets', body: 'Go to Finance → Wallets. The Wallets page shows the total company portfolio split across Cash, Mobile Money, Cheque, and Bank Transfer wallets. Balances are calculated from all recorded finance_payments. The chart shows money in vs out over the last 6 months.', category: 'Finance', department: null, created_by: 'system' },
  { title: 'How to record petty cash', body: 'Go to Finance → Petty Cash. Click "+ New Entry" to record a petty cash expense or replenishment. Enter the amount, category, description, and receipt reference. Each entry is logged in the audit history.', category: 'Finance', department: null, created_by: 'system' },
  { title: 'How to manage expenses', body: 'Go to Finance → Expenses. Click "+ Add Expense" to record a company expense. Fill in the category, amount, vendor, and description. Approved expenses appear in the expense summary with monthly totals by category.', category: 'Finance', department: null, created_by: 'system' },
  // Operations
  { title: 'How to log a cargo intake (port goods)', body: 'Go to Operations → Cargo Intake → click "+ Log Intake". Enter the supplier name, product description, quantity, unit, weight (kg), port of origin, and any notes. Upload a photo if available. Click Submit. The cargo request goes to Management for approval. Once approved, the goods automatically appear in Stock.', category: 'Operations', department: null, created_by: 'system' },
  { title: 'How to view approved goods', body: 'Go to Operations → Approved Goods. This shows all cargo items that Management has approved. Each card shows the product name, quantity, supplier, and approval date. These items are automatically added to the Stock register when approved.', category: 'Operations', department: null, created_by: 'system' },
  { title: 'How to manage stock levels', body: 'Go to Operations → Stock. The stock list shows all products with current quantity, minimum level, maximum level, and unit. Stock is updated automatically when: (1) Management approves a cargo intake, (2) Production completes a batch, or (3) General purchases are approved. You can manually adjust quantities using the Edit button on any item.', category: 'Operations', department: null, created_by: 'system' },
  { title: 'How to purchase general supplies', body: 'Go to Operations → General Purchases → click "+ New Purchase". Enter the item name, supplier, quantity, unit price, and total. Submit for Management approval. Once approved, it is recorded and the department is notified.', category: 'Operations', department: null, created_by: 'system' },
  // Dispatch
  { title: 'How to add a driver', body: 'Go to Dispatch → Drivers → click "+ Add Driver". Enter the driver\'s full name, phone number, Ghana Card number, license number, and truck/vehicle ID. Click Save. The driver is immediately available for delivery assignments.', category: 'Dispatch', department: null, created_by: 'system' },
  { title: 'How to assign a driver to an order', body: 'Go to Dispatch → Overview. In the "Assign Driver" section, select the order ID from the dropdown and choose an available driver. Click Assign. The driver\'s status changes to "On Delivery" and Operations is notified.', category: 'Dispatch', department: null, created_by: 'system' },
  { title: 'How to track active deliveries', body: 'Go to Dispatch → Tracking. All deliveries with status IN_TRANSIT or ASSIGNED are shown on the tracking board with their driver, destination, and last update. Click "Mark Delivered" when the delivery is confirmed complete.', category: 'Dispatch', department: null, created_by: 'system' },
  { title: 'How to upload proof of delivery', body: 'Go to Dispatch → Proof of Delivery. Find the delivery by order ID. Click Upload Proof, attach the signed delivery note or photo. Enter the recipient name and any delivery notes. Click Submit to mark the order as delivered and notify the customer.', category: 'Dispatch', department: null, created_by: 'system' },
  // HR
  { title: 'How to approve a staff registration', body: 'Go to HR → Staff Registrations. Pending registrations appear with a "PENDING" badge. Click any request to review the staff member\'s details — name, department, role, and Ghana Card. Click Approve to generate their login credentials and system access, or Deny with a reason.', category: 'HR', department: null, created_by: 'system' },
  { title: 'How to manage leave requests', body: 'Go to HR → Leave Management. Pending leave requests are listed under the PENDING tab. Click a request to view the staff member\'s name, leave type, dates, and reason. Click Approve or Reject. The staff member receives an automatic notification. You can filter by status (PENDING, APPROVED, REJECTED) and by department.', category: 'HR', department: null, created_by: 'system' },
  { title: 'How to submit a leave request (for staff)', body: 'Go to HR → Leave Management → click "+ Request Leave". Select your leave type (Annual, Sick, Maternity/Paternity, Emergency, Unpaid), enter the start and end dates, and write a reason. Click Submit. Your department HR officer will review and respond.', category: 'HR', department: null, created_by: 'system' },
  { title: 'How to run payroll', body: 'Go to HR → Payroll. Click "+ New Payroll Batch" to create a payroll run. Enter the pay period (month/year), select employees, and enter gross salary, deductions, and any bonuses. Click Process Payroll to generate payslips. All payroll entries are saved and exportable as CSV or PDF.', category: 'HR', department: null, created_by: 'system' },
  { title: 'How to view performance alerts', body: 'Go to HR → Performance Alerts. This page shows staff performance flags submitted by department heads — attendance issues, targets missed, commendations, and warnings. Management and HR can view all departments; others see only their own.', category: 'HR', department: null, created_by: 'system' },
  // Management
  { title: 'How Management approves cargo intake', body: 'Go to Management → Approvals → Cargo Intake tab. All pending port deliveries appear here with full details — supplier, product, quantity, and photo. Click Approve to clear the goods into Stock (stock levels update automatically) or Reject with a reason. Operations, Finance, and Marketing are all notified.', category: 'Management', department: null, created_by: 'system' },
  { title: 'How to approve credit orders', body: 'Go to Management → Approvals → Orders tab. Credit orders submitted by Marketing appear here pending management sign-off. Review the client, amount, and Ghana Card details. Click Approve to forward to Finance, or Reject to return to Marketing with a reason.', category: 'Management', department: null, created_by: 'system' },
  { title: 'How to set product selling prices', body: 'Go to Management → Price Setting. All products in the goods catalogue appear with their current selling price and last updated date. Click the price field on any row, enter the new price, and click Save. Finance and Marketing are notified of the price change. The new price is immediately reflected in new orders.', category: 'Management', department: null, created_by: 'system' },
  { title: 'How to view department analytics', body: 'Go to Management → Analytics. This dashboard shows company-wide KPIs: total revenue, orders processed, active staff, cargo received. Charts show department activity over time. Use the date filter to narrow to a specific period.', category: 'Management', department: null, created_by: 'system' },
  { title: 'How to approve supplier orders', body: 'Go to Management → Supplier Orders. Pending supplier purchase requests from all departments appear here. Review the supplier, product, quantity, and cost. Click Approve to confirm the purchase and notify the requesting department, or Reject with a reason.', category: 'Management', department: null, created_by: 'system' },
  // CEO
  { title: 'How to use the CEO Control Center', body: 'Go to CEO → Control Center. This panel lets you: (1) Grant or revoke department-level feature access for specific staff; (2) Set up delegation — temporarily transfer your approval authority to another manager; (3) Invite new staff directly with auto-approve toggle; (4) View all pending approvals and system-wide activity logs.', category: 'CEO', department: null, created_by: 'system' },
  { title: 'How to view the CEO executive dashboard', body: 'Go to CEO → Overview. The executive dashboard shows real-time KPIs across all departments: total revenue, active orders, stock value, staff headcount, and delivery performance. All charts pull live data from the database. Click any card to drill into that department\'s detail.', category: 'CEO', department: null, created_by: 'system' },
  { title: 'How to view and print all invoices (CEO)', body: 'Go to CEO → Invoices. All approved orders across every department appear as invoices. Filter by status (Paid, Pending, Overdue) or department. Click "Print All" to print the full invoice ledger, or click any row and then "Print" for a formatted single invoice suitable for sending to clients.', category: 'CEO', department: null, created_by: 'system' },
];

const SEED_NEWS: Omit<NewsItem, 'id' | 'created_at'>[] = [
  { title: 'Welcome to REBMA IMPEX Management System', body: 'We are excited to launch the full REBMA IMPEX ERP platform. All departments are now connected — from Marketing order creation through Finance approval, Operations stock management, Dispatch delivery tracking, HR leave management, and CEO oversight. Use the Help Center for step-by-step guides on every feature.', author: 'Management', pinned: true },
  { title: 'Cargo to Stock: Important Workflow', body: 'When goods arrive at the port, Operations logs a Cargo Intake request. Management reviews and approves it — at that point the goods are automatically added to the Stock register. Finance and Marketing are notified so pricing and availability can be updated. Run the required SQL constraint (UNIQUE on stock.product_name) if stock is not updating.', author: 'Operations Department', pinned: false },
  { title: 'Invoice Printing Now Available', body: 'All approved orders automatically generate invoices visible in Finance → Invoices and CEO → Invoices. You can print individual invoices using the Print button in the detail panel, or print the entire filtered list using Print All. Invoices show automatically as Paid (delivered), Pending, or Overdue (past 30-day due date).', author: 'Finance Department', pinned: false },
  { title: 'Payment Methods and Wallets', body: 'Finance can now process four payment modes: Cash, Cheque, Mobile Money, and Credit/Bank Transfer. Each approved order payment is recorded in the Company Wallets page, split by payment type. The wallets chart shows total money in over the last 6 months. Credit orders require Management approval before reaching Finance.', author: 'Finance Department', pinned: false },
  { title: 'Driver Management Update', body: 'Dispatch can now add, edit, deactivate, and delete drivers via Dispatch → Drivers. Each driver profile tracks their truck ID, license, Ghana Card, and delivery history. The Add Driver form now stays open while you type without losing cursor focus. Assign drivers to orders from the Dispatch Overview.', author: 'Dispatch Department', pinned: false },
];

const FALLBACK_ARTICLES: HelpArticle[] = [
  // Navigation
  { id: 'f-nav-1', title: 'How to switch departments', category: 'Navigation', body: 'Use the department selector in the sidebar. Only your assigned departments appear. Contact your administrator if access is missing.', department: null, created_by: 'system', created_at: new Date().toISOString() },
  { id: 'f-nav-2', title: 'Real-time notifications', category: 'Navigation', body: 'The bell icon in the top bar shows unread alerts. Order approvals, cargo updates, delivery confirmations, and leave decisions all arrive here automatically.', department: null, created_by: 'system', created_at: new Date().toISOString() },
  { id: 'f-nav-3', title: 'Dark mode', category: 'Navigation', body: 'Click the sun/moon toggle in the top-right corner to switch between light and dark mode. Your preference is saved automatically.', department: null, created_by: 'system', created_at: new Date().toISOString() },
  // Marketing
  { id: 'f-mkt-1', title: 'How to create a new sales order', category: 'Marketing', body: 'Marketing → Orders → "+ New Order". Enter client, products, payment mode, and amount. Submit to send to Finance for approval. Credit orders also need Management sign-off first.', department: null, created_by: 'system', created_at: new Date().toISOString() },
  { id: 'f-mkt-2', title: 'How to add a customer', category: 'Marketing', body: 'Marketing → Customers → "+ Add Customer". Fill in name, phone, email, and Ghana Card number. The customer is immediately available in new orders.', department: null, created_by: 'system', created_at: new Date().toISOString() },
  { id: 'f-mkt-3', title: 'How to view sales history', category: 'Marketing', body: 'Marketing → Sales History. See total revenue, average order value, 6-month chart, and credit request tracking by status.', department: null, created_by: 'system', created_at: new Date().toISOString() },
  // Finance
  { id: 'f-fin-1', title: 'How to approve a payment', category: 'Finance', body: 'Finance → Orders Queue. Click a PENDING FINANCE order, review payment details, then click Approve or Reject. Approving notifies Operations, Dispatch, and Marketing automatically and records the payment in Wallets.', department: null, created_by: 'system', created_at: new Date().toISOString() },
  { id: 'f-fin-2', title: 'How to view invoices and print them', category: 'Finance', body: 'Finance → Invoices. Approved orders appear as invoices automatically. Filter by Paid/Pending/Overdue. Click "Print All" to print the list, or open an invoice and click "Print" for a single formatted invoice.', department: null, created_by: 'system', created_at: new Date().toISOString() },
  { id: 'f-fin-3', title: 'How to view company wallets', category: 'Finance', body: 'Finance → Wallets. Shows balances split by Cash, Mobile Money, Cheque, and Bank Transfer — populated from every approved order payment recorded by Finance.', department: null, created_by: 'system', created_at: new Date().toISOString() },
  // Operations
  { id: 'f-ops-1', title: 'How to log cargo from the port', category: 'Operations', body: 'Operations → Cargo Intake → "+ Log Intake". Enter supplier, product, quantity, weight, and port. Upload a photo. Submit for Management approval. Once approved, goods are automatically added to Stock.', department: null, created_by: 'system', created_at: new Date().toISOString() },
  { id: 'f-ops-2', title: 'How to view and manage stock', category: 'Operations', body: 'Operations → Stock. Shows all products with current quantity, minimum/maximum levels, and unit. Stock updates automatically when cargo is approved, production finishes, or purchases are confirmed.', department: null, created_by: 'system', created_at: new Date().toISOString() },
  { id: 'f-ops-3', title: 'How to view approved goods', category: 'Operations', body: 'Operations → Approved Goods. Lists all port cargo items cleared by Management. Each shows product name, quantity, supplier, and approval date.', department: null, created_by: 'system', created_at: new Date().toISOString() },
  // Dispatch
  { id: 'f-dis-1', title: 'How to add a driver', category: 'Dispatch', body: 'Dispatch → Drivers → "+ Add Driver". Enter full name, phone, Ghana Card, license number, and truck ID. Click Save. The driver is immediately available for assignments.', department: null, created_by: 'system', created_at: new Date().toISOString() },
  { id: 'f-dis-2', title: 'How to assign a driver to a delivery', category: 'Dispatch', body: 'Dispatch → Overview → "Assign Driver" section. Select the order ID and choose a driver. Click Assign. The driver status changes to On Delivery and all relevant departments are notified.', department: null, created_by: 'system', created_at: new Date().toISOString() },
  { id: 'f-dis-3', title: 'How to upload proof of delivery', category: 'Dispatch', body: 'Dispatch → Proof of Delivery. Find the order, click Upload Proof, attach the photo or signed note, enter recipient name. Click Submit to mark the delivery complete.', department: null, created_by: 'system', created_at: new Date().toISOString() },
  // HR
  { id: 'f-hr-1', title: 'How to approve staff registration', category: 'HR', body: 'HR → Staff Registrations. Review pending staff details — name, department, role, Ghana Card. Click Approve to generate login credentials, or Deny with a reason.', department: null, created_by: 'system', created_at: new Date().toISOString() },
  { id: 'f-hr-2', title: 'How to manage leave requests', category: 'HR', body: 'HR → Leave Management. Review PENDING requests — see staff name, leave type, dates, and reason. Click Approve or Reject. The staff member is notified automatically. Filter by status or department.', department: null, created_by: 'system', created_at: new Date().toISOString() },
  { id: 'f-hr-3', title: 'How to run payroll', category: 'HR', body: 'HR → Payroll → "+ New Payroll Batch". Select pay period, enter employee salaries, deductions, and bonuses. Click Process Payroll. Payslips are generated and exportable as CSV or PDF.', department: null, created_by: 'system', created_at: new Date().toISOString() },
  // Management
  { id: 'f-mgmt-1', title: 'How to approve cargo and stock management', category: 'Management', body: 'Management → Approvals → Cargo Intake tab. Review incoming port goods — supplier, product, quantity, photo. Click Approve to release goods into Stock. Operations, Finance, and Marketing are notified automatically.', department: null, created_by: 'system', created_at: new Date().toISOString() },
  { id: 'f-mgmt-2', title: 'How to set product prices', category: 'Management', body: 'Management → Price Setting. Click any product price field, enter the new selling price, click Save. Finance and Marketing are notified. The new price applies to all new orders immediately.', department: null, created_by: 'system', created_at: new Date().toISOString() },
  { id: 'f-mgmt-3', title: 'How to approve credit orders', category: 'Management', body: 'Management → Approvals → Orders tab. Credit orders from Marketing appear here. Review client, amount, and Ghana Card. Click Approve to forward to Finance, or Reject to return to Marketing.', department: null, created_by: 'system', created_at: new Date().toISOString() },
  // CEO
  { id: 'f-ceo-1', title: 'How to use the CEO Control Center', category: 'CEO', body: 'CEO → Control Center. Grant/revoke feature access per staff member, set up delegation of approval authority, invite new staff with auto-approve, and view all pending approvals and system-wide audit logs.', department: null, created_by: 'system', created_at: new Date().toISOString() },
  { id: 'f-ceo-2', title: 'How to view the executive dashboard', category: 'CEO', body: 'CEO → Overview. Real-time KPIs across all departments: total revenue, active orders, stock value, staff headcount, delivery performance. Click any card to drill into that department.', department: null, created_by: 'system', created_at: new Date().toISOString() },
  { id: 'f-ceo-3', title: 'How to print and export invoices (CEO)', category: 'CEO', body: 'CEO → Invoices. All approved orders appear as invoices. Filter by Paid/Pending/Overdue or department. Use "Print All" for the full ledger or open an invoice and click "Print" for a formatted client invoice.', department: null, created_by: 'system', created_at: new Date().toISOString() },
];

const FALLBACK_NEWS: NewsItem[] = [
  { id: 'news-f-1', title: 'Welcome to REBMA IMPEX Management System', body: 'All departments are now live on the REBMA IMPEX ERP platform — Marketing, Finance, Operations, Dispatch, HR, Management, and CEO. Each department has its own dashboard, forms, tables, and workflows that are fully connected to the shared database. Use the Help Center for step-by-step guides.', author: 'REBMA Management', pinned: true, created_at: new Date().toISOString() },
  { id: 'news-f-2', title: 'Cargo to Stock Workflow is Live', body: 'Port goods logged by Operations and approved by Management now automatically update Stock levels. Finance and Marketing are notified so pricing and order fulfilment can be coordinated. Ensure the stock_product_name_key UNIQUE constraint is applied in Supabase for upserts to work correctly.', author: 'Operations Department', pinned: false, created_at: new Date().toISOString() },
  { id: 'news-f-3', title: 'Invoice Printing Added', body: 'Approved orders now generate invoices automatically in Finance → Invoices and CEO → Invoices. Print individual invoices from the detail panel or use "Print All" to print the full filtered list. Invoices show as Paid (DELIVERED orders), Overdue (past 30 days), or Pending.', author: 'Finance Department', pinned: false, created_at: new Date().toISOString() },
  { id: 'news-f-4', title: 'Wallets Now Track All Payments', body: 'Every order Finance approves is now recorded in the Company Wallets page, split by payment mode: Cash, Mobile Money, Cheque, and Bank Transfer. The wallets chart shows the 6-month money-in trend. All payment data flows from the finance_payments table.', author: 'Finance Department', pinned: false, created_at: new Date().toISOString() },
  { id: 'news-f-5', title: 'Dispatch Driver Management Updated', body: 'The Add Driver form no longer loses cursor focus when typing. Drivers can be added, edited, deactivated, or deleted from Dispatch → Drivers. Assignments are made from Dispatch → Overview. Proof of delivery photos can be uploaded from Dispatch → Proof of Delivery.', author: 'Dispatch Department', pinned: false, created_at: new Date().toISOString() },
];

const blankArticle = { title: '', body: '', category: 'General' };
const blankNews    = { title: '', body: '', pinned: false };

export default function HelpDeskPanel({ currentUser, addNotification }: HelpDeskPanelProps) {
  const [tab, setTab]               = useState<'help' | 'news'>('help');
  const [articles, setArticles]     = useState<HelpArticle[]>([]);
  const [news, setNews]             = useState<NewsItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [artModal, setArtModal]     = useState({ open: false, ...blankArticle });
  const [newsModal, setNewsModal]   = useState({ open: false, ...blankNews });
  const [saving, setSaving]         = useState(false);

  const isManagement = currentUser?.isCeo || currentUser?.department === 'MANAGEMENT' || currentUser?.department === 'CEO';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: arts, error: aErr } = await supabase.from('help_articles').select('*').order('created_at', { ascending: false });
      if (aErr || !arts || arts.length === 0) {
        // Fallback: show hardcoded articles, try to seed in background
        setArticles(FALLBACK_ARTICLES);
        if (!aErr) {
          supabase.from('help_articles').insert(SEED_ARTICLES).then(() => {});
        }
      } else {
        setArticles(arts);
      }

      const { data: newsData, error: nErr } = await supabase.from('company_news').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false });
      if (nErr || !newsData || newsData.length === 0) {
        setNews(FALLBACK_NEWS);
        if (!nErr) {
          supabase.from('company_news').insert(SEED_NEWS).then(() => {});
        }
      } else {
        setNews(newsData);
      }
    } catch {
      // Tables may not exist — always show fallback so panel is never empty
      setArticles(FALLBACK_ARTICLES);
      setNews(FALLBACK_NEWS);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visibleArticles = articles.filter(a => {
    const matchDept = !a.department || a.department === currentUser?.department;
    const matchSearch = a.title.toLowerCase().includes(search.toLowerCase()) || a.body.toLowerCase().includes(search.toLowerCase());
    return matchDept && matchSearch;
  });

  const categories = Array.from(new Set(visibleArticles.map(a => a.category)));

  const saveArticle = async () => {
    if (!currentUser || !artModal.title.trim()) return;
    setSaving(true);
    try {
      await supabase.from('help_articles').insert({ title: artModal.title, body: artModal.body, category: artModal.category, department: null, created_by: currentUser.id });
      addNotification('Article published.');
      setArtModal({ open: false, ...blankArticle });
      load();
    } catch { addNotification('Could not publish article.'); }
    setSaving(false);
  };

  const saveNews = async () => {
    if (!currentUser || !newsModal.title.trim()) return;
    setSaving(true);
    try {
      await supabase.from('company_news').insert({ title: newsModal.title, body: newsModal.body, author: currentUser.fullName, pinned: newsModal.pinned });
      addNotification('News posted.');
      setNewsModal({ open: false, ...blankNews });
      load();
    } catch { addNotification('Could not post news.'); }
    setSaving(false);
  };

  return (
    <div className="helpdesk-panel">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Help &amp; News</h2>
          <div className="flex bg-[var(--bg-input)] border border-[var(--border)] rounded-lg overflow-hidden text-[10px] font-semibold">
            {([['help','Help Center'],['news','Company News']] as const).map(([v,l]) => (
              <button key={v} onClick={() => setTab(v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 cursor-pointer transition-colors ${tab === v ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--accent-light)]'}`}>
                {v === 'help' ? <BookOpen className="w-3 h-3" /> : <Newspaper className="w-3 h-3" />}
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'help' && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search articles…"
                className="pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none w-40 focus:ring-1 focus:ring-[var(--accent)]" />
            </div>
          )}
          {isManagement && tab === 'help' && (
            <button onClick={() => setArtModal({ open: true, ...blankArticle })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:opacity-90 cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Article
            </button>
          )}
          {isManagement && tab === 'news' && (
            <button onClick={() => setNewsModal({ open: true, ...blankNews })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:opacity-90 cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Post
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_,i) => <div key={i} className="h-14 rounded-xl bg-[var(--bg-input)] animate-pulse" />)}</div>
      ) : tab === 'help' ? (
        /* Help Articles — accordion by category */
        categories.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <BookOpen className="w-8 h-8 text-[var(--text-muted)] mb-2" />
            <p className="text-xs text-[var(--text-muted)]">No articles found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {categories.map(cat => (
              <div key={cat} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-[var(--accent-light)]">
                  <span className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-wide">{cat}</span>
                </div>
                {visibleArticles.filter(a => a.category === cat).map(a => (
                  <div key={a.id} className="border-t border-[var(--border)] first:border-t-0">
                    <button onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer hover:bg-[var(--accent-light)] transition-colors">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{a.title}</span>
                      {expanded === a.id ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
                    </button>
                    {expanded === a.id && (
                      <div className="px-4 pb-4">
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{a.body}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      ) : (
        /* Company News */
        news.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Newspaper className="w-8 h-8 text-[var(--text-muted)] mb-2" />
            <p className="text-xs text-[var(--text-muted)]">No news yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {news.map(n => (
              <div key={n.id} className={`bg-[var(--bg-card)] border rounded-xl p-4 ${n.pinned ? 'border-[var(--accent)]' : 'border-[var(--border)]'}`}>
                {n.pinned && <span className="text-[9px] font-bold px-2 py-0.5 bg-[var(--accent)] text-white rounded-full mb-2 inline-block">PINNED</span>}
                <h3 className="font-bold text-sm text-[var(--text-primary)] mb-1">{n.title}</h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-2">{n.body}</p>
                <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                  <span>Posted by <span className="font-medium text-[var(--text-secondary)]">{n.author}</span></span>
                  <span>·</span>
                  <span>{new Date(n.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Article Modal */}
      {artModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">New Help Article</h3>
              <button onClick={() => setArtModal({ open: false, ...blankArticle })} className="p-1 rounded-lg hover:bg-[var(--bg-input)] cursor-pointer"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
            </div>
            <input value={artModal.title} onChange={e => setArtModal(m => ({ ...m, title: e.target.value }))} placeholder="Article title…"
              className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)] mb-3" />
            <input value={artModal.category} onChange={e => setArtModal(m => ({ ...m, category: e.target.value }))} placeholder="Category…"
              className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)] mb-3" />
            <textarea value={artModal.body} onChange={e => setArtModal(m => ({ ...m, body: e.target.value }))} placeholder="Article body…" rows={5}
              className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setArtModal({ open: false, ...blankArticle })} className="px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] rounded-lg cursor-pointer">Cancel</button>
              <button onClick={saveArticle} disabled={saving || !artModal.title.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 cursor-pointer">
                <Check className="w-3.5 h-3.5" /> {saving ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* News Modal */}
      {newsModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Post Company News</h3>
              <button onClick={() => setNewsModal({ open: false, ...blankNews })} className="p-1 rounded-lg hover:bg-[var(--bg-input)] cursor-pointer"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
            </div>
            <input value={newsModal.title} onChange={e => setNewsModal(m => ({ ...m, title: e.target.value }))} placeholder="Headline…"
              className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)] mb-3" />
            <textarea value={newsModal.body} onChange={e => setNewsModal(m => ({ ...m, body: e.target.value }))} placeholder="News body…" rows={5}
              className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none mb-3" />
            <label className="flex items-center gap-2 cursor-pointer mb-4">
              <div onClick={() => setNewsModal(m => ({ ...m, pinned: !m.pinned }))}
                className={`w-9 h-5 rounded-full transition-colors relative ${newsModal.pinned ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${newsModal.pinned ? 'left-4' : 'left-0.5'}`} />
              </div>
              <span className="text-xs text-[var(--text-secondary)]">Pin to top</span>
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setNewsModal({ open: false, ...blankNews })} className="px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] rounded-lg cursor-pointer">Cancel</button>
              <button onClick={saveNews} disabled={saving || !newsModal.title.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 cursor-pointer">
                <Check className="w-3.5 h-3.5" /> {saving ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
