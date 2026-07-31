// rebma-web/src/services/apiClient.ts
// Centralized API client — all database & auth calls go through Supabase
import { supabase } from '../lib/supabaseClient';
import { sendNotification } from '../utils/sendNotification';
import { waLink, buildDirectionsMessage } from '../utils/whatsapp';

// A stalled network call (flaky connection, rate-limit) otherwise hangs
// whatever awaits it forever — Supabase calls have no built-in timeout, so
// login and profile fetches never reject, just never resolve, leaving the
// sign-in spinner stuck until the user reloads the page.
export function withTimeout<T>(promise: PromiseLike<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

// --- Translation Mappings (Insulates UI from Database Snake_Case schema) ---

const generateSecurePassword = (length = 16): string => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*';
  const all = upper + lower + digits + symbols;
  
  const pw = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)]
  ];
  
  for (let i = 4; i < length; i++) {
    pw.push(all[Math.floor(Math.random() * all.length)]);
  }
  
  for (let i = pw.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pw[i], pw[j]] = [pw[j], pw[i]];
  }
  
  return pw.join('');
};

const mapProfileToFrontend = (db: any): any => {
  if (!db) return null;
  return {
    id: db.id,
    email: db.email,
    fullName: db.full_name || db.fullName || db.email,
    department: (db.role || db.department || '').toUpperCase(),
    ghanaCardId: db.ghana_card_id || db.ghanaCardId,
    phone: db.phone,
    status: db.status,
    isAdmin: db.is_admin ?? db.isAdmin ?? ((db.role || '').toUpperCase() === 'CEO'),
    isSuperAdmin: db.is_super_admin ?? false,
    photo: db.photo,
    passwordHash: db.password_hash || db.passwordHash,
    createdAt: db.created_at || db.createdAt,
    updatedAt: db.updated_at || db.updatedAt,
    requiresPasswordReset: db.requires_password_reset ?? db.requiresPasswordReset ?? false,
  };
};

const mapAttendanceToFrontend = (db: any): any => {
  if (!db) return null;
  return {
    id: db.id,
    userId: db.user_id || db.userId,
    date: db.date,
    checkInTime: db.check_in_time || db.checkInTime,
    checkOutTime: db.check_out_time || db.checkOutTime,
    status: db.status,
    createdAt: db.created_at || db.createdAt,
    user: db.user ? {
      fullName: db.user.full_name || db.user.fullName,
      department: db.user.role || db.user.department
    } : null
  };
};

const mapVisitorToFrontend = (db: any): any => {
  if (!db) return null;
  return {
    id: db.id,
    fullName: db.full_name || db.fullName,
    purpose: db.purpose,
    hostName: db.host_name || db.hostName,
    checkedInById: db.checked_in_by_id || db.checkedInById,
    checkInTime: db.check_in_time || db.checkInTime,
    checkOutTime: db.check_out_time || db.checkOutTime
  };
};

const mapCargoToFrontend = (db: any): any => {
  if (!db) return null;
  return {
    id: db.id,
    productName: db.product_name || db.productName,
    goodsCode: db.goods_code || db.goodsCode,
    destination: db.destination,
    productImage: db.product_image || db.productImage,
    country: db.country,
    company: db.company,
    quantity: db.quantity,
    weight: db.weight,
    discrepancies: db.discrepancies,
    isFaulty: db.is_fault_or_damaged ?? db.is_faulty ?? db.isFaulty,
    status: db.status,
    unitPrice: db.unit_price || db.unitPrice,
    approvedById: db.approved_by_id || db.approvedById,
    createdAt: db.created_at || db.createdAt,
    updatedAt: db.updated_at || db.updatedAt,
    approvedBy: db.approvedBy ? {
      fullName: db.approvedBy.full_name || db.approvedBy.fullName
    } : null
  };
};

const mapOrderToFrontend = (db: any): any => {
  if (!db) return null;
  return {
    id: db.id,
    ticketNumber: db.ticket_number || db.ticketNumber,
    clientName: db.client_name || db.clientName,
    productName: db.product_name || db.productName,
    destination: db.destination,
    ghanaCard: db.metadata?.ghanaCard || db.ghana_card || db.ghanaCard,
    paymentMode: db.payment_mode || db.paymentMode,
    totalAmount: Number(db.total_amount ?? db.totalAmount ?? 0),
    status: db.status,
    quantity: db.quantity,
    metadata: db.metadata || null,
    createdById: db.created_by || db.created_by_id || db.createdById,
    createdAt: db.created_at || db.createdAt,
    updatedAt: db.updated_at || db.updatedAt,
    createdBy: db.createdBy ? {
      fullName: db.createdBy.full_name || db.createdBy.fullName
    } : null
  };
};

const mapRequisitionToFrontend = (db: any): any => {
  if (!db) return null;
  return {
    id: db.id,
    items: db.items || [{ materialName: db.product_name || 'Materials', quantity: Number(db.quantity || 0) }],
    notes: db.notes,
    status: db.status,
    createdAt: db.created_at || db.createdAt,
    updatedAt: db.updated_at || db.updatedAt
  };
};

const mapLedgerToFrontend = (db: any): any => {
  if (!db) return null;
  return {
    id: db.id,
    orderId: db.order_id || db.orderId,
    invoiceNo: db.invoice_no || db.invoiceNo,
    amount: db.amount,
    taxAmount: db.tax_amount || db.taxAmount,
    grandTotal: db.grand_total || db.grandTotal,
    issuedAt: db.issued_at || db.issuedAt,
    order: db.order ? {
      clientName: db.order.client_name || db.order.clientName,
      paymentMode: db.order.payment_mode || db.order.paymentMode
    } : null
  };
};

const mapAuditToFrontend = (db: any): any => {
  if (!db) return null;
  return {
    id: db.id,
    action: db.action,
    department: db.department,
    performedBy: db.performed_by || db.performedBy,
    userId: db.user_id || db.userId,
    details: db.details,
    timestamp: db.timestamp
  };
};

const mapPriceToFrontend = (db: any): any => {
  if (!db) return null;
  return {
    id: db.id,
    productName: db.product_name || db.productName,
    category: db.category,
    unitPrice: db.unit_price || db.unitPrice,
    currency: db.currency,
    setBy: db.updated_by || db.set_by || db.setBy,
    setAt: db.updated_at || db.set_at || db.setAt
  };
};

const mapCustomerToFrontend = (db: any): any => {
  if (!db) return null;
  return {
    id: db.id,
    name: db.name,
    phone: db.phone,
    email: db.email,
    location: db.location,
    companyName: db.company_name || db.companyName,
    ghanaCard: db.ghana_card_id || db.ghana_card || db.ghanaCard,
    photo: db.customer_photo || db.photo,
    ghanaCardFront: db.ghana_card_front,
    ghanaCardBack: db.ghana_card_back,
    registeredAt: db.registered_at || db.registeredAt,
    updatedAt: db.updated_at || db.updatedAt,
    isSpecialCustomer: db.is_special_customer ?? false,
    discountPercent: Number(db.discount_percent) || 0,
  };
};

// ── Token helpers (Maintained for backward compatibility with App.tsx state management) ────────────
// Supabase manages its own session internally, but these helpers keep the UI contract stable.
export const getToken = (): string | null => {
  // Return Supabase session token if available, fall back to localStorage
  return localStorage.getItem('rebma_token');
};
export const setToken = (token: string) => localStorage.setItem('rebma_token', token);
export const clearToken = () => localStorage.removeItem('rebma_token');

