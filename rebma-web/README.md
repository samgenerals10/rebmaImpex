# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
as an expert software engineer and senior debbuger, you are to check and work on : 

OPERATION
. fix incoming goods from the port by 
1. add name of product
2. add image of product
3. auto generate date and time
4. add destinatination
5. add goods code
 *also include history to the operation sidebar
*orders approved must reflect on operations page with its ticket number also.
*goods approved must reflect on operations page 

OPERATION SIDEBAR
1. fix port cargo
2. fix fullment releases
3. fix intake records log..

MANAGEMENT
-Include history
- credit for approval should come with every details of the customer and history of the customer
SIDEBAR
1. fix port cargo approval
2. fix credit approval
3. fix global audit ledger
4. add set prices (either new goods or incoming goods or old goods)

FINANCE
- Fix payment terms payment
- fix Invoice Portal
- fix Record Inbound Payment
- fix Receipts & Tickets

1. Historical Receipts and tickets database should be in a table form and when clicked on each row or profile you should see the ticket now.
2. Include overall goods produced by production..
3. Include overall goods in warehouse history production
4. Include from like google forms


MARKETING 
1. Let create client order be a modal 
- add destination 
- add name of product
if order type is credit add customer Ghana Card...
2. let register New customer should be a modal 
- add customer photo (optional)
3. let customer directory be a table when clicked on a customer you see a card of the customer profile including history botton..
3. Let active sales orders list ,should be clickable..

DISPATCH
- Fix live map for delievery orders
- Include delievery history
- Include Drivers activies and details and Ghana Card.
DISPATCH SIDEBAR
1. fix active delieveries map
2. fix dispatch history
3. fix delievery logs history 



PRODUCTION
1.add history production
2.raw materials requested and the goods thats has been produced
sidebar
3.fix raw materials requested
4.fix WIP & stock inventory
5. fix orders history

HR
1.fix new registration approval
if approved,system auto generate login password for the person and sends it into the persons email ,if rejected or denied, send note to the persons email...

2. add members(staff)
3. todays attendance should be a list of five ,the rest can be scrolled.
4. add attendance history of staff in a table form

A FEATURE EVERY DEPARTMENT MUST HAVE AND IT SHOULDNT BE A DEPARTMENT ON ITS OWN..
1. executive boardroom - fix it and put it inside the chat icon and the sidebar for each department..
2. Settings - every department should have should have a settings at the bottom of the sidebar and add user profile settings too...(profile picture,email,password,names, delete account which hr needs to approved before account deletion becomes complete)

DEPARTMENT ACCESS IN THE SIDEBAR
1. only CEO,MANAGEMENT,should only have access to a view only mode to all department but management cant have access to view CEO department..

1. let Ceo handle logistics..
SIDEBAR CEO
2. fix Accra GPS tracking
3. fix boardroom hub
4. fix erp settings

LET WHATEVER I CLICKED FROM THE SIDEBAR OCCUPY AND REPLACE THE MAIN HEIGHT OR SCROLL DOWN...

FIX NOTIFICATION ALSO..
1.Let All active sales orders list ,be clickable..,
2.Let all active dispatch,be clickable..,
3.Let all active Production,be clickable..,
4.Let all incoming goods from the port,be clickable..,
5.Let all raw materials requested,be clickable..,
6.Let all credit approvals,be clickable..,
7.Let all pending registration,be clickable..,
8.Let all incoming goods from the port,be clickable..,
9.Let all Payment terms & payments,be clickable..,
10.Let all Credit sales & approvals,be clickable..,

BEFORE YOU TOUCH ANYTHING:
1. Read every file completely before editing
2. Do not delete any existing logic, Supabase
   calls, routing, auth, or workflows
3. Do not hallucinate file paths or imports
4. Only use packages already in package.json
5. All icons from lucide-react only
6. App name is always "REBMA IMPEX"
7. List every file modified when done
8. Push to GitHub:
   "feat: connect all workflows end to end —
    CEO to Management to Operations to Dispatch
    complete inbound and outbound flow"

═══════════════════════════════════════════════
TASK: CONNECT ALL DEPARTMENT WORKFLOWS
END TO END
═══════════════════════════════════════════════

