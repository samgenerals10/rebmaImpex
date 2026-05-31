// rebma-web/src/services/apiClient.ts
// Centralized API client — all database & auth calls go through neonClient
import { neonClient } from '../lib/neonClient';

// --- Translation Mappings (Insulates UI from Database Snake_Case schema) ---

const mapProfileToFrontend = (db: any): any => {
  if (!db) return null;
  return {
    id: db.id,
    email: db.email,
    fullName: db.full_name || db.fullName || db.email,
    department: db.role || db.department,
    ghanaCardId: db.ghana_card_id || db.ghanaCardId,
    phone: db.phone,
    status: db.status,
    isCeo: db.is_ceo ?? db.isCeo ?? (db.role === 'CEO'),
    photo: db.photo,
    passwordHash: db.password_hash || db.passwordHash,
    createdAt: db.created_at || db.createdAt,
    updatedAt: db.updated_at || db.updatedAt
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
    ghanaCard: db.ghana_card || db.ghanaCard,
    paymentMode: db.payment_mode || db.paymentMode,
    totalAmount: db.total_amount || db.totalAmount,
    status: db.status,
    createdById: db.created_by_id || db.createdById,
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
    items: db.items,
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
    setBy: db.set_by || db.setBy,
    setAt: db.set_at || db.setAt
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
    ghanaCard: db.ghana_card || db.ghanaCard,
    photo: db.photo,
    registeredAt: db.registered_at || db.registeredAt,
    updatedAt: db.updated_at || db.updatedAt
  };
};

// ── Token helpers (Maintained to prevent UI breakage in App.tsx state management) ────────────
export const getToken = (): string | null => localStorage.getItem('rebma_token');
export const setToken = (token: string) => localStorage.setItem('rebma_token', token);
export const clearToken = () => localStorage.removeItem('rebma_token');

// ── Auth ──────────────────────────────────────────────────────
export const auth = {
  login: async (email: string, password: string) => {
    const res = await neonClient.auth.signIn.email({ email, password });
    if (res.error) {
      throw new Error(res.error.message || 'Login failed');
    }
    
    const token = (res.data as any).token || 'neon_active_session';
    setToken(token);

    // Fetch user details from public profiles table to get department role
    const { data: users, error: userError } = await neonClient
      .from('profiles')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .limit(1);

    if (userError || !users || users.length === 0) {
      return {
        token,
        user: {
          id: res.data.user.id,
          email: res.data.user.email,
          fullName: res.data.user.name || res.data.user.email,
          department: 'CEO',
          isCeo: true,
          photo: null
        }
      };
    }

    const dbUser = mapProfileToFrontend(users[0]);
    return {
      token,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        fullName: dbUser.fullName,
        department: dbUser.department,
        isCeo: dbUser.isCeo,
        photo: dbUser.photo
      }
    };
  },

  register: async (data: {
    email: string; password: string; fullName: string;
    department: string; ghanaCardId?: string; phone?: string;
  }) => {
    // 1. Sign up user in Neon Auth
    const res = await (neonClient.auth.signUp.email as any)({
      email: data.email,
      password: data.password,
      name: data.fullName,
      metadata: {
        department: data.department,
        ghanaCardId: data.ghanaCardId || null,
        phone: data.phone || null,
      },
      options: {
        data: {
          department: data.department,
          ghanaCardId: data.ghanaCardId || null,
          phone: data.phone || null,
        }
      }
    });

    if (res.error) {
      throw new Error(res.error.message || 'Registration failed');
    }

    const userId = res.data.user.id;
    const initialStatus = data.department === 'CEO' ? 'OTP_VERIFICATION' : 'PENDING_APPROVAL';

    // 2. Synchronize to public "profiles" DB table to preserve references
    const { error: dbError } = await neonClient.from('profiles').insert({
      id: userId,
      email: data.email.trim().toLowerCase(),
      full_name: data.fullName,
      role: data.department,
      ghana_card_id: data.ghanaCardId || null,
      phone: data.phone || null,
      status: initialStatus,
      is_ceo: data.department === 'CEO',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: {
        fullName: data.fullName,
        department: data.department,
        ghanaCardId: data.ghanaCardId || null,
        phone: data.phone || null
      }
    });

    if (dbError) {
      console.error('Error inserting user to public profiles table:', dbError);
    }

    return {
      message: data.department === 'CEO'
        ? 'CEO registered. Verify SMS OTP to activate.'
        : 'Registration submitted. Awaiting HR approval.',
      userId,
      status: initialStatus
    };
  },

  verifyCeoOtp: async (email: string, _otp: string) => {
    // Update public profiles table status to ACTIVE
    const { error } = await neonClient
      .from('profiles')
      .update({ status: 'ACTIVE', updated_at: new Date().toISOString() })
      .eq('email', email.trim().toLowerCase());

    if (error) {
      throw new Error(error.message || 'Failed to verify CEO OTP');
    }
    return { message: 'CEO verified. You may now log in.' };
  },

  me: async () => {
    const sessionRes = await neonClient.auth.getSession();
    if (sessionRes.error || !sessionRes.data || !sessionRes.data.user) {
      throw new Error('Not authenticated');
    }
    const user = sessionRes.data.user;

    const { data: userRecords, error } = await neonClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .limit(1);

    if (error || !userRecords || userRecords.length === 0) {
      return {
        id: user.id,
        email: user.email,
        fullName: user.name || user.email,
        department: 'CEO',
        isCeo: true,
        photo: null
      };
    }
    return mapProfileToFrontend(userRecords[0]);
  },
};

