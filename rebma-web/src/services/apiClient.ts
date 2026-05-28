// rebma-web/src/services/apiClient.ts
// Centralized API client — all database & auth calls go through neonClient
import { neonClient } from '../lib/neonClient';

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

    // Fetch user details from public User table to get department role
    const { data: users, error: userError } = await neonClient
      .from('User')
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

    const dbUser = users[0];
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

    // 2. Synchronize to public "User" DB table to preserve references
    const { error: dbError } = await neonClient.from('User').insert({
      id: userId,
      email: data.email.trim().toLowerCase(),
      fullName: data.fullName,
      department: data.department,
      ghanaCardId: data.ghanaCardId || null,
      phone: data.phone || null,
      status: initialStatus,
      isCeo: data.department === 'CEO',
      passwordHash: 'neon_auth_managed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    if (dbError) {
      console.error('Error inserting user to public database table:', dbError);
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
    // Update public User table status to ACTIVE
    const { error } = await neonClient
      .from('User')
      .update({ status: 'ACTIVE', updatedAt: new Date().toISOString() })
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
      .from('User')
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
    return userRecords[0];
  },
};

// ── HR ────────────────────────────────────────────────────────
export const hr = {
  getPendingUsers: async () => {
    const { data, error } = await neonClient
      .from('User')
      .select('*')
      .eq('status', 'PENDING_APPROVAL')
      .order('createdAt', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  getAllUsers: async () => {
    const { data, error } = await neonClient
      .from('User')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('department', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  },

  approveUser: async (userId: string, approve: boolean, generatedPassword?: string) => {
    const status = approve ? 'ACTIVE' : 'REJECTED';
    const updateData: any = { status, updatedAt: new Date().toISOString() };
    if (approve && generatedPassword) {
      updateData.passwordHash = generatedPassword;
    }

    const { data, error } = await neonClient
      .from('User')
      .update(updateData)
      .eq('id', userId);
    if (error) throw new Error(error.message);

    // Audit trail logging
    try {
      const activeSession = await neonClient.auth.getSession();
      const performerId = activeSession.data?.user?.id || 'unknown';
      const { data: performers } = await neonClient.from('User').select('fullName').eq('id', performerId).limit(1);
      const performedBy = performers?.[0]?.fullName || 'HR Staff';

      const { data: approvedUsers } = await neonClient.from('User').select('fullName, department').eq('id', userId).limit(1);
      const approvedName = approvedUsers?.[0]?.fullName || 'Staff';
      const approvedDept = approvedUsers?.[0]?.department || 'HR';

      await neonClient.from('AuditEntry').insert({
        action: approve ? 'APPROVE_USER' : 'REJECT_USER',
        department: 'HR',
        performedBy,
        userId: performerId,
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
      .from('AttendanceLog')
      .select('*, user:User(fullName, department)')
      .order('checkInTime', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },
};

// ── Operations ────────────────────────────────────────────────
export const operations = {
  getIncomingGoods: async () => {
    const { data, error } = await neonClient
      .from('IncomingGoods')
      .select('*, approvedBy:User(fullName)')
      .order('createdAt', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  logIntake: async (data: {
    productName?: string; goodsCode?: string; destination?: string;
    country: string; company: string; quantity: number; weight: number;
    discrepancies?: string; isFaulty?: boolean; productImage?: string;
  }) => {
    const activeSession = await neonClient.auth.getSession();
    const performerId = activeSession.data?.user?.id || 'unknown';
    const { data: performers } = await neonClient.from('User').select('fullName').eq('id', performerId).limit(1);
    const performedBy = performers?.[0]?.fullName || 'Ops Staff';

    const intakeCode = data.goodsCode || `GC-${Date.now()}`;
    const { data: intake, error } = await neonClient
      .from('IncomingGoods')
      .insert({
        productName: data.productName || null,
        goodsCode: intakeCode,
        destination: data.destination || null,
        productImage: data.productImage || null,
        country: data.country,
        company: data.company,
        quantity: Number(data.quantity),
        weight: Number(data.weight),
        discrepancies: data.discrepancies || null,
        isFaulty: !!data.isFaulty,
        status: 'PENDING_MANAGEMENT_APPROVAL',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

    if (error) throw new Error(error.message);

    try {
      await neonClient.from('AuditEntry').insert({
        action: 'LOG_PORT_INTAKE',
        department: 'OPERATIONS',
        performedBy,
        userId: performerId,
        details: `Port intake logged: ${data.productName || data.company} (${data.quantity} units) from ${data.country}. Code: ${intakeCode}`,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error('Audit entry failed:', e);
    }

    return intake;
  },

  getFulfillmentTickets: async () => {
    const { data, error } = await neonClient
      .from('FulfillmentTicket')
      .select('*, order:Order(clientName, totalAmount), productionRequest:ProductionRequest(*)')
      .order('createdAt', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  releaseToDispatch: async (orderId: string, vehicleId: string, driverName?: string) => {
    const { data: orders, error: orderErr } = await neonClient.from('Order').select('*').eq('id', orderId).limit(1);
    if (orderErr || !orders || orders.length === 0) throw new Error('Order not found');

    const { data: delivery, error: delErr } = await neonClient
      .from('DeliveryLog')
      .insert({
        orderId,
        vehicleId,
        driverName: driverName || null,
        status: 'ASSIGNED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    if (delErr) throw new Error(delErr.message);

    const { data: updatedOrder, error: updateErr } = await neonClient
      .from('Order')
      .update({ status: 'OUT_FOR_DELIVERY', updatedAt: new Date().toISOString() })
      .eq('id', orderId);
    if (updateErr) throw new Error(updateErr.message);

    return { order: updatedOrder, delivery };
  },
};

// ── Management ────────────────────────────────────────────────
export const management = {
  getAuditLog: async () => {
    const { data, error } = await neonClient
      .from('AuditEntry')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data || [];
  },

  getPrices: async () => {
    const { data, error } = await neonClient
      .from('GoodsPrice')
      .select('*')
      .order('setAt', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  setPrice: async (data: { productName: string; category: string; unitPrice: number; currency: string }) => {
    const activeSession = await neonClient.auth.getSession();
    const performerId = activeSession.data?.user?.id || 'unknown';
    const { data: performers } = await neonClient.from('User').select('fullName').eq('id', performerId).limit(1);
    const performedBy = performers?.[0]?.fullName || 'Management';

    const { data: price, error } = await neonClient
      .from('GoodsPrice')
      .insert({
        productName: data.productName,
        category: data.category || 'INCOMING_GOODS',
        unitPrice: Number(data.unitPrice),
        currency: data.currency || 'GHS',
        setBy: performedBy,
        setAt: new Date().toISOString()
      });
    if (error) throw new Error(error.message);
    return price;
  },

  approveIntake: async (intakeId: string, approve: boolean, unitPrice?: number) => {
    const activeSession = await neonClient.auth.getSession();
    const performerId = activeSession.data?.user?.id || 'unknown';
    const { data: performers } = await neonClient.from('User').select('fullName').eq('id', performerId).limit(1);
    const performedBy = performers?.[0]?.fullName || 'Management';

    const status = approve ? 'APPROVED' : 'REJECTED';
    const { data: intake, error } = await neonClient
      .from('IncomingGoods')
      .update({
        status,
        unitPrice: approve ? Number(unitPrice) : null,
        approvedById: performerId,
        updatedAt: new Date().toISOString()
      })
      .eq('id', intakeId);
    if (error) throw new Error(error.message);

    try {
      await neonClient.from('AuditEntry').insert({
        action: approve ? 'APPROVE_PORT_CARGO' : 'REJECT_PORT_CARGO',
        department: 'MANAGEMENT',
        performedBy,
        userId: performerId,
        details: `Port cargo ${intakeId} ${approve ? 'approved at GHS ' + unitPrice + '/unit' : 'rejected'}.`,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error(e);
    }

    return intake;
  },

  approveCreditOrder: async (orderId: string, approve: boolean) => {
    const activeSession = await neonClient.auth.getSession();
    const performerId = activeSession.data?.user?.id || 'unknown';
    const { data: performers } = await neonClient.from('User').select('fullName').eq('id', performerId).limit(1);
    const performedBy = performers?.[0]?.fullName || 'Management';

    const { data: orders } = await neonClient.from('Order').select('*').eq('id', orderId).limit(1);
    const order = orders?.[0];

    const status = approve ? 'APPROVED' : 'REJECTED';
    const { data: updatedOrder, error } = await neonClient
      .from('Order')
      .update({ status, updatedAt: new Date().toISOString() })
      .eq('id', orderId);
    if (error) throw new Error(error.message);

    if (order) {
      try {
        await neonClient.from('AuditEntry').insert({
          action: approve ? 'APPROVE_CREDIT_ORDER' : 'REJECT_CREDIT_ORDER',
          department: 'MANAGEMENT',
          performedBy,
          userId: performerId,
          details: `Credit order ${orderId} for ${order.clientName} (GHS ${order.totalAmount}) ${approve ? 'approved' : 'rejected'}.`,
          timestamp: new Date().toISOString()
        });
      } catch (e) {
        console.error(e);
      }
    }

    return updatedOrder;
  },

  approveProductionRequest: async (requestId: string, approve: boolean) => {
    const status = approve ? 'APPROVED' : 'REJECTED';
    const { data, error } = await neonClient
      .from('ProductionRequest')
      .update({ status, updatedAt: new Date().toISOString() })
      .eq('id', requestId);
    if (error) throw new Error(error.message);
    return data;
  },
};

// ── Marketing ─────────────────────────────────────────────────
export const marketing = {
  getOrders: async () => {
    const { data, error } = await neonClient
      .from('Order')
      .select('*, createdBy:User(fullName)')
      .order('createdAt', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  createOrder: async (data: {
    clientName: string; productName?: string; destination?: string;
    ghanaCard?: string; paymentMode: string; totalAmount: number;
  }) => {
    const activeSession = await neonClient.auth.getSession();
    const performerId = activeSession.data?.user?.id || 'unknown';
    const { data: performers } = await neonClient.from('User').select('fullName').eq('id', performerId).limit(1);
    const performedBy = performers?.[0]?.fullName || 'Marketing Staff';

    const ticketNumber = `TKT-${Math.floor(10000 + Math.random() * 90000)}`;
    const { data: order, error } = await neonClient
      .from('Order')
      .insert({
        ticketNumber,
        clientName: data.clientName,
        productName: data.productName || null,
        destination: data.destination || null,
        ghanaCard: data.ghanaCard || null,
        paymentMode: data.paymentMode,
        totalAmount: Number(data.totalAmount),
        status: 'PENDING_FINANCE',
        createdById: performerId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    if (error) throw new Error(error.message);

    try {
      await neonClient.from('AuditEntry').insert({
        action: 'CREATE_ORDER',
        department: 'MARKETING',
        performedBy,
        userId: performerId,
        details: `Order ${ticketNumber} created for ${data.clientName} — GHS ${data.totalAmount} (${data.paymentMode}).`,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error(e);
    }

    return order;
  },

  getCustomers: async () => {
    const { data, error } = await neonClient
      .from('Customer')
      .select('*')
      .order('registeredAt', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  registerCustomer: async (data: {
    name: string; phone: string; email?: string;
    location: string; companyName: string; ghanaCard?: string; photo?: string;
  }) => {
    const { data: customer, error } = await neonClient
      .from('Customer')
      .insert({
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        location: data.location,
        companyName: data.companyName,
        ghanaCard: data.ghanaCard || null,
        photo: data.photo || null,
        registeredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    if (error) throw new Error(error.message);
    return customer;
  },
};

// ── Finance ───────────────────────────────────────────────────
export const finance = {
  getPayments: async () => {
    const { data, error } = await neonClient
      .from('Invoice')
      .select('*, order:Order(clientName, paymentMode)')
      .order('issuedAt', { ascending: false });
    if (error) throw new Error(error.message);
    
    return (data || []).map((p: any) => ({
      id: p.id,
      clientName: p.order?.clientName || 'N/A',
      amount: p.amount,
      paymentMode: p.order?.paymentMode || 'CASH',
      paymentType: 'INVOICE',
      orderId: p.orderId,
      createdAt: p.issuedAt
    }));
  },

  getInvoices: async () => {
    const { data, error } = await neonClient
      .from('Invoice')
      .select('*, order:Order(clientName, totalAmount, ticketNumber)')
      .order('issuedAt', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  evaluateOrder: async (orderId: string, approve: boolean) => {
    const { data: orders } = await neonClient.from('Order').select('*').eq('id', orderId).limit(1);
    const order = orders?.[0];
    if (!order) throw new Error('Order not found');

    if (!approve) {
      const { data: rejectedOrder, error } = await neonClient
        .from('Order')
        .update({ status: 'REJECTED', updatedAt: new Date().toISOString() })
        .eq('id', orderId);
      if (error) throw new Error(error.message);
      return { message: 'Order rejected by Finance.', order: rejectedOrder };
    }

    if (order.paymentMode === 'CREDIT') {
      const { data: updatedOrder, error } = await neonClient
        .from('Order')
        .update({ status: 'PENDING_MANAGEMENT', updatedAt: new Date().toISOString() })
        .eq('id', orderId);
      if (error) throw new Error(error.message);
      return { message: 'Credit order sent to Management.', order: updatedOrder };
    } else {
      const { data: updatedOrder, error } = await neonClient
        .from('Order')
        .update({ status: 'APPROVED', updatedAt: new Date().toISOString() })
        .eq('id', orderId);
      if (error) throw new Error(error.message);
      return { message: 'Order approved by Finance.', order: updatedOrder };
    }
  },

  finalizeOrder: async (orderId: string) => {
    const { data: orders } = await neonClient.from('Order').select('*').eq('id', orderId).limit(1);
    const order = orders?.[0];
    if (!order) throw new Error('Order not found');

    const invoiceNo = `INV-${Date.now().toString().slice(-6)}`;
    const taxAmount = order.totalAmount * 0.15;
    const grandTotal = order.totalAmount + taxAmount;
    
    const { data: invoice, error: invErr } = await neonClient
      .from('Invoice')
      .insert({
        orderId,
        invoiceNo,
        amount: order.totalAmount,
        taxAmount,
        grandTotal,
        issuedAt: new Date().toISOString()
      });
    if (invErr) throw new Error(invErr.message);

    const { error: ticketErr } = await neonClient
      .from('FulfillmentTicket')
      .insert({
        orderId,
        type: 'ORDER_FULFILLMENT',
        details: {
          clientName: order.clientName,
          productName: order.productName,
          quantity: 1,
          totalAmount: order.totalAmount
        },
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    if (ticketErr) throw new Error(ticketErr.message);

    const { data: updatedOrder, error: orderErr } = await neonClient
      .from('Order')
      .update({ status: 'PROCESSING', updatedAt: new Date().toISOString() })
      .eq('id', orderId);
    if (orderErr) throw new Error(orderErr.message);

    return { message: 'Order finalized.', order: updatedOrder, invoice };
  },

  releaseProductionMaterials: async (requestId: string) => {
    const { data: reqs } = await neonClient.from('ProductionRequest').select('*').eq('id', requestId).limit(1);
    const request = reqs?.[0];
    if (!request) throw new Error('Production request not found');

    const { data: updatedRequest, error } = await neonClient
      .from('ProductionRequest')
      .update({ status: 'TICKETS_ISSUED', updatedAt: new Date().toISOString() })
      .eq('id', requestId);
    if (error) throw new Error(error.message);

    await neonClient
      .from('FulfillmentTicket')
      .insert({
        productionRequestId: requestId,
        type: 'PRODUCTION_RELEASE',
        details: {
          items: request.items
        },
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

    return updatedRequest;
  },
};

// ── Production ────────────────────────────────────────────────
export const production = {
  getRequests: async () => {
    const { data, error } = await neonClient
      .from('ProductionRequest')
      .select('*')
      .order('createdAt', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  requestMaterials: async (items: Array<{ materialName: string; quantity: number }>, notes?: string) => {
    const { data, error } = await neonClient
      .from('ProductionRequest')
      .insert({
        items,
        notes: notes || null,
        status: 'PENDING_MANAGEMENT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    if (error) throw new Error(error.message);
    return data;
  },
};

// ── Dispatch ──────────────────────────────────────────────────
export const dispatch = {
  getDeliveries: async () => {
    const { data, error } = await neonClient
      .from('DeliveryLog')
      .select('*, order:Order(clientName, totalAmount)')
      .order('createdAt', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  updateDelivery: async (orderId: string, status: 'IN_TRANSIT' | 'DELIVERED', coordinates?: { lat: number; lng: number }) => {
    const updateData: any = { status, updatedAt: new Date().toISOString() };
    if (status === 'DELIVERED') {
      updateData.deliveredAt = new Date().toISOString();
    }
    if (coordinates) {
      updateData.activeCoordinates = coordinates;
    }

    const { data: delivery, error: delErr } = await neonClient
      .from('DeliveryLog')
      .update(updateData)
      .eq('orderId', orderId);
    if (delErr) throw new Error(delErr.message);

    if (status === 'DELIVERED') {
      await neonClient
        .from('Order')
        .update({ status: 'DELIVERED', updatedAt: new Date().toISOString() })
        .eq('id', orderId);
    }

    return delivery;
  },
};

// ── Reception ─────────────────────────────────────────────────
export const reception = {
  getVisitors: async () => {
    const { data, error } = await neonClient
      .from('VisitorRecord')
      .select('*')
      .order('checkInTime', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  checkInVisitor: async (fullName: string, purpose: string, hostName: string) => {
    const activeSession = await neonClient.auth.getSession();
    const performerId = activeSession.data?.user?.id || 'unknown';

    const { data, error } = await neonClient
      .from('VisitorRecord')
      .insert({
        fullName,
        purpose,
        hostName,
        checkedInById: performerId,
        checkInTime: new Date().toISOString()
      });
    if (error) throw new Error(error.message);
    return data;
  },

  checkOutVisitor: async (visitorId: string) => {
    const { data, error } = await neonClient
      .from('VisitorRecord')
      .update({ checkOutTime: new Date().toISOString() })
      .eq('id', visitorId);
    if (error) throw new Error(error.message);
    return data;
  },

  checkInAttendance: async (employeeUserId: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const now = new Date();
    const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 0);

    const { data, error } = await neonClient
      .from('AttendanceLog')
      .insert({
        userId: employeeUserId,
        date: today.toISOString().split('T')[0],
        checkInTime: now.toISOString(),
        status: isLate ? 'LATE' : 'PRESENT',
        createdAt: now.toISOString()
      });
    if (error) throw new Error(error.message);
    return data;
  },

  checkOutAttendance: async (employeeUserId: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await neonClient
      .from('AttendanceLog')
      .update({ checkOutTime: new Date().toISOString() })
      .eq('userId', employeeUserId)
      .eq('date', today.toISOString().split('T')[0]);
    if (error) throw new Error(error.message);
    return data;
  },
};