// ── Auth ──────────────────────────────────────────────────────
export const auth = {
  login: async (email: string, password: string) => {
    const emailLower = email.trim().toLowerCase();

    // 1. Sign in with Supabase Auth first
    const { data: authData, error: authError } = await withTimeout(
      supabase.auth.signInWithPassword({ email: emailLower, password }),
      15000,
      'Sign-in is taking too long. Please check your connection and try again.'
    );

    if (authError) {
      if (authError.message === 'Invalid login credentials' || authError.message.includes('credentials')) {
        throw new Error('Incorrect email or password.');
      }
      throw new Error(authError.message || 'Login failed');
    }

    const userId = authData.user?.id;
    if (!userId) {
      throw new Error('Login failed: user ID not found.');
    }

    // 2. Fetch user profile using the authenticated user's ID
    const { data: users, error: userError } = await withTimeout(
      supabase.from('profiles').select('*').eq('id', userId).limit(1),
      15000,
      'Could not load your account. Please check your connection and try again.'
    );

    if (userError || !users || users.length === 0) {
      // Sign out to clean up session
      await supabase.auth.signOut().catch(() => {});
      throw new Error('Account not found. Please contact HR.');
    }

    const dbUser = mapProfileToFrontend(users[0]);

    // Check account status
    const userStatus = (dbUser.status || '').toUpperCase();
    if (userStatus !== 'ACTIVE') {
      await supabase.auth.signOut().catch(() => {});
      
      if (userStatus === 'PENDING' || userStatus === 'PENDING_APPROVAL') {
        throw new Error('Your account is pending HR approval.');
      }
      if (userStatus === 'REJECTED') {
        throw new Error('Your account access has been denied.');
      }
      throw new Error(`Your account status is ${dbUser.status}.`);
    }

    const token = authData.session?.access_token || 'supabase_active_session';
    setToken(token);

    return {
      token,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        fullName: dbUser.fullName,
        department: dbUser.department,
        isAdmin: dbUser.isAdmin,
        isSuperAdmin: dbUser.isSuperAdmin,
        photo: dbUser.photo,
        status: dbUser.status,
        requiresPasswordReset: dbUser.requiresPasswordReset
      }
    };
  },

  register: async (data: {
    email: string; fullName: string;
    department: string; ghanaCardId?: string; phone?: string;
  }) => {
    const res = await fetch('/api/register-standard-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.error || 'Registration failed');
    }

    return body;
  },

  me: async () => {
    const { data: sessionData, error: sessionError } = await withTimeout(
      supabase.auth.getSession(),
      15000,
      'Could not verify your session. Please check your connection and try again.'
    );
    if (sessionError || !sessionData.session?.user) {
      throw new Error('Not authenticated');
    }
    const user = sessionData.session.user;

    const { data: userRecords, error } = await withTimeout(
      supabase.from('profiles').select('*').eq('id', user.id).limit(1),
      15000,
      'Could not load your account. Please check your connection and try again.'
    );

    if (error || !userRecords || userRecords.length === 0) {
      throw new Error('User profile record not found.');
    }
    
    const dbUser = mapProfileToFrontend(userRecords[0]);
    if (dbUser.status !== 'ACTIVE') {
      throw new Error('User account is not active.');
    }
    return dbUser;
  },

  signOut: async () => {
    await supabase.auth.signOut().catch(() => {});
    clearToken();
    // A different account signing into the same browser tab must not
    // inherit this session's last-viewed department/tab — that mismatch is
    // what caused the "Select a Department" blank screen bug.
    sessionStorage.removeItem('rebma-last-dept');
    sessionStorage.removeItem('rebma-last-tab');
  },

  changePassword: async (newPassword: string, _currentPassword?: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user) throw new Error('Not authenticated');

    // Supabase updateUser doesn't require the current password — session proves identity
    const { error: authError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (authError) {
      throw new Error(authError.message || 'Failed to update password in auth system');
    }

    // Clear temporary password details and turn reset flag off
    const { error: dbError } = await supabase
      .from('profiles')
      .update({
        password_hash: null,
        requires_password_reset: false,
        metadata: {
          tempAuthSecret: null
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionData.session.user.id);

    if (dbError) {
      throw new Error(dbError.message || 'Failed to update database profile status');
    }
  }
};

// ── HR ────────────────────────────────────────────────────────
export const hr = {
  getPendingUsers: async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('status', 'PENDING_APPROVAL')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapProfileToFrontend);
  },

  getAllUsers: async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('role', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).map(mapProfileToFrontend);
  },

  /**
   * Approve or deny a user — calls the serverless endpoint which uses
   * the service_role key to update the profile and send the magic link email.
   */
  approveUser: async (userId: string, approve: boolean, generatedPassword?: string, _token?: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error('Not authenticated');

    const res = await fetch('/api/approve-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ userId, approve, generatedPassword }),
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.error || 'Failed to process user approval.');
    }

    return body;
  },

  getAttendance: async () => {
    const { data, error } = await supabase
      .from('attendance')
      .select('*, user:profiles(full_name, role)')
      .order('check_in_time', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapAttendanceToFrontend);
  },
};