Read ALL these files fully before touching
anything:
- App.tsx
- CeoDashboard.tsx
- ManagementDashboard.tsx
- OperationsDashboard.tsx
- FinanceDashboard.tsx
- MarketingDashboard.tsx
- DispatchDashboard.tsx
- HrDashboard.tsx
- ReceptionDashboard.tsx
- ProductionDashboard.tsx
- All views in src/views/
- All components in src/components/

Understand every existing notification,
status update, and workflow connection.
Then add what is missing.

═══════════════════════════════════════════════
WORKFLOW 1 — INBOUND FLOW
(Goods coming in from overseas)
═══════════════════════════════════════════════

STEP 1: CEO places supplier order
Already built in SupplierOrdersView.tsx
Status: pending → payment_authorised → shipped

STEP 2: CEO notifies Management
When CEO clicks "Notify Management" on order:
- Save notification to supplier_order_notifications
- Send notification to Management dashboard:
  Title: "Incoming Shipment from [Supplier]"
  Message: "CEO has placed order [SUP-XXX]
  with [supplier] for [products].
  Expected arrival: [date].
  Please prepare Operations."
  Action button: "View Order Details"
- Notification appears in Management:
  Activity panel + Upcoming Approvals card
  on Management dashboard

STEP 3: Management notifies Operations
In Management dashboard, when viewing the
CEO notification about incoming shipment:
- "Notify Operations" button appears
- Clicking opens notify modal:
  Pre-filled message:
  "Prepare to receive goods from [supplier].
  Products: [list]. Expected: [date].
  Port: [port of entry]."
  Edit message option
  Select who: Operations Department (default)
  + specific Operations staff (optional)
  Send Notification button
- Saves to supplier_order_notifications
  with notified_department = 'OPERATIONS'
- Operations sees notification in Activity
- Operations Incoming Shipments card updates

STEP 4: Operations receives goods
When goods arrive, Operations logs cargo intake
Already built in OperationsDashboard.
On intake saved:
- Notification to Management:
  "Operations logged cargo receipt [CGO-XXX]
  from [supplier]. Quality check in progress."

STEP 5: Operations performs quality check
Already built.
On quality check PASS:
- Notification to Management:
  "✅ Quality check PASSED for [CGO-XXX].
  Please approve and set selling price."
On quality check FAIL:
- Notification to Management + CEO + Finance:
  "⚠️ DISCREPANCY: Quality check FAILED
  for [CGO-XXX]. [X] items failed.
  Immediate action required."

STEP 6: Management approves cargo intake
In Management Approvals page:
- Management sees cargo intake awaiting approval
- Reviews quality check results
- Clicks Approve:
  → Stock updated automatically
  → Prompt appears: "Set selling price?"
  → Yes: opens price setting form
  → Later: reminder on dashboard

STEP 7: Management sets selling price
In Management Price Setting:
- Sets price per product (GHS)
- Clicks Save & Broadcast
- Notifications sent to:
  Finance: "Price set for [product]: GHS [X]"
  Marketing: "Price set for [product]: GHS [X]"
  CEO: "Management set price for [product]"
- Price appears in Marketing order form
  as read-only unit price

═══════════════════════════════════════════════
WORKFLOW 2 — OUTBOUND FLOW
(Goods going out to customers)
═══════════════════════════════════════════════

STEP 1: Marketing creates customer order
Already built in MarketingDashboard.
On order submit (Cash/Cheque/MoMo):
- Status = PENDING_FINANCE
- Notification to Finance:
  "New order [ORD-XXX] from [customer]
  — GHS [amount] via [payment mode].
  Review required."
- Finance Orders Queue updates

STEP 2: Finance reviews and approves order
Already built in FinanceDashboard.
On Finance approve:
- Status = FINANCE_APPROVED
- Invoice auto-generated
- Notification to Operations:
  "Order [ORD-XXX] approved by Finance.
  Please prepare [products] for dispatch."
- Notification to Marketing:
  "Order [ORD-XXX] approved by Finance."
- Operations Fulfillment page updates

