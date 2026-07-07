// rebma-web/src/services/apiClient.ts
// Centralized API client — all database & auth calls go through Supabase
import { supabase } from '../lib/supabaseClient';

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
    isCeo: db.is_ceo ?? db.isCeo ?? ((db.role || '').toUpperCase() === 'CEO'),
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
    updatedAt: db.updated_at || db.updatedAt
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
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: emailLower,
      password,
    });

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
    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .limit(1);

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
        isCeo: dbUser.isCeo,
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
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.user) {
      throw new Error('Not authenticated');
    }
    const user = sessionData.session.user;

    const { data: userRecords, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .limit(1);

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
    const performerId = sessionData.session?.user?.id || 'unknown';
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

  releaseToDispatch: async (orderId: string, vehicleId: string, driverName?: string) => {
    const { data: orders, error: orderErr } = await supabase.from('orders').select('*').eq('id', orderId).limit(1);
    if (orderErr || !orders || orders.length === 0) throw new Error('Order not found');
    const order = orders[0];

    const { data: sessionData } = await supabase.auth.getSession();
    const performerId = sessionData.session?.user?.id || 'unknown';
    const { data: performers } = await supabase.from('profiles').select('full_name').eq('id', performerId).limit(1);
    const performedBy = performers?.[0]?.full_name || 'Operations Staff';

    const { data: delivery, error: delErr } = await supabase
      .from('delivery_logs')
      .insert({
        order_id: orderId,
        vehicle_id: vehicleId,
        driver_name: driverName || null,
        status: 'ASSIGNED',
        timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).select();
    if (delErr) throw new Error(delErr.message);

    const { data: updatedOrder, error: updateErr } = await supabase
      .from('orders')
      .update({ status: 'OUT_FOR_DELIVERY', updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select();
    if (updateErr) throw new Error(updateErr.message);

    // Support both old (metadata.quantity) and new (metadata.items) order formats
    const meta = order.metadata || {};
    const metaItems: { productName: string; quantity: number }[] = meta.items || [];
    const totalQty = metaItems.length > 0
      ? metaItems.reduce((s: number, i: any) => s + (Number(i.quantity) || 1), 0)
      : Number(meta.quantity || order.quantity || 1);

    // Write stock REMOVE entries so StockView OUT column reflects dispatch
    if (metaItems.length > 0) {
      for (const item of metaItems) {
        if (!item.productName) continue;
        const qty = Number(item.quantity) || 1;
        await supabase.from('stock_ledger').insert({
          product_name: item.productName,
          movement_type: 'REMOVE',
          quantity: qty,
          reference: `Order Dispatched: ${order.ticket_number || order.ticketNumber || `TKT-${order.id.slice(0, 6).toUpperCase()}`}`,
          notes: `Client: ${order.client_name || order.clientName} · Destination: ${order.destination} · Driver: ${driverName || 'TBD'} · Vehicle: ${vehicleId || 'TBD'}`,
          performed_by: performedBy,
          created_at: new Date().toISOString()
        }).then(() => {}, () => {});

        // Reduce stock in stock table if it exists
        try {
          const { data: existing } = await supabase.from('stock').select('*').eq('product_name', item.productName).limit(1);
          if (existing && existing.length > 0) {
            const newQty = Math.max(0, (existing[0].quantity || 0) - qty);
            await supabase.from('stock').update({ quantity: newQty, last_updated: new Date().toISOString(), updated_by: performerId }).eq('id', existing[0].id);
          }
        } catch (e) {
          console.error('Error reducing stock quantity:', e);
        }
      }
    } else if (order.product_name) {
      await supabase.from('stock_ledger').insert({
        product_name: order.product_name,
        movement_type: 'REMOVE',
        quantity: totalQty,
        reference: `Order Dispatched: ${order.ticket_number || order.ticketNumber || `TKT-${order.id.slice(0, 6).toUpperCase()}`}`,
        notes: `Client: ${order.client_name || order.clientName} · Destination: ${order.destination} · Driver: ${driverName || 'TBD'} · Vehicle: ${vehicleId || 'TBD'}`,
        performed_by: performedBy,
        created_at: new Date().toISOString()
      }).then(() => {}, () => {});

      // Reduce stock in stock table if it exists
      try {
        const { data: existing } = await supabase.from('stock').select('*').eq('product_name', order.product_name).limit(1);
        if (existing && existing.length > 0) {
          const newQty = Math.max(0, (existing[0].quantity || 0) - totalQty);
          await supabase.from('stock').update({ quantity: newQty, last_updated: new Date().toISOString(), updated_by: performerId }).eq('id', existing[0].id);
        }
      } catch (e) {
        console.error('Error reducing stock quantity:', e);
      }
    }

    return { 
      order: updatedOrder ? mapOrderToFrontend(updatedOrder[0]) : null, 
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
    const performerId = sessionData.session?.user?.id || 'unknown';
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
    const performerId = sessionData.session?.user?.id || 'unknown';
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

  approveIntake: async (intakeId: string, approve: boolean, unitPrice?: number) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const performerId = sessionData.session?.user?.id || 'unknown';
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
    const performerId = sessionData.session?.user?.id || 'unknown';
    const { data: performers } = await supabase.from('profiles').select('full_name').eq('id', performerId).limit(1);
    const performedBy = performers?.[0]?.full_name || 'Management';

    const { data: orders } = await supabase.from('orders').select('*').eq('id', orderId).limit(1);
    const order = orders?.[0];

    const status = approve ? 'APPROVED' : 'REJECTED';
    const { data: updatedOrder, error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
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
    const performerId = sessionData.session?.user?.id || 'unknown';
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
    const performerId = sessionData.session?.user?.id || 'unknown';
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
    ghanaCardFront?: string; ghanaCardBack?: string;
  }) => {
    const { data: customer, error } = await supabase
      .from('customers')
      .insert({
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
      }).select();
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
      const { data: updatedOrder, error } = await supabase
        .from('orders')
        .update({ status: 'APPROVED', updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .select();
      if (error) throw new Error(error.message);
      return { message: 'Order approved by Finance.', order: updatedOrder ? mapOrderToFrontend(updatedOrder[0]) : null };
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

    const { data: updatedOrder, error: orderErr } = await supabase
      .from('orders')
      .update({ status: 'PROCESSING', updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select();
    if (orderErr) throw new Error(orderErr.message);

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
    const { data, error } = await supabase
      .from('material_requisitions')
      .insert({
        items,
        notes: notes || null,
        status: 'PENDING_MANAGEMENT',
        timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        extended_data: {
          notes: notes || null,
          itemsCount: items.length
        }
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
    const performerId = sessionData.session?.user?.id || 'unknown';

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