// ── Operations ────────────────────────────────────────────────
export const operations = {
  getIncomingGoods: async () => {
    const { data, error } = await supabase
      .from('cargo_intake')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapCargoToFrontend);
  },

  logIntake: async (data: {
    productName?: string; goodsCode?: string; destination?: string;
    country: string; company: string; quantity: number; weight: number;
    discrepancies?: string; isFaulty?: boolean; productImage?: string;
    metadata?: any;
  }) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const performerId = sessionData.session?.user?.id || null;
    const { data: performers } = await supabase.from('profiles').select('full_name').eq('id', performerId).limit(1);
    const performedBy = performers?.[0]?.full_name || 'Ops Staff';

    const intakeCode = data.goodsCode || `GC-${Date.now()}`;
    const { data: intake, error } = await supabase
      .from('cargo_intake')
      .insert({
        product_name: data.productName || null,
        goods_code: intakeCode,
        destination: data.destination || null,
        product_image: data.productImage || null,
        country: data.country,
        company: data.company,
        quantity: Number(data.quantity),
        weight: Number(data.weight),
        discrepancies: data.discrepancies || null,
        is_fault_or_damaged: !!data.isFaulty,
        status: 'PENDING_MANAGEMENT_APPROVAL',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: data.metadata || null
      }).select();

    if (error) throw new Error(error.message);

    try {
      await supabase.from('global_audit_history').insert({
        action: 'LOG_PORT_INTAKE',
        department: 'OPERATIONS',
        performed_by: performedBy,
        user_id: performerId,
        details: `Port intake logged: ${data.productName || data.company} (${data.quantity} units) from ${data.country}. Code: ${intakeCode}`,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error('Audit entry failed:', e);
    }

    return intake ? intake.map(mapCargoToFrontend) : null;
  },

  getFulfillmentTickets: async () => {
    const { data, error } = await supabase
      .from('fulfillment_tickets')
      .select('*, order:orders(client_name, total_amount), productionRequest:production_requests(*)')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    
    return (data || []).map((ticket: any) => ({
      id: ticket.id,
      orderId: ticket.order_id || ticket.orderId,
      productionRequestId: ticket.production_request_id || ticket.productionRequestId,
      type: ticket.type,
      details: ticket.details,
      status: ticket.status,
      createdAt: ticket.created_at || ticket.createdAt,
      updatedAt: ticket.updated_at || ticket.updatedAt,
      order: ticket.order ? {
        clientName: ticket.order.client_name,
        totalAmount: ticket.order.total_amount
      } : null,
      productionRequest: ticket.productionRequest ? mapRequisitionToFrontend(ticket.productionRequest) : null
    }));
  },

  releaseToDispatch: async (orderId: string, vehicleId: string, driverName?: string, driverId?: string) => {
    const { data: orders, error: orderErr } = await supabase.from('orders').select('id, client_name, customer_name, destination').eq('id', orderId).limit(1);
    if (orderErr || !orders || orders.length === 0) throw new Error('Order not found');
    const order = orders[0];

    const { data: delivery, error: delErr } = await supabase
      .from('delivery_logs')
      .insert({
        order_id: orderId,
        vehicle_id: vehicleId,
        driver_name: driverName || null,
        driver_id: driverId || null,
        customer_name: order.customer_name || order.client_name || null,
        delivery_address: order.destination || null,
        status: 'ASSIGNED',
        updated_at: new Date().toISOString()
      }).select();
    if (delErr) throw new Error(delErr.message);

    // Order stays at its current status — a driver being assigned isn't the
    // same as them actually moving. It only becomes OUT_FOR_DELIVERY once
    // the driver starts sharing live location (see DriverTrackingView).

    // Stock was already removed when the order was finalized (invoiced) — dispatch
    // just hands the already-committed goods to a vehicle, no further stock change.

    return {
      order: mapOrderToFrontend(order),
      delivery: delivery ? {
        id: delivery[0].id,
        orderId: delivery[0].order_id,
        vehicleId: delivery[0].vehicle_id,
        driverName: delivery[0].driver_name,
        status: delivery[0].status,
        createdAt: delivery[0].created_at,
        updatedAt: delivery[0].updated_at
      } : null
    };
  },

  getGeneralPurchases: async () => {
    const { data, error } = await supabase
      .from('general_purchases')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((p: any) => ({
      id: p.id,
      itemName: p.item_name,
      itemCode: p.item_code,
      category: p.category,
      quantity: Number(p.quantity),
      cost: Number(p.cost),
      status: p.status,
      createdAt: p.created_at || new Date().toISOString(),
      dateReceived: p.date_received,
      approvedById: p.approved_by_id
    }));
  },

  logGeneralPurchase: async (data: {
    itemName: string;
    itemCode: string;
    category: string;
    quantity: number;
    cost: number;
    dateReceived: string;
  }) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const performerId = sessionData.session?.user?.id || null;
    const { data: performers } = await supabase.from('profiles').select('full_name').eq('id', performerId).limit(1);
    const performedBy = performers?.[0]?.full_name || 'Ops Staff';

    const { data: purchase, error } = await supabase
      .from('general_purchases')
      .insert({
        item_name: data.itemName,
        item_code: data.itemCode,
        category: data.category,
        quantity: Number(data.quantity),
        cost: Number(data.cost),
        date_received: data.dateReceived,
        status: 'PENDING_MANAGEMENT_APPROVAL',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();
    if (error) throw new Error(error.message);

    try {
      await supabase.from('global_audit_history').insert({
        action: 'LOG_GENERAL_PURCHASE',
        department: 'OPERATIONS',
        performed_by: performedBy,
        user_id: performerId,
        details: `General purchase logged: ${data.itemName} (${data.quantity} units, GHS ${data.cost}). Code: ${data.itemCode}`,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error('Audit entry failed:', e);
    }
    return purchase ? purchase[0] : null;
  },
};

// Guards against selling more than is physically in stock. Called right
// before an order is approved (the point stock actually gets deducted) —
// returns the list of items that don't have enough stock so the caller can
// block the approval with a clear message instead of silently going
// negative (this is what let Statement's "Remaining Stock" show -13,853).
async function checkStockAvailability(order: any): Promise<{ productName: string; requested: number; available: number }[]> {
  const meta = order.metadata || {};
  const metaItems = meta.items || [];
  const lineItems = metaItems.length > 0
    ? metaItems
    : (order.product_name || order.productName) ? [{ productName: order.product_name || order.productName, quantity: Number(order.quantity || 1) }] : [];

  const shortages: { productName: string; requested: number; available: number }[] = [];
  for (const item of lineItems) {
    if (!item.productName) continue;
    const requested = Number(item.quantity) || 0;
    if (requested <= 0) continue;
    const { data: existing } = await supabase.from('stock').select('quantity').ilike('product_name', item.productName).limit(1);
    const available = existing && existing.length > 0 ? Number(existing[0].quantity) || 0 : 0;
    if (requested > available) {
      shortages.push({ productName: item.productName, requested, available });
    }
  }
  return shortages;
}

function shortageMessage(shortages: { productName: string; requested: number; available: number }[]): string {
  const list = shortages.map(s => `${s.productName} (need ${s.requested}, only ${s.available} in stock)`).join('; ');
  return `Insufficient stock — cannot approve: ${list}`;
}

// Deducts sold items from stock the moment a sale is confirmed — Finance approving
// a direct-payment order, or Management approving a credit order (both are the
// point revenue is already recognized, see the ['APPROVED','PROCESSING',...]
// status checks used across the dashboards) — rather than waiting for the order
// to be invoiced/dispatched later. Never throws: a stock hiccup shouldn't block
// the approval itself, it just logs. Availability itself is checked separately,
// before this runs, via checkStockAvailability — see evaluateOrder/approveCreditOrder.
async function deductStockForOrder(order: any, reference: string) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    // performed_by / updated_by are UUID FKs to auth.users — must be a real session id or null, never a name/placeholder string
    const performerId = sessionData.session?.user?.id || null;
    const now = new Date().toISOString();

    const meta = order.metadata || {};
    const metaItems = meta.items || [];
    const lineItems = metaItems.length > 0
      ? metaItems
      : (order.product_name || order.productName) ? [{ productName: order.product_name || order.productName, quantity: Number(order.quantity || 1) }] : [];

    for (const item of lineItems) {
      if (!item.productName) continue;
      const qty = Number(item.quantity) || 1;

      const { error: ledgerErr } = await supabase.from('stock_ledger').insert({
        product_name: item.productName,
        movement_type: 'REMOVE',
        quantity: qty,
        reference,
        performed_by: performerId,
        created_at: now,
      });
      if (ledgerErr) console.error('Stock ledger insert failed during sale confirmation:', ledgerErr);

      const { data: existing } = await supabase.from('stock').select('id, quantity').ilike('product_name', item.productName).limit(1);
      if (existing && existing.length > 0) {
        const newQty = Math.max(0, (existing[0].quantity || 0) - qty);
        const { error: stockErr } = await supabase.from('stock').update({ quantity: newQty, last_updated: now, updated_by: performerId }).eq('id', existing[0].id);
        if (stockErr) console.error('Stock quantity update failed during sale confirmation:', stockErr);
      }
    }
  } catch (e) {
    console.error('Stock deduction failed during sale confirmation:', e);
  }
}

// Auto-generates the customer receipt and the operations pick/load ticket the
// moment a sale is confirmed (same trigger point as deductStockForOrder) —
// replaces the old flow where Finance had to manually key in a receipt and
// separately click "Finalize Order" to move the order into the fulfillment
// queue. Idempotent: skips if a receipt/ticket already exists for this order
// (covers manual-entry paths that also route through order evaluation).
// Never throws — a hiccup here shouldn't block the approval itself.
async function autoGenerateReceiptAndTicket(order: any, reference: string) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const performerId = sessionData.session?.user?.id || null;
    const now = new Date().toISOString();
    const orderId = order.id;
    const clientName = order.client_name || order.clientName || 'Customer';
    const totalAmount = Number(order.total_amount ?? order.totalAmount ?? 0);
    const meta = order.metadata || {};
    const metaItems = meta.items || [];

    const { data: existingPayments } = await supabase
      .from('finance_payments')
      .select('id')
      .eq('order_id', orderId)
      .limit(1);

    if (!existingPayments || existingPayments.length === 0) {
      // Same identifier as the operations dispatch ticket — one document
      // number to trace a sale across receipt, ticket, and invoice, instead
      // of a separately generated RCT-xxxxxx that matches nothing else.
      const invoiceNumber = order.ticket_number || order.ticketNumber || `ORD-${String(orderId).slice(0, 6).toUpperCase()}`;
      const { error: payErr } = await supabase.from('finance_payments').insert({
        client_name: clientName,
        customer_name: clientName,
        amount: totalAmount,
        payment_mode: order.payment_mode || order.paymentMode || 'CASH',
        payment_type: 'Full Payment',
        order_id: orderId,
        invoice_number: invoiceNumber,
        recorded_by: order.finance_approved_by || performerId,
        status: 'CONFIRMED',
        payment_details: { items: metaItems, reference },
        created_at: now,
      });
      if (payErr) {
        console.error('Auto receipt insert failed:', payErr);
      } else {
        // Give every department that needs visibility into a confirmed sale a
        // copy of the receipt notification — not just Finance who recorded it.
        const receiptMsg = `${invoiceNumber} — ${clientName}, GHS ${totalAmount.toLocaleString()} (${order.ticket_number || order.ticketNumber || orderId})`;
        for (const dept of ['FINANCE', 'CEO', 'MARKETING', 'MANAGEMENT']) {
          sendNotification({
            recipientDepartment: dept,
            title: 'Payment receipt generated',
            message: receiptMsg,
            type: 'success',
            actionLabel: 'View Statement',
          });
        }
      }
    }

    const { data: existingTickets } = await supabase
      .from('fulfillment_tickets')
      .select('id')
      .eq('order_id', orderId)
      .limit(1);

    if (!existingTickets || existingTickets.length === 0) {
      const totalQty = metaItems.length > 0
        ? metaItems.reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0)
        : Number(order.quantity || 1);

      const { error: ticketErr } = await supabase.from('fulfillment_tickets').insert({
        order_id: orderId,
        type: 'ORDER_FULFILLMENT',
        details: {
          clientName,
          productName: order.product_name || order.productName,
          quantity: totalQty,
          totalAmount,
          items: metaItems,
        },
        status: 'PENDING',
        created_at: now,
        updated_at: now,
      });
      if (ticketErr) console.error('Auto fulfillment ticket insert failed:', ticketErr);

      const { error: orderErr } = await supabase
        .from('orders')
        .update({ status: 'PROCESSING', updated_at: now })
        .eq('id', orderId);
      if (orderErr) console.error('Auto order-to-PROCESSING update failed:', orderErr);
    }
  } catch (e) {
    console.error('Auto receipt/ticket generation failed:', e);
  }
}