STEP 3: Operations prepares goods
Already built in OperationsDashboard.
On Operations "Start Preparing":
- Status = PREPARING
- On "Mark Ready for Dispatch":
  Status = READY_FOR_DISPATCH
  Notification to Dispatch:
  "Order [ORD-XXX] for [customer] is ready.
  Please assign a driver and deliver to:
  [address]."
  Dispatch job board updates

STEP 4: Dispatch assigns driver and delivers
Already built in DispatchDashboard.
On driver assigned:
- Status = ASSIGNED
On mark as delivered:
- Status = DELIVERED
- Notification to Marketing:
  "Order [ORD-XXX] delivered to [customer]."
- Notification to Finance:
  "Delivery confirmed for [ORD-XXX].
  Invoice [INV-XXX] can be finalized."

═══════════════════════════════════════════════
WORKFLOW 3 — CREDIT ORDER FLOW
═══════════════════════════════════════════════

STEP 1: Marketing creates credit order
On credit order submit:
- Status = PENDING_MANAGEMENT
- Notification to Management:
  "Credit order [ORD-XXX] from Marketing
  for [customer] — GHS [amount].
  Ghana Card documents attached.
  Approval required."
- Management Approvals page updates

STEP 2: Management approves/rejects credit
On Management approve:
- Status = CREDIT_APPROVED
- Notification to Finance:
  "Credit approved for [ORD-XXX].
  Please collect payment details
  and set due date."
- Notification to Marketing:
  "Credit order [ORD-XXX] approved
  by Management. Finance will process."
On Management reject:
- Status = REJECTED
- Notification to Marketing:
  "Credit order [ORD-XXX] rejected
  by Management. Reason: [reason]"

STEP 3: Finance processes credit order
Same as regular order but with:
- Ghana Card details collected
- Due date set
- Credit limit checked
After Finance approval:
- Same flow: Operations → Dispatch → Delivered

═══════════════════════════════════════════════
WORKFLOW 4 — PRODUCTION INTERNAL ORDER
═══════════════════════════════════════════════

STEP 1: Production requests goods
On internal order submit:
- Status = PENDING_MANAGER
- Notification to Management:
  "Production requests [qty] [product]
  by [date]. Internal order [INT-XXX].
  Approval required."

STEP 2: Management approves
On approve:
- Status = MANAGER_APPROVED
- Notification to Finance:
  "Internal order [INT-XXX] approved.
  Please confirm."

STEP 3: Finance confirms
On Finance confirm:
- Status = FINANCE_CONFIRMED
- Notification to Operations:
  "Prepare [qty] [product] for Production.
  Internal order [INT-XXX]."

STEP 4: Operations prepares
On Operations "Mark Ready":
- Status = READY_COLLECTION
- Notification to Production:
  "Your internal order [INT-XXX] is ready.
  Please collect from Operations."

STEP 5: Production collects
On Production "Record Collection":
- Status = COLLECTED
- Notification to Operations:
  "Production collected [INT-XXX]. Thanks."
- Production can now record output

═══════════════════════════════════════════════
WORKFLOW 5 — HR PAYROLL FLOW
═══════════════════════════════════════════════

STEP 1: HR creates payroll batch
Already built.
On submit to Finance:
- Status = SUBMITTED
- Notification to Finance:
  "HR submitted payroll for [dept] —
  [period]. Total: GHS [amount].
  Staff count: [X]. Please process."

STEP 2: Finance processes payroll
On Finance "Process Payment":
- Status = PROCESSING

STEP 3: Finance marks as paid
On "Mark as Paid":
- Status = PAID
- Notification to HR:
  "Payroll for [dept] [period] has been
  processed and paid by Finance."
- Notification to each staff member:
  "Your salary for [period] has been
  processed. Amount: GHS [amount]"
  (Only sent to that staff member)
  (Amount visible only to that staff)

═══════════════════════════════════════════════
WORKFLOW 6 — STAFF REGISTRATION FLOW
═══════════════════════════════════════════════

STEP 1: New staff registers
On registration form submit:
- Status = PENDING_APPROVAL
- Notification to HR:
  "New staff registration from [name]
  for [department] — [role].
  Review required."