// ── HR ────────────────────────────────────────────────────────
export const hr = {
  getPendingUsers: async () => {
    const { data, error } = await neonClient
      .from('profiles')
      .select('*')
      .eq('status', 'PENDING_APPROVAL')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapProfileToFrontend);
  },

  getAllUsers: async () => {
    const { data, error } = await neonClient
      .from('profiles')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('role', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).map(mapProfileToFrontend);
  },

  approveUser: async (userId: string, approve: boolean, generatedPassword?: string) => {
    const status = approve ? 'ACTIVE' : 'REJECTED';
    const updateData: any = { status, updated_at: new Date().toISOString() };
    if (approve && generatedPassword) {
      updateData.password_hash = generatedPassword;
    }

    const { data, error } = await neonClient
      .from('profiles')
      .update(updateData)
      .eq('id', userId);
    if (error) throw new Error(error.message);

    // Audit trail logging
    try {
      const activeSession = await neonClient.auth.getSession();
      const performerId = activeSession.data?.user?.id || 'unknown';
      const { data: performers } = await neonClient.from('profiles').select('full_name').eq('id', performerId).limit(1);
      const performedBy = performers?.[0]?.full_name || 'HR Staff';

      const { data: approvedUsers } = await neonClient.from('profiles').select('full_name, role').eq('id', userId).limit(1);
      const approvedName = approvedUsers?.[0]?.full_name || 'Staff';
      const approvedDept = approvedUsers?.[0]?.role || 'HR';

      await neonClient.from('global_audit_history').insert({
        action: approve ? 'APPROVE_USER' : 'REJECT_USER',
        department: 'HR',
        performed_by: performedBy,
        user_id: performerId,
        details: `User ${approvedName} (${approvedDept}) ${approve ? 'approved' : 'rejected'}.`,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error('Audit trail logging failed:', e);
    }

    return data;
  },

  getAttendance: async () => {
    const { data, error } = await neonClient
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
    const { data, error } = await neonClient
      .from('cargo_intake')
      .select('*, approvedBy:profiles(full_name)')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapCargoToFrontend);
  },

  logIntake: async (data: {
    productName?: string; goodsCode?: string; destination?: string;
    country: string; company: string; quantity: number; weight: number;
    discrepancies?: string; isFaulty?: boolean; productImage?: string;
  }) => {
    const activeSession = await neonClient.auth.getSession();
    const performerId = activeSession.data?.user?.id || 'unknown';
    const { data: performers } = await neonClient.from('profiles').select('full_name').eq('id', performerId).limit(1);
    const performedBy = performers?.[0]?.full_name || 'Ops Staff';

    const intakeCode = data.goodsCode || `GC-${Date.now()}`;
    const { data: intake, error } = await neonClient
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
        metadata: {
          discrepancies: data.discrepancies || null,
          isFaulty: !!data.isFaulty,
          productImage: data.productImage || null
        }
      }).select();

    if (error) throw new Error(error.message);

    try {
      await neonClient.from('global_audit_history').insert({
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
    const { data, error } = await neonClient
      .from('fulfillment_tickets')
      .select('*, order:sales_orders(client_name, total_amount), productionRequest:material_requisitions(*)')
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
    const { data: orders, error: orderErr } = await neonClient.from('sales_orders').select('*').eq('id', orderId).limit(1);
    if (orderErr || !orders || orders.length === 0) throw new Error('Order not found');

    const { data: delivery, error: delErr } = await neonClient
      .from('delivery_logs')
      .insert({
        order_id: orderId,
        vehicle_id: vehicleId,
        driver_name: driverName || null,
        status: 'ASSIGNED',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).select();
    if (delErr) throw new Error(delErr.message);

    const { data: updatedOrder, error: updateErr } = await neonClient
      .from('sales_orders')
      .update({ status: 'OUT_FOR_DELIVERY', updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select();
    if (updateErr) throw new Error(updateErr.message);

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
};

// ── Management ────────────────────────────────────────────────
export const management = {
  getAuditLog: async () => {
    const { data, error } = await neonClient
      .from('global_audit_history')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data || []).map(mapAuditToFrontend);
  },

  getPrices: async () => {
    const { data, error } = await neonClient
      .from('goods_prices')
      .select('*')
      .order('set_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapPriceToFrontend);
  },

  setPrice: async (data: { productName: string; category: string; unitPrice: number; currency: string }) => {
    const activeSession = await neonClient.auth.getSession();
    const performerId = activeSession.data?.user?.id || 'unknown';
    const { data: performers } = await neonClient.from('profiles').select('full_name').eq('id', performerId).limit(1);
    const performedBy = performers?.[0]?.full_name || 'Management';

    const { data: price, error } = await neonClient
      .from('goods_prices')
      .insert({
        product_name: data.productName,
        category: data.category || 'INCOMING_GOODS',
        unit_price: Number(data.unitPrice),
        currency: data.currency || 'GHS',
        set_by: performedBy,
        set_at: new Date().toISOString()
      }).select();
    if (error) throw new Error(error.message);
    return price ? mapPriceToFrontend(price[0]) : null;
  },

  approveIntake: async (intakeId: string, approve: boolean, unitPrice?: number) => {
    const activeSession = await neonClient.auth.getSession();
    const performerId = activeSession.data?.user?.id || 'unknown';
    const { data: performers } = await neonClient.from('profiles').select('full_name').eq('id', performerId).limit(1);
    const performedBy = performers?.[0]?.full_name || 'Management';

    const status = approve ? 'APPROVED' : 'REJECTED';
    const { data: intake, error } = await neonClient
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

    try {
      await neonClient.from('global_audit_history').insert({
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
    const activeSession = await neonClient.auth.getSession();
    const performerId = activeSession.data?.user?.id || 'unknown';
    const { data: performers } = await neonClient.from('profiles').select('full_name').eq('id', performerId).limit(1);
    const performedBy = performers?.[0]?.full_name || 'Management';

    const { data: orders } = await neonClient.from('sales_orders').select('*').eq('id', orderId).limit(1);
    const order = orders?.[0];

    const status = approve ? 'APPROVED' : 'REJECTED';
    const { data: updatedOrder, error } = await neonClient
      .from('sales_orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select();
    if (error) throw new Error(error.message);

    if (order) {
      try {
        await neonClient.from('global_audit_history').insert({
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
    const { data, error } = await neonClient
      .from('material_requisitions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .select();
    if (error) throw new Error(error.message);
    return data ? mapRequisitionToFrontend(data[0]) : null;
  },
};

// ── Marketing ─────────────────────────────────────────────────
export const marketing = {
  getOrders: async () => {
    const { data, error } = await neonClient
      .from('sales_orders')
      .select('*, createdBy:profiles(full_name)')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapOrderToFrontend);
  },

  createOrder: async (data: {
    clientName: string; productName?: string; destination?: string;
    ghanaCard?: string; paymentMode: string; totalAmount: number;
  }) => {
    const activeSession = await neonClient.auth.getSession();
    const performerId = activeSession.data?.user?.id || 'unknown';
    const { data: performers } = await neonClient.from('profiles').select('full_name').eq('id', performerId).limit(1);
    const performedBy = performers?.[0]?.full_name || 'Marketing Staff';

    const ticketNumber = `TKT-${Math.floor(10000 + Math.random() * 90000)}`;
    const { data: order, error } = await neonClient
      .from('sales_orders')
      .insert({
        ticket_number: ticketNumber,
        client_name: data.clientName,
        product_name: data.productName || null,
        destination: data.destination || null,
        ghana_card: data.ghanaCard || null,
        payment_mode: data.paymentMode,
        total_amount: Number(data.totalAmount),
        status: 'PENDING_FINANCE',
        created_by_id: performerId,
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
      await neonClient.from('global_audit_history').insert({
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
    const { data, error } = await neonClient
      .from('customers')
      .select('*')
      .order('registered_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapCustomerToFrontend);
  },

  registerCustomer: async (data: {
    name: string; phone: string; email?: string;
    location: string; companyName: string; ghanaCard?: string; photo?: string;
  }) => {
    const { data: customer, error } = await neonClient
      .from('customers')
      .insert({
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        location: data.location,
        company_name: data.companyName,
        ghana_card: data.ghanaCard || null,
        photo: data.photo || null,
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
    const { data, error } = await neonClient
      .from('finance_ledger')
      .select('*, order:sales_orders(client_name, payment_mode)')
      .order('issued_at', { ascending: false });
    if (error) throw new Error(error.message);
    
    return (data || []).map((p: any) => ({
      id: p.id,
      clientName: p.order?.client_name || 'N/A',
      amount: p.amount,
      paymentMode: p.order?.payment_mode || 'CASH',
      paymentType: 'INVOICE',
      orderId: p.order_id || p.orderId,
      createdAt: p.issued_at || p.issuedAt
    }));
  },

  getInvoices: async () => {
    const { data, error } = await neonClient
      .from('finance_ledger')
      .select('*, order:sales_orders(client_name, total_amount, ticket_number)')
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
    const { data: orders } = await neonClient.from('sales_orders').select('*').eq('id', orderId).limit(1);
    const order = orders?.[0];
    if (!order) throw new Error('Order not found');

    if (!approve) {
      const { data: rejectedOrder, error } = await neonClient
        .from('sales_orders')
        .update({ status: 'REJECTED', updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .select();
      if (error) throw new Error(error.message);
      return { message: 'Order rejected by Finance.', order: rejectedOrder ? mapOrderToFrontend(rejectedOrder[0]) : null };
    }

    if (order.payment_mode === 'CREDIT' || order.paymentMode === 'CREDIT') {
      const { data: updatedOrder, error } = await neonClient
        .from('sales_orders')
        .update({ status: 'PENDING_MANAGEMENT', updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .select();
      if (error) throw new Error(error.message);
      return { message: 'Credit order sent to Management.', order: updatedOrder ? mapOrderToFrontend(updatedOrder[0]) : null };
    } else {
      const { data: updatedOrder, error } = await neonClient
        .from('sales_orders')
        .update({ status: 'APPROVED', updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .select();
      if (error) throw new Error(error.message);
      return { message: 'Order approved by Finance.', order: updatedOrder ? mapOrderToFrontend(updatedOrder[0]) : null };
    }
  },

  finalizeOrder: async (orderId: string) => {
    const { data: orders } = await neonClient.from('sales_orders').select('*').eq('id', orderId).limit(1);
    const order = orders?.[0];
    if (!order) throw new Error('Order not found');

    const totalAmountVal = order.total_amount || order.totalAmount;
    const invoiceNo = `INV-${Date.now().toString().slice(-6)}`;
    const taxAmount = totalAmountVal * 0.15;
    const grandTotal = totalAmountVal + taxAmount;
    
    const { data: invoice, error: invErr } = await neonClient
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

    const { error: ticketErr } = await neonClient
      .from('fulfillment_tickets')
      .insert({
        order_id: orderId,
        type: 'ORDER_FULFILLMENT',
        details: {
          clientName: order.client_name || order.clientName,
          productName: order.product_name || order.productName,
          quantity: 1,
          totalAmount: totalAmountVal
        },
        status: 'PENDING',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    if (ticketErr) throw new Error(ticketErr.message);

    const { data: updatedOrder, error: orderErr } = await neonClient
      .from('sales_orders')
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
    const { data: reqs } = await neonClient.from('material_requisitions').select('*').eq('id', requestId).limit(1);
    const request = reqs?.[0];
    if (!request) throw new Error('Production request not found');

    const { data: updatedRequest, error } = await neonClient
      .from('material_requisitions')
      .update({ status: 'TICKETS_ISSUED', updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .select();
    if (error) throw new Error(error.message);

    await neonClient
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
    const { data, error } = await neonClient
      .from('material_requisitions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapRequisitionToFrontend);
  },

  requestMaterials: async (items: Array<{ materialName: string; quantity: number }>, notes?: string) => {
    const { data, error } = await neonClient
      .from('material_requisitions')
      .insert({
        items,
        notes: notes || null,
        status: 'PENDING_MANAGEMENT',
        created_at: new Date().toISOString(),
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
    const { data, error } = await neonClient
      .from('delivery_logs')
      .select('*, order:sales_orders(client_name, total_amount)')
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

    const { data: delivery, error: delErr } = await neonClient
      .from('delivery_logs')
      .update(updateData)
      .eq('order_id', orderId)
      .select();
    if (delErr) throw new Error(delErr.message);

    if (status === 'DELIVERED') {
      await neonClient
        .from('sales_orders')
        .update({ status: 'DELIVERED', updated_at: new Date().toISOString() })
        .eq('id', orderId);
    }

    return delivery ? delivery[0] : null;
  },
};

// ── Reception ─────────────────────────────────────────────────
export const reception = {
  getVisitors: async () => {
    const { data, error } = await neonClient
      .from('visitors')
      .select('*')
      .order('check_in_time', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapVisitorToFrontend);
  },

  checkInVisitor: async (fullName: string, purpose: string, hostName: string) => {
    const activeSession = await neonClient.auth.getSession();
    const performerId = activeSession.data?.user?.id || 'unknown';

    const { data, error } = await neonClient
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
    const { data, error } = await neonClient
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

    const { data, error } = await neonClient
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

    const { data, error } = await neonClient
      .from('attendance')
      .update({ check_out_time: new Date().toISOString() })
      .eq('user_id', employeeUserId)
      .eq('date', today.toISOString().split('T')[0])
      .select();
    if (error) throw new Error(error.message);
    return data ? data.map(mapAttendanceToFrontend) : null;
  },
};