// ── Management ────────────────────────────────────────────────
export const management = {
  getAuditLog: async () => {
    const { data, error } = await supabase
      .from('global_audit_history')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data || []).map(mapAuditToFrontend);
  },

  getPrices: async () => {
    const { data, error } = await supabase
      .from('goods_prices')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapPriceToFrontend);
  },

  setPrice: async (data: { productName: string; category: string; unitPrice: number; currency: string; metadata?: any }) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const performerId = sessionData.session?.user?.id || null;
    const { data: performers } = await supabase.from('profiles').select('full_name').eq('id', performerId).limit(1);
    const performedBy = performers?.[0]?.full_name || 'Management';

    const { data: price, error } = await supabase
      .from('goods_prices')
      .insert({
        product_name: data.productName,
        category: data.category || 'INCOMING_GOODS',
        unit_price: Number(data.unitPrice),
        currency: data.currency || 'GHS',
        updated_by: performedBy,
        updated_at: new Date().toISOString()
      }).select();
    if (error) throw new Error(error.message);
    return price ? mapPriceToFrontend(price[0]) : null;
  },

  // Discount is set per-customer based on Management's own judgment (performance,
  // loyalty, volume) — it isn't restricted to customers Marketing flagged as "special"
  // at registration; that flag is just a signal, not a gate.
  setCustomerDiscount: async (customerId: string, discountPercent: number) => {
    const { error } = await supabase
      .from('customers')
      .update({ discount_percent: discountPercent, updated_at: new Date().toISOString() })
      .eq('id', customerId);
    if (error) throw new Error(error.message);
  },

  // Marketing can flag a customer special at registration, but Management
  // also reviews existing customers over time (performance/loyalty/volume)
  // and should be able to raise or lift the flag themselves without waiting
  // on Marketing to go back and edit the customer record.
  setCustomerSpecial: async (customerId: string, isSpecial: boolean) => {
    const { error } = await supabase
      .from('customers')
      .update({ is_special_customer: isSpecial, updated_at: new Date().toISOString() })
      .eq('id', customerId);
    if (error) throw new Error(error.message);
  },

  approveIntake: async (intakeId: string, approve: boolean, unitPrice?: number) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const performerId = sessionData.session?.user?.id || null;
    const { data: performers } = await supabase.from('profiles').select('full_name').eq('id', performerId).limit(1);
    const performedBy = performers?.[0]?.full_name || 'Management';

    const status = approve ? 'APPROVED' : 'REJECTED';
    const { data: intake, error } = await supabase
      .from('cargo_intake')
      .update({
        status,
        unit_price: approve ? Number(unitPrice) : null,
        approved_by_id: performerId,
        updated_at: new Date().toISOString()
      })
      .eq('id', intakeId)
      .select();
    if (error) throw new Error(error.message);

    // If approved cargo intake is in-house production, sync it to stock table
    if (approve && intake && intake.length > 0) {
      const approvedCargo = intake[0];
      if (approvedCargo.company === 'REBMA IN-HOUSE PRODUCTION') {
        try {
          const { data: existingStock } = await supabase
            .from('stock')
            .select('*')
            .eq('product_code', approvedCargo.goods_code)
            .limit(1);

          if (existingStock && existingStock.length > 0) {
            const newQty = (existingStock[0].quantity || 0) + approvedCargo.quantity;
            await supabase
              .from('stock')
              .update({
                quantity: newQty,
                last_updated: new Date().toISOString(),
                updated_by: performerId
              })
              .eq('id', existingStock[0].id);

            await supabase
              .from('stock_ledger')
              .insert({
                product_name: approvedCargo.product_name,
                movement_type: 'ADD',
                quantity: approvedCargo.quantity,
                reference: 'In-House Production Approved',
                notes: `Cargo Intake ID: ${intakeId}`,
                performed_by: performerId,
                created_at: new Date().toISOString()
              });
          } else {
            await supabase
              .from('stock')
              .insert({
                product_name: approvedCargo.product_name,
                product_code: approvedCargo.goods_code,
                category: 'In-House Production',
                quantity: approvedCargo.quantity,
                maximum_level: 1000,
                minimum_level: 10,
                unit: 'units',
                last_updated: new Date().toISOString(),
                updated_by: performerId
              });

            await supabase
              .from('stock_ledger')
              .insert({
                product_name: approvedCargo.product_name,
                movement_type: 'ADD',
                quantity: approvedCargo.quantity,
                reference: 'In-House Production Approved',
                notes: `Cargo Intake ID: ${intakeId}`,
                performed_by: performerId,
                created_at: new Date().toISOString()
              });
          }
        } catch (e) {
          console.error('Error auto-syncing to stock table:', e);
        }
      }
    }

    try {
      await supabase.from('global_audit_history').insert({
        action: approve ? 'APPROVE_PORT_CARGO' : 'REJECT_PORT_CARGO',
        department: 'MANAGEMENT',
        performed_by: performedBy,
        user_id: performerId,
        details: `Port cargo ${intakeId} ${approve ? 'approved at GHS ' + unitPrice + '/unit' : 'rejected'}.`,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error(e);
    }

    return intake ? mapCargoToFrontend(intake[0]) : null;
  },

  approveCreditOrder: async (orderId: string, approve: boolean) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const performerId = sessionData.session?.user?.id || null;
    const { data: performers } = await supabase.from('profiles').select('full_name, email').eq('id', performerId).limit(1);
    const performedBy = performers?.[0]?.full_name || 'Management';
    const performedByEmail = performers?.[0]?.email || null;

    const { data: orders } = await supabase.from('orders').select('*').eq('id', orderId).limit(1);
    const order = orders?.[0];
    if (!order) throw new Error('Order not found');

    if (approve) {
      const shortages = await checkStockAvailability(order);
      if (shortages.length > 0) throw new Error(shortageMessage(shortages));
    }

    const status = approve ? 'APPROVED' : 'REJECTED';
    const { data: updatedOrder, error } = await supabase
      .from('orders')
      .update(approve
        ? { status, updated_at: new Date().toISOString(), finance_approved_by: performedBy, finance_approved_by_email: performedByEmail }
        : { status, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select();
    if (error) throw new Error(error.message);

    if (order) {
      try {
        await supabase.from('global_audit_history').insert({
          action: approve ? 'APPROVE_CREDIT_ORDER' : 'REJECT_CREDIT_ORDER',
          department: 'MANAGEMENT',
          performed_by: performedBy,
          user_id: performerId,
          details: `Credit order ${orderId} for ${order.client_name || order.clientName} (GHS ${order.total_amount || order.totalAmount}) ${approve ? 'approved' : 'rejected'}.`,
          timestamp: new Date().toISOString()
        });
      } catch (e) {
        console.error(e);
      }

      if (approve) {
        const ticketRef = order.ticket_number || order.ticketNumber || `ORD-${orderId.slice(0, 6).toUpperCase()}`;
        await deductStockForOrder(order, `Credit Order Approved: ${ticketRef}`);
        await autoGenerateReceiptAndTicket({ ...order, finance_approved_by: performedBy }, `Credit Order Approved: ${ticketRef}`);
        const { data: finalOrder } = await supabase.from('orders').select('*').eq('id', orderId).limit(1);
        return finalOrder?.[0] ? mapOrderToFrontend(finalOrder[0]) : (updatedOrder ? mapOrderToFrontend(updatedOrder[0]) : null);
      }
    }

    return updatedOrder ? mapOrderToFrontend(updatedOrder[0]) : null;
  },

  approveProductionRequest: async (requestId: string, approve: boolean) => {
    const status = approve ? 'APPROVED' : 'REJECTED';
    const { data, error } = await supabase
      .from('production_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .select();
    if (error) throw new Error(error.message);
    return data ? mapRequisitionToFrontend(data[0]) : null;
  },

  approveGeneralPurchase: async (purchaseId: string, approve: boolean) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const performerId = sessionData.session?.user?.id || null;
    const { data: performers } = await supabase.from('profiles').select('full_name').eq('id', performerId).limit(1);
    const performedBy = performers?.[0]?.full_name || 'Management';

    const status = approve ? 'APPROVED' : 'REJECTED';
    const { data: purchase, error } = await supabase
      .from('general_purchases')
      .update({
        status,
        approved_by_id: performerId,
        updated_at: new Date().toISOString()
      })
      .eq('id', purchaseId)
      .select();
    if (error) throw new Error(error.message);

    try {
      await supabase.from('global_audit_history').insert({
        action: approve ? 'APPROVE_GENERAL_PURCHASE' : 'REJECT_GENERAL_PURCHASE',
        department: 'MANAGEMENT',
        performed_by: performedBy,
        user_id: performerId,
        details: `General purchase ${purchaseId} ${approve ? 'approved' : 'rejected'}.`,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error(e);
    }
    return purchase ? purchase[0] : null;
  },
};

// ── Marketing ─────────────────────────────────────────────────
export const marketing = {
  getOrders: async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapOrderToFrontend);
  },

  createOrder: async (data: {
    clientName: string; productName?: string; destination?: string;
    ghanaCard?: string; paymentMode: string; totalAmount: number;
  }) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const performerId = sessionData.session?.user?.id || null;
    const { data: performers } = await supabase.from('profiles').select('full_name').eq('id', performerId).limit(1);
    const performedBy = performers?.[0]?.full_name || 'Marketing Staff';

    const ticketNumber = `TKT-${Math.floor(10000 + Math.random() * 90000)}`;
    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        ticket_number: ticketNumber,
        client_name: data.clientName,
        product_name: data.productName || null,
        destination: data.destination || null,
        payment_mode: data.paymentMode,
        total_amount: Number(data.totalAmount),
        status: 'PENDING_FINANCE',
        created_by: performerId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          clientName: data.clientName,
          productName: data.productName || null,
          destination: data.destination || null,
          ghanaCard: data.ghanaCard || null,
          paymentMode: data.paymentMode,
          totalAmount: Number(data.totalAmount)
        }
      }).select();
    if (error) throw new Error(error.message);

    try {
      await supabase.from('global_audit_history').insert({
        action: 'CREATE_ORDER',
        department: 'MARKETING',
        performed_by: performedBy,
        user_id: performerId,
        details: `Order ${ticketNumber} created for ${data.clientName} — GHS ${data.totalAmount} (${data.paymentMode}).`,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error(e);
    }

    return order ? mapOrderToFrontend(order[0]) : null;
  },

  getCustomers: async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('registered_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapCustomerToFrontend);
  },

  registerCustomer: async (data: {
    name: string; phone: string; email?: string;
    location: string; companyName: string; ghanaCard?: string; photo?: string;
    ghanaCardFront?: string; ghanaCardBack?: string; isSpecialCustomer?: boolean;
  }) => {
    const basePayload = {
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      location: data.location,
      company_name: data.companyName,
      ghana_card_id: data.ghanaCard || null,
      customer_photo: data.photo || null,
      ghana_card_front: data.ghanaCardFront || null,
      ghana_card_back: data.ghanaCardBack || null,
      registered_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    let { data: customer, error } = await supabase
      .from('customers')
      .insert({ ...basePayload, is_special_customer: data.isSpecialCustomer || false })
      .select();
    if (error?.message?.includes('is_special_customer')) {
      // Column not migrated onto the live DB yet — registration itself
      // shouldn't be blocked by a field that can't be saved yet.
      ({ data: customer, error } = await supabase.from('customers').insert(basePayload).select());
    }
    if (error) throw new Error(error.message);
    return customer ? mapCustomerToFrontend(customer[0]) : null;
  },
};

// ── Finance ───────────────────────────────────────────────────
export const finance = {
  getPayments: async () => {
    const { data, error } = await supabase
      .from('finance_payments')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    
    return (data || []).map((p: any) => ({
      id: p.id,
      clientName: p.client_name || 'N/A',
      amount: Number(p.amount || 0),
      paymentMode: p.payment_mode || 'CASH',
      paymentType: p.payment_type || 'DIRECT',
      orderId: p.order_id || undefined,
      createdAt: p.created_at
    }));
  },

  getInvoices: async () => {
    const { data, error } = await supabase
      .from('finance_ledger')
      .select('*, order:orders(client_name, total_amount, ticket_number)')
      .order('issued_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((inv: any) => ({
      id: inv.id,
      orderId: inv.order_id || inv.orderId,
      invoiceNo: inv.invoice_no || inv.invoiceNo,
      amount: inv.amount,
      taxAmount: inv.tax_amount || inv.taxAmount,
      grandTotal: inv.grand_total || inv.grandTotal,
      issuedAt: inv.issued_at || inv.issuedAt,
      order: inv.order ? {
        clientName: inv.order.client_name,
        totalAmount: inv.order.total_amount,
        ticketNumber: inv.order.ticket_number
      } : null
    }));
  },

  evaluateOrder: async (orderId: string, approve: boolean) => {
    const { data: orders } = await supabase.from('orders').select('*').eq('id', orderId).limit(1);
    const order = orders?.[0];
    if (!order) throw new Error('Order not found');

    if (!approve) {
      const { data: rejectedOrder, error } = await supabase
        .from('orders')
        .update({ status: 'REJECTED', updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .select();
      if (error) throw new Error(error.message);
      return { message: 'Order rejected by Finance.', order: rejectedOrder ? mapOrderToFrontend(rejectedOrder[0]) : null };
    }

    if (order.payment_mode === 'CREDIT' || order.paymentMode === 'CREDIT') {
      const { data: updatedOrder, error } = await supabase
        .from('orders')
        .update({ status: 'PENDING_MANAGEMENT', updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .select();
      if (error) throw new Error(error.message);
      return { message: 'Credit order sent to Management.', order: updatedOrder ? mapOrderToFrontend(updatedOrder[0]) : null };
    } else {
      const shortages = await checkStockAvailability(order);
      if (shortages.length > 0) throw new Error(shortageMessage(shortages));

      const { data: sessionData } = await supabase.auth.getSession();
      const performerId = sessionData.session?.user?.id || null;
      const { data: performers } = await supabase.from('profiles').select('full_name, email').eq('id', performerId).limit(1);
      const performedBy = performers?.[0]?.full_name || null;
      const performedByEmail = performers?.[0]?.email || null;

      const { data: updatedOrder, error } = await supabase
        .from('orders')
        .update({
          status: 'APPROVED', updated_at: new Date().toISOString(),
          finance_approved_by: performedBy, finance_approved_by_email: performedByEmail,
        })
        .eq('id', orderId)
        .select();
      if (error) throw new Error(error.message);

      const ticketRef = order.ticket_number || order.ticketNumber || `ORD-${orderId.slice(0, 6).toUpperCase()}`;
      await deductStockForOrder(order, `Order Approved: ${ticketRef}`);
      await autoGenerateReceiptAndTicket({ ...order, finance_approved_by: performedBy }, `Order Approved: ${ticketRef}`);

      const { data: finalOrder } = await supabase.from('orders').select('*').eq('id', orderId).limit(1);
      return { message: 'Order approved by Finance.', order: finalOrder?.[0] ? mapOrderToFrontend(finalOrder[0]) : (updatedOrder ? mapOrderToFrontend(updatedOrder[0]) : null) };
    }
  },

  finalizeOrder: async (orderId: string) => {
    const { data: orders } = await supabase.from('orders').select('*').eq('id', orderId).limit(1);
    const order = orders?.[0];
    if (!order) throw new Error('Order not found');

    const totalAmountVal = order.total_amount || order.totalAmount;
    const invoiceNo = `INV-${Date.now().toString().slice(-6)}`;
    const taxAmount = totalAmountVal * 0.15;
    const grandTotal = totalAmountVal + taxAmount;

    const meta = order.metadata || {};
    const metaItems = meta.items || [];
    const totalQty = metaItems.length > 0
      ? metaItems.reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0)
      : Number(meta.quantity || order.quantity || 1);

    const { data: invoice, error: invErr } = await supabase
      .from('finance_ledger')
      .insert({
        order_id: orderId,
        invoice_no: invoiceNo,
        amount: totalAmountVal,
        tax_amount: taxAmount,
        grand_total: grandTotal,
        issued_at: new Date().toISOString()
      }).select();
    if (invErr) throw new Error(invErr.message);

    // Auto-approval already creates this ticket (see autoGenerateReceiptAndTicket) —
    // only insert here if that didn't happen for some reason (e.g. older order).
    const { data: existingTickets } = await supabase.from('fulfillment_tickets').select('id').eq('order_id', orderId).limit(1);
    if (!existingTickets || existingTickets.length === 0) {
      const { error: ticketErr } = await supabase
        .from('fulfillment_tickets')
        .insert({
          order_id: orderId,
          type: 'ORDER_FULFILLMENT',
          details: {
            clientName: order.client_name || order.clientName,
            productName: order.product_name || order.productName,
            quantity: totalQty,
            totalAmount: totalAmountVal,
            items: metaItems
          },
          status: 'PENDING',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      if (ticketErr) throw new Error(ticketErr.message);
    }

    const { data: updatedOrder, error: orderErr } = await supabase
      .from('orders')
      .update({ status: 'PROCESSING', updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select();
    if (orderErr) throw new Error(orderErr.message);

    // Stock was already deducted when the sale was confirmed (Finance approval or
    // Management credit approval, see deductStockForOrder) — finalizing just
    // generates the invoice and warehouse pick ticket, no further stock change.

    return {
      message: 'Order finalized.', 
      order: updatedOrder ? mapOrderToFrontend(updatedOrder[0]) : null, 
      invoice: invoice ? mapLedgerToFrontend(invoice[0]) : null 
    };
  },

  releaseProductionMaterials: async (requestId: string) => {
    const { data: reqs } = await supabase.from('production_requests').select('*').eq('id', requestId).limit(1);
    const request = reqs?.[0];
    if (!request) throw new Error('Production request not found');

    const { data: updatedRequest, error } = await supabase
      .from('production_requests')
      .update({ status: 'TICKETS_ISSUED', updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .select();
    if (error) throw new Error(error.message);

    await supabase
      .from('fulfillment_tickets')
      .insert({
        production_request_id: requestId,
        type: 'PRODUCTION_RELEASE',
        details: {
          items: request.items
        },
        status: 'PENDING',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    return updatedRequest ? mapRequisitionToFrontend(updatedRequest[0]) : null;
  },
};

// ── Production ────────────────────────────────────────────────
export const production = {
  getRequests: async () => {
    const { data, error } = await supabase
      .from('production_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapRequisitionToFrontend);
  },

  requestMaterials: async (items: Array<{ materialName: string; quantity: number }>, notes?: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const performerId = sessionData.session?.user?.id;
    const { data: performers } = performerId
      ? await supabase.from('profiles').select('full_name').eq('id', performerId).limit(1)
      : { data: null };
    const requestedBy = performers?.[0]?.full_name || 'Production Staff';

    const { data, error } = await supabase
      .from('material_requisitions')
      .insert({
        requested_by: requestedBy,
        department: 'PRODUCTION',
        items,
        notes: notes || null,
        status: 'PENDING_MANAGEMENT',
        updated_at: new Date().toISOString(),
      }).select();
    if (error) throw new Error(error.message);
    return data ? data.map(mapRequisitionToFrontend) : null;
  },
};

// ── Dispatch ──────────────────────────────────────────────────
export const dispatch = {
  getDeliveries: async () => {
    const { data, error } = await supabase
      .from('delivery_logs')
      .select('*, order:orders(client_name, total_amount)')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((del: any) => ({
      id: del.id,
      orderId: del.order_id || del.orderId,
      vehicleId: del.vehicle_id || del.vehicleId,
      driverName: del.driver_name || del.driverName,
      status: del.status,
      activeCoordinates: del.active_coordinates || del.activeCoordinates,
      deliveredAt: del.delivered_at || del.deliveredAt,
      createdAt: del.created_at || del.createdAt,
      updatedAt: del.updated_at || del.updatedAt,
      order: del.order ? {
        clientName: del.order.client_name,
        totalAmount: del.order.total_amount
      } : null
    }));
  },

  updateDelivery: async (orderId: string, status: 'IN_TRANSIT' | 'DELIVERED', coordinates?: { lat: number; lng: number }) => {
    const updateData: any = { status, updated_at: new Date().toISOString() };
    if (status === 'DELIVERED') {
      updateData.delivered_at = new Date().toISOString();
    }
    if (coordinates) {
      updateData.active_coordinates = coordinates;
    }

    const { data: delivery, error: delErr } = await supabase
      .from('delivery_logs')
      .update(updateData)
      .eq('order_id', orderId)
      .select();
    if (delErr) throw new Error(delErr.message);

    if (status === 'DELIVERED') {
      await supabase
        .from('orders')
        .update({ status: 'DELIVERED', updated_at: new Date().toISOString() })
        .eq('id', orderId);
    }

    return delivery ? delivery[0] : null;
  },

  getLatestDriverLocations: async (driverIds: string[]) => {
    if (driverIds.length === 0) return {};
    const { data, error } = await supabase
      .from('driver_locations')
      .select('driver_id, latitude, longitude, recorded_at')
      .in('driver_id', driverIds)
      .order('recorded_at', { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const latest: Record<string, { lat: number; lng: number; recordedAt: string }> = {};
    for (const row of (data || []) as any[]) {
      if (!latest[row.driver_id]) {
        latest[row.driver_id] = { lat: Number(row.latitude), lng: Number(row.longitude), recordedAt: row.recorded_at };
      }
    }
    return latest;
  },

  getDriverLocationHistory: async (driverId: string, limit = 20) => {
    const { data, error } = await supabase
      .from('driver_locations')
      .select('latitude, longitude, recorded_at')
      .eq('driver_id', driverId)
      .order('recorded_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data || []).reverse().map((r: any) => ({ lat: Number(r.latitude), lng: Number(r.longitude), recordedAt: r.recorded_at }));
  },

  // Opens a pre-filled WhatsApp chat (wa.me) for a dispatcher to review and
  // tap Send themselves — no Twilio/Meta business API, no account, no fee.
  // The tab is opened synchronously (before any await) so browsers don't
  // treat it as an unrequested popup once the Supabase queries resolve.
  sendWhatsAppDirections: async (driverId: string) => {
    const tab = window.open('', '_blank');

    const { data: driver, error: driverErr } = await supabase
      .from('drivers')
      .select('id, full_name, phone')
      .eq('id', driverId)
      .single();
    if (driverErr || !driver) { tab?.close(); throw new Error('Driver not found.'); }
    if (!driver.phone) { tab?.close(); throw new Error(`${driver.full_name} has no phone number on file.`); }

    const { data: stops, error: stopsErr } = await supabase
      .from('delivery_logs')
      .select('id, customer_name, delivery_address, dispatch_sequence, created_at')
      .eq('driver_id', driverId)
      .in('status', ['ASSIGNED', 'IN_TRANSIT'])
      .order('dispatch_sequence', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });
    if (stopsErr) { tab?.close(); throw new Error(stopsErr.message); }
    if (!stops || stops.length === 0) { tab?.close(); throw new Error('This driver has no active deliveries to send.'); }

    // Backfill dispatch_sequence for any stop that doesn't have one yet.
    let nextSeq = 1;
    const usedSeqs = new Set(stops.filter(s => s.dispatch_sequence).map(s => s.dispatch_sequence));
    for (const stop of stops as any[]) {
      if (!stop.dispatch_sequence) {
        while (usedSeqs.has(nextSeq)) nextSeq++;
        stop.dispatch_sequence = nextSeq;
        usedSeqs.add(nextSeq);
        await supabase.from('delivery_logs').update({ dispatch_sequence: nextSeq }).eq('id', stop.id);
      }
    }
    stops.sort((a: any, b: any) => (a.dispatch_sequence || 0) - (b.dispatch_sequence || 0));

    const message = buildDirectionsMessage(driver.full_name, stops.map((s: any) => ({
      sequence: s.dispatch_sequence,
      customerName: s.customer_name || 'Client',
      deliveryAddress: s.delivery_address || '',
    })));
    const link = waLink(driver.phone, message);

    if (tab) tab.location.href = link; else window.open(link, '_blank');

    const now = new Date().toISOString();
    await supabase.from('delivery_logs').update({ whatsapp_sent_at: now }).in('id', stops.map((s: any) => s.id));

    return { sentTo: driver.phone, stopCount: stops.length };
  },
};

// ── Reception ─────────────────────────────────────────────────
export const reception = {
  getVisitors: async () => {
    const { data, error } = await supabase
      .from('visitors')
      .select('*')
      .order('check_in_time', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapVisitorToFrontend);
  },

  checkInVisitor: async (fullName: string, purpose: string, hostName: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const performerId = sessionData.session?.user?.id || null;

    const { data, error } = await supabase
      .from('visitors')
      .insert({
        full_name: fullName,
        purpose,
        host_name: hostName,
        checked_in_by_id: performerId,
        check_in_time: new Date().toISOString()
      }).select();
    if (error) throw new Error(error.message);
    return data ? data.map(mapVisitorToFrontend) : null;
  },

  checkOutVisitor: async (visitorId: string) => {
    const { data, error } = await supabase
      .from('visitors')
      .update({ check_out_time: new Date().toISOString() })
      .eq('id', visitorId)
      .select();
    if (error) throw new Error(error.message);
    return data ? data.map(mapVisitorToFrontend) : null;
  },

  checkInAttendance: async (employeeUserId: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const now = new Date();
    const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 0);

    const { data, error } = await supabase
      .from('attendance')
      .insert({
        user_id: employeeUserId,
        date: today.toISOString().split('T')[0],
        check_in_time: now.toISOString(),
        status: isLate ? 'LATE' : 'PRESENT',
        created_at: now.toISOString()
      }).select();
    if (error) throw new Error(error.message);
    return data ? data.map(mapAttendanceToFrontend) : null;
  },

  checkOutAttendance: async (employeeUserId: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('attendance')
      .update({ check_out_time: new Date().toISOString() })
      .eq('user_id', employeeUserId)
      .eq('date', today.toISOString().split('T')[0])
      .select();
    if (error) throw new Error(error.message);
    return data ? data.map(mapAttendanceToFrontend) : null;
  },
};

export const stockApi = {
  getStock: async () => {
    const { data, error } = await supabase
      .from('stock')
      .select('*')
      .order('last_updated', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((s: any) => ({
      id: s.id,
      name: s.product_name || '',
      sku: s.product_code || '',
      category: s.category || 'Uncategorized',
      current: Number(s.quantity || 0),
      capacity: Number(s.maximum_level || 0),
      minimum: Number(s.minimum_level || 0),
      unit: s.unit || 'units',
      updatedAt: s.last_updated || s.created_at || new Date().toISOString()
    }));
  },

  getStockMovements: async () => {
    const { data, error } = await supabase
      .from('stock_ledger')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((m: any) => ({
      id: m.id,
      productName: m.product_name || '',
      change: Number(m.quantity || 0),
      reason: m.reference || m.notes || 'Manual Adjustment',
      updatedBy: 'Staff',
      date: m.created_at || new Date().toISOString()
    }));
  },

  adjustStock: async (productId: string, productName: string, currentQty: number, delta: number, reason: string, notes: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const performerId = sessionData.session?.user?.id || null;

    const newQty = Math.max(0, currentQty + delta);
    const { error: stockErr } = await supabase
      .from('stock')
      .update({
        quantity: newQty,
        last_updated: new Date().toISOString(),
        updated_by: performerId
      })
      .eq('id', productId);
    if (stockErr) throw new Error(stockErr.message);

    const { error: ledgerErr } = await supabase
      .from('stock_ledger')
      .insert({
        product_name: productName,
        movement_type: delta > 0 ? 'ADD' : 'REMOVE',
        quantity: delta,
        reference: reason,
        notes: notes || null,
        performed_by: performerId,
        created_at: new Date().toISOString()
      });
    if (ledgerErr) throw new Error(ledgerErr.message);

    return newQty;
  },

  getCategories: async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  },

  addCategory: async (name: string) => {
    const { data, error } = await supabase
      .from('categories')
      .insert({ name })
      .select();
    if (error) throw new Error(error.message);
    return data?.[0] || null;
  },

  createStock: async (productName: string, productCode: string, category: string, initialQty: number, maximumLevel: number, minimumLevel: number, unit = 'units') => {
    const { data: sessionData } = await supabase.auth.getSession();
    const performerId = sessionData.session?.user?.id || null;

    const { data, error } = await supabase
      .from('stock')
      .insert({
        product_name: productName,
        product_code: productCode,
        category: category || 'Uncategorized',
        quantity: initialQty,
        maximum_level: maximumLevel,
        minimum_level: minimumLevel,
        unit,
        last_updated: new Date().toISOString(),
        updated_by: performerId
      })
      .select();
    if (error) throw new Error(error.message);
    return data?.[0] || null;
  },

  deleteStock: async (id: string) => {
    const { error } = await supabase
      .from('stock')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  }
};

export const wipApi = {
  getWipStock: async () => {
    const { data, error } = await supabase
      .from('wip_stock')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((w: any) => ({
      id: w.id,
      productName: w.product_name,
      stage: w.stage,
      qty: Number(w.qty),
      unit: w.unit,
      batchRef: w.batch_ref,
      notes: w.notes,
      updatedAt: w.updated_at
    }));
  },

  addWipStock: async (data: { productName: string; stage: string; qty: number; unit: string; batchRef?: string; notes?: string }) => {
    const { data: inserted, error } = await supabase
      .from('wip_stock')
      .insert({
        product_name: data.productName,
        stage: data.stage,
        qty: Number(data.qty),
        unit: data.unit,
        batch_ref: data.batchRef || null,
        notes: data.notes || null,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      })
      .select();
    if (error) throw new Error(error.message);
    return inserted?.[0] || null;
  },

  updateWipStock: async (
    id: string,
    qty: number,
    notes?: string,
    stage?: string,
    productName?: string,
    unit?: string,
    batchRef?: string
  ) => {
    const updateData: any = {
      qty: Number(qty),
      notes: notes || null,
      updated_at: new Date().toISOString()
    };
    if (stage) updateData.stage = stage;
    if (productName) updateData.product_name = productName;
    if (unit) updateData.unit = unit;
    if (batchRef) updateData.batch_ref = batchRef;

    const { data: updated, error } = await supabase
      .from('wip_stock')
      .update(updateData)
      .eq('id', id)
      .select();
    if (error) throw new Error(error.message);
    return updated?.[0] || null;
  },

  deleteWipStock: async (id: string) => {
    const { error } = await supabase
      .from('wip_stock')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  }
};

// ── Proforma Invoices ─────────────────────────────────────────
// On-demand quotes generated before payment, addressable from
// Marketing/Finance/Management/CEO — distinct from finance_ledger
// (issued after payment) and finance_payments (the receipt).
export const invoices = {
  listProformas: async () => {
    const { data, error } = await supabase
      .from('proforma_invoices')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data || []).map(row => ({ ...row, proforma_no: row.id }));
  },

  createProforma: async (input: {
    orderId?: string | null;
    clientName: string;
    lineItems: { productName: string; quantity: number; unitPrice: number }[];
    taxRate?: number;
    notes?: string;
  }) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const performerId = sessionData.session?.user?.id || null;

    const subtotal = input.lineItems.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
    const taxRate = input.taxRate ?? 0.15;
    const taxAmount = subtotal * taxRate;
    const grandTotal = subtotal + taxAmount;

    const { data, error } = await supabase
      .from('proforma_invoices')
      .insert({
        order_id: input.orderId || null,
        client_name: input.clientName,
        line_items: input.lineItems,
        subtotal,
        tax_amount: taxAmount,
        grand_total: grandTotal,
        currency: 'GHS',
        status: 'DRAFT',
        created_by: performerId,
        notes: input.notes || null,
      })
      .select();
    if (error) throw new Error(error.message);
    return data?.[0] ? { ...data[0], proforma_no: data[0].id } : null;
  },
};

// ── Messenger (channels, DMs, reactions, reads, ad-hoc calls) ──────────
function slugRoom(prefix: string) {
  return `Rebma-${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const messenger = {
  ensureEveryoneChannel: async () => {
    const { data: existing } = await supabase.from('channels').select('id').eq('type', 'everyone').limit(1);
    if (existing && existing.length > 0) return existing[0].id;
    const { data: created, error } = await supabase.from('channels').insert({ name: 'Everyone', type: 'everyone' }).select();
    if (error || !created) return null;
    return created[0].id;
  },

  listMyChannels: async (userId: string) => {
    const { data: memberships } = await supabase.from('channel_members').select('channel_id').eq('user_id', userId);
    const ids = (memberships || []).map(m => m.channel_id);
    if (ids.length === 0) return [];
    const { data: channels } = await supabase.from('channels').select('*').in('id', ids).order('created_at', { ascending: false });
    return channels || [];
  },

  joinChannel: async (channelId: string, userId: string) => {
    await supabase.from('channel_members').upsert({ channel_id: channelId, user_id: userId }, { onConflict: 'channel_id,user_id' });
  },

  getOrCreateDmChannel: async (myId: string, otherId: string) => {
    const { data: myChannels } = await supabase.from('channel_members').select('channel_id').eq('user_id', myId);
    const myIds = (myChannels || []).map(c => c.channel_id);
    if (myIds.length > 0) {
      const { data: otherChannels } = await supabase.from('channel_members').select('channel_id').eq('user_id', otherId).in('channel_id', myIds);
      for (const oc of otherChannels || []) {
        const { data: chRow } = await supabase.from('channels').select('*').eq('id', oc.channel_id).eq('type', 'dm').limit(1);
        if (chRow && chRow.length > 0) {
          const { count } = await supabase.from('channel_members').select('user_id', { count: 'exact', head: true }).eq('channel_id', oc.channel_id);
          if (count === 2) return chRow[0];
        }
      }
    }
    const { data: created, error } = await supabase.from('channels').insert({ type: 'dm', created_by: myId }).select();
    if (error || !created) throw new Error(error?.message || 'Failed to create DM channel');
    const channel = created[0];
    await supabase.from('channel_members').insert([
      { channel_id: channel.id, user_id: myId },
      { channel_id: channel.id, user_id: otherId },
    ]);
    return channel;
  },

  createGroupChannel: async (name: string, memberIds: string[], creatorId: string) => {
    const { data: created, error } = await supabase.from('channels').insert({ name, type: 'group', created_by: creatorId }).select();
    if (error || !created) throw new Error(error?.message || 'Failed to create channel');
    const channel = created[0];
    const allMembers = Array.from(new Set([...memberIds, creatorId]));
    await supabase.from('channel_members').insert(allMembers.map(uid => ({ channel_id: channel.id, user_id: uid })));
    return channel;
  },

  fetchMessages: async (channelId: string) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return data || [];
  },

  sendMessage: async (channelId: string, senderId: string, senderName: string, content: string, opts?: { attachmentUrl?: string; attachmentType?: string; attachmentName?: string; replyToId?: string }) => {
    const { data, error } = await supabase.from('chat_messages').insert({
      channel_id: channelId,
      sender_id: senderId,
      sender: senderName,
      content,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachment_url: opts?.attachmentUrl || null,
      attachment_type: opts?.attachmentType || null,
      attachment_name: opts?.attachmentName || null,
      reply_to_id: opts?.replyToId || null,
    }).select();
    if (error) throw new Error(error.message);
    return data?.[0] || null;
  },

  toggleReaction: async (messageId: string, userId: string, emoji: string) => {
    const { data: existing } = await supabase.from('chat_message_reactions').select('*').eq('message_id', messageId).eq('user_id', userId).eq('emoji', emoji).limit(1);
    if (existing && existing.length > 0) {
      await supabase.from('chat_message_reactions').delete().eq('message_id', messageId).eq('user_id', userId).eq('emoji', emoji);
    } else {
      await supabase.from('chat_message_reactions').insert({ message_id: messageId, user_id: userId, emoji });
    }
  },

  fetchReactions: async (messageIds: string[]) => {
    if (messageIds.length === 0) return [];
    const { data } = await supabase.from('chat_message_reactions').select('*').in('message_id', messageIds);
    return data || [];
  },

  markRead: async (messageId: string, userId: string) => {
    await supabase.from('chat_message_reads').upsert({ message_id: messageId, user_id: userId }, { onConflict: 'message_id,user_id' });
  },

  fetchReads: async (messageIds: string[]) => {
    if (messageIds.length === 0) return [];
    const { data } = await supabase.from('chat_message_reads').select('*').in('message_id', messageIds);
    return data || [];
  },

  uploadChatAttachment: async (file: File, channelId: string) => {
    const fileExt = file.name.split('.').pop();
    const path = `${channelId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
    const { error } = await supabase.storage.from('chat-attachments').upload(path, file);
    if (error) throw new Error(error.message);
    return path;
  },

  getSignedAttachmentUrl: async (path: string) => {
    const { data, error } = await supabase.storage.from('chat-attachments').createSignedUrl(path, 60 * 60 * 24 * 7);
    if (error) return null;
    return data?.signedUrl || null;
  },

  notifyUsers: async (userIds: string[], type: string, title: string, body: string, linkRef?: string) => {
    if (userIds.length === 0) return;
    await supabase.from('user_notifications').insert(userIds.map(uid => ({ user_id: uid, type, title, body, link_ref: linkRef || null })));
  },

  // Ad-hoc voice/video call from a chat channel — creates a real meeting row
  // with a fresh Jitsi room, notifies every member, and posts a join link
  // into the thread. `kind` only changes the initial Jitsi config (audio-only
  // vs video) — Jitsi's own UI lets either side switch mid-call.
  startCall: async (channelId: string, memberIds: string[], organizerId: string, organizerName: string, kind: 'voice' | 'video') => {
    const room = slugRoom(kind === 'voice' ? 'Call' : 'Video');
    const { data: created, error } = await supabase.from('meetings').insert({
      title: `${kind === 'voice' ? 'Voice' : 'Video'} call started by ${organizerName}`,
      scheduled_at: new Date().toISOString(),
      duration_minutes: 60,
      organizer_id: organizerId,
      jitsi_room: room,
      status: 'IN_PROGRESS',
    }).select();
    if (error || !created) throw new Error(error?.message || 'Failed to start call');
    const meeting = created[0];
    await supabase.from('meeting_attendees').insert(memberIds.map(uid => ({ meeting_id: meeting.id, user_id: uid, rsvp_status: uid === organizerId ? 'ACCEPTED' : 'INVITED' })));
    const callMsg = await messenger.sendMessage(channelId, organizerId, organizerName, `📞 ${kind === 'voice' ? 'Voice' : 'Video'} call started — tap to join.`, { attachmentType: 'call', attachmentUrl: meeting.id });
    void callMsg;
    await messenger.notifyUsers(memberIds.filter(id => id !== organizerId), 'call_started', `${organizerName} started a ${kind} call`, 'Tap to join now', meeting.id);
    return meeting;
  },
};

// ── Meeting App (scheduling, RSVP, recap notes) ────────────────────────
export const meetingsApi = {
  scheduleMeeting: async (
    title: string, description: string, scheduledAt: string, durationMinutes: number,
    organizerId: string, organizerName: string, attendeeIds: string[]
  ) => {
    const room = slugRoom('Mtg');
    const { data: created, error } = await supabase.from('meetings').insert({
      title, description, scheduled_at: scheduledAt, duration_minutes: durationMinutes,
      organizer_id: organizerId, jitsi_room: room, status: 'SCHEDULED',
    }).select();
    if (error || !created) throw new Error(error?.message || 'Failed to schedule meeting');
    const meeting = created[0];
    const allAttendees = Array.from(new Set([...attendeeIds, organizerId]));
    await supabase.from('meeting_attendees').insert(allAttendees.map(uid => ({
      meeting_id: meeting.id, user_id: uid, rsvp_status: uid === organizerId ? 'ACCEPTED' : 'INVITED',
    })));
    await messenger.notifyUsers(
      attendeeIds.filter(id => id !== organizerId), 'meeting_invite',
      `${organizerName} invited you to "${title}"`,
      `Scheduled ${new Date(scheduledAt).toLocaleString()}`, meeting.id
    );
    return meeting;
  },

  fetchMyMeetings: async (userId: string) => {
    const { data: memberships } = await supabase.from('meeting_attendees').select('meeting_id, rsvp_status').eq('user_id', userId);
    const ids = (memberships || []).map((m: any) => m.meeting_id);
    if (ids.length === 0) return [];
    const { data: meetings } = await supabase.from('meetings').select('*').in('id', ids).order('scheduled_at', { ascending: false });
    const rsvpById: Record<string, string> = {};
    (memberships || []).forEach((m: any) => { rsvpById[m.meeting_id] = m.rsvp_status; });
    return (meetings || []).map((m: any) => ({ ...m, myRsvp: rsvpById[m.id] }));
  },

  fetchAttendees: async (meetingId: string) => {
    const { data } = await supabase.from('meeting_attendees').select('*').eq('meeting_id', meetingId);
    return data || [];
  },

  updateRsvp: async (meetingId: string, userId: string, status: 'ACCEPTED' | 'DECLINED') => {
    await supabase.from('meeting_attendees').update({ rsvp_status: status }).eq('meeting_id', meetingId).eq('user_id', userId);
  },

  markJoined: async (meetingId: string, userId: string) => {
    await supabase.from('meeting_attendees').update({ joined_at: new Date().toISOString() }).eq('meeting_id', meetingId).eq('user_id', userId);
    await supabase.from('meetings').update({ status: 'IN_PROGRESS' }).eq('id', meetingId).eq('status', 'SCHEDULED');
  },

  saveRecapNotes: async (meetingId: string, notes: string) => {
    await supabase.from('meetings').update({ recap_notes: notes }).eq('id', meetingId);
  },

  completeMeeting: async (meetingId: string) => {
    await supabase.from('meetings').update({ status: 'COMPLETED' }).eq('id', meetingId);
  },

  cancelMeeting: async (meetingId: string) => {
    await supabase.from('meetings').update({ status: 'CANCELLED' }).eq('id', meetingId);
  },

  fetchMyNotifications: async (userId: string) => {
    const { data } = await supabase.from('user_notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
    return data || [];
  },

  markNotificationRead: async (id: string) => {
    await supabase.from('user_notifications').update({ read: true }).eq('id', id);
  },

  markAllNotificationsRead: async (userId: string) => {
    await supabase.from('user_notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
  },
};