- HR Registrations page updates

STEP 2: HR approves/denies
On HR approve:
- Status = APPROVED
- Generate temporary password
- Generate access token
- Notification to new staff (via email):
  "Welcome to REBMA IMPEX.
  Your account has been approved.
  Email: [email]
  Temporary Password: [password]
  Please login and change your password."
- Notification to Management:
  "HR approved registration for [name]
  joining [department] as [role]."
On HR deny:
- Status = DENIED
- Notification (if email available):
  "Your registration was not approved.
  Reason: [reason]"

═══════════════════════════════════════════════
WORKFLOW 7 — RECEPTION ATTENDANCE FLOW
═══════════════════════════════════════════════

STEP 1: Staff checks in
Reception logs attendance with GPS check.
If late (after HR late threshold):
- Notification to HR:
  "[Staff Name] from [dept] is late.
  Checked in at [time].
  Late by [X] minutes."

STEP 2: End of day
If any staff not checked in by end of day:
- Notification to HR:
  "The following staff did not check in today:
  [list of names]"

STEP 3: Daily report
Auto-generated at end of day.
Notification to HR + Management:
"Daily attendance report ready for [date]."

═══════════════════════════════════════════════
GLOBAL NOTIFICATION SYSTEM FIX
═══════════════════════════════════════════════

Read the existing notification system.
Find where addNotification is defined
and how it works.

Every notification in every workflow above
must use the existing notification system.

Notifications must:
1. Appear in the recipient's Activity panel
2. Show unread count badge in sidebar
3. Be dismissible/markable as read
4. Persist in Supabase notifications table
5. Show time ago (2 min ago, 1 hour ago)
6. Have action button where applicable:
   "View Details" → navigates to relevant page

If notifications table does not exist:
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id UUID REFERENCES auth.users(id),
  recipient_department TEXT,
  sender_id UUID REFERENCES auth.users(id),
  sender_name TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info'
    CHECK (type IN
    ('info','success','warning','error')),
  action_url TEXT,
  action_label TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE notifications
  ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own notifications"
ON notifications FOR SELECT USING (
  auth.uid() = recipient_id OR
  auth.jwt()->>'department' = recipient_department
);
CREATE POLICY "All authenticated insert"
ON notifications FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);
CREATE POLICY "Users update own notifications"
ON notifications FOR UPDATE USING (
  auth.uid() = recipient_id
);

═══════════════════════════════════════════════
ORDER STATUS TRACKER — GLOBAL
═══════════════════════════════════════════════

Every order in the system has a status
that updates as it moves through departments.

The order status stepper must show correctly
in these places:
- Marketing: order detail page
- Finance: order detail page
- Operations: fulfillment detail page
- Dispatch: delivery detail page

Status flow for regular orders:
PENDING_FINANCE → FINANCE_APPROVED →
OPERATIONS_PREPARING → READY_DISPATCH →
IN_TRANSIT → DELIVERED

Status flow for credit orders:
PENDING_MANAGEMENT → CREDIT_APPROVED →
PENDING_FINANCE → FINANCE_APPROVED →
OPERATIONS_PREPARING → READY_DISPATCH →
IN_TRANSIT → DELIVERED

Each status change:
- Updates orders table status column
- Sends notification to relevant department
- Updates the stepper in all views

═══════════════════════════════════════════════
CEO SUPPLIER ORDER → MANAGEMENT CHAIN FIX
═══════════════════════════════════════════════

Read SupplierOrdersView.tsx fully.
Read ManagementDashboard.tsx fully.

Currently CEO can place supplier orders but
the notification to Management is not
properly connected.

Fix this connection:

In SupplierOrdersView.tsx order detail page:
Add "Notify Management" button:
- Only visible when order status =
  payment_authorised OR shipped
- Opens notify modal:
  Pre-filled message with order details
  Recipient: Management (pre-selected)
  Additional message: optional
  Send button

On send:
1. Save to supplier_order_notifications:
   order_id, notified_department='MANAGEMENT',
   message, sent_by=CEO
2. Save to notifications table:
   recipient_department='MANAGEMENT',
   title: "Incoming Shipment Notification"
   message: full message
   action_url: link to supplier order
   action_label: "View Order"
3. Show success toast: "Management notified"
4. Update order: management_notified=true

In ManagementDashboard.tsx:
Add "Incoming Shipments" section that reads
from supplier_order_notifications where
notified_department = 'MANAGEMENT'
Shows: supplier, products, expected date,
order status, "Notify Operations" button

Add management_notified boolean column
to supplier_orders if not exists:
ALTER TABLE supplier_orders
ADD COLUMN IF NOT EXISTS
management_notified BOOLEAN DEFAULT false;

In Management dashboard when they see
incoming shipment notification:
"Notify Operations" button:
- Opens notify modal
- Pre-filled message
- Sends to Operations department
- Saves to supplier_order_notifications
  with notified_department='OPERATIONS'

═══════════════════════════════════════════════
PERFORMANCE ALERTS — AUTO TRIGGER
═══════════════════════════════════════════════

Read existing performance alerts code.

Add these auto-triggers that run on app load
and every 30 minutes:

FINANCIAL ALERTS → CEO + Finance + Management:
- Daily revenue 30% below 7-day average
- Credit outstanding exceeds GHS 50,000
- Payment overdue by 7+ days
- Stock below 20% for any product
- Payroll not submitted by 25th of month

DEPARTMENT PERFORMANCE → HR:
- Department 0 activity for 24 hours
- Attendance below 50% in any department
- Tasks overdue 7+ days in any department

OPERATIONS ALERTS → Management + CEO:
- Discrepancy report unresolved 48hrs
- Stock critically low (below 10%)
- Cargo intake pending review 24hrs+

All alerts:
- Save to performance_alerts table
- Send to notifications table
- Show as red banner on relevant dashboards
- Badge count in sidebar Activity item

═══════════════════════════════════════════════
MESSAGES & BOARDROOM FIX
═══════════════════════════════════════════════

Read Header.tsx fully.
Read BoardroomView.tsx fully.
Read ChatDrawer.tsx fully.
Read App.tsx fully.

The chat icon in header must work.
Clicking it must open Messages & Boardroom.

Fix the onClick on the MessageSquare icon
in Header.tsx to navigate to
Messages & Boardroom view.

Messages & Boardroom tabs:
1. Global Chat (existing)
2. Department Chat (existing)
3. Direct Messages (existing)
4. Boardroom — meetings, video, minutes
5. Announcements

Keep ALL existing BoardroomView functionality.

═══════════════════════════════════════════════
BREADCRUMB — GLOBAL FIX
═══════════════════════════════════════════════

Read BreadcrumbBar.tsx.
Read App.tsx to see how activeSubTab works.

Ensure breadcrumb updates correctly for
EVERY navigation in EVERY department.

Format: [Department] > [Section] > [Detail]

The breadcrumb must update when:
- Department is switched
- Sub-tab/section is changed
- Detail page is opened
- Back button is pressed


FIX NOTIFICATION ALSO..
1.Let All active sales orders list ,be clickable..,
2.Let all active dispatch,be clickable..,
3.Let all active Production,be clickable..,
4.Let all incoming goods from the port,be clickable..,
5.Let all raw materials requested,be clickable..,
6.Let all credit approvals,be clickable..,
7.Let all pending registration,be clickable..,
8.Let all incoming goods from the port,be clickable..,
9.Let all Payment terms & payments,be clickable..,
10.Let all Credit sales & approvals,be clickable..,

═══════════════════════════════════════════════
FINAL RULES
═══════════════════════════════════════════════

1. Read ALL files before touching anything
2. Do not break any existing functionality
3. All workflow connections must be real:
   Real Supabase reads and writes
   Real notification triggers
   Real status updates
4. Notifications must appear in Activity panel
5. Order stepper must show in all departments
6. CEO → Management → Operations chain works
7. Credit flow Management → Finance works
8. Payroll HR → Finance → Staff works
9. Messages chat icon works
10. Breadcrumb updates everywhere
11. Performance alerts auto-trigger
12. All 4 templates work with all workflows
13. Fully responsive all screen sizes
14. List every file modified or created
15. Push to GitHub with commit message above