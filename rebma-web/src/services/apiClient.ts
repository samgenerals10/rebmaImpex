// rebma-web/src/services/apiClient.ts
// Centralized API client — all fetch calls go through here

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// ── Token helpers ─────────────────────────────────────────────
export const getToken = (): string | null => localStorage.getItem('rebma_token');
export const setToken = (token: string) => localStorage.setItem('rebma_token', token);
export const clearToken = () => localStorage.removeItem('rebma_token');

// ── Core fetch wrapper ─────────────────────────────────────────
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────
export const auth = {
  login: (email: string, password: string) =>
    apiFetch<{ token: string; user: any }>('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password })
    }),

  register: (data: {
    email: string; password: string; fullName: string;
    department: string; ghanaCardId?: string; phone?: string;
  }) =>
    apiFetch<{ message: string; userId: string; status: string }>('/api/auth/register', {
      method: 'POST', body: JSON.stringify(data)
    }),

  verifyCeoOtp: (email: string, otp: string) =>
    apiFetch<{ message: string }>('/api/auth/verify-ceo-otp', {
      method: 'POST', body: JSON.stringify({ email, otp })
    }),

  me: () => apiFetch<any>('/api/auth/me'),
};

// ── HR ────────────────────────────────────────────────────────
export const hr = {
  getPendingUsers: () => apiFetch<any[]>('/api/hr/pending-users'),
  getAllUsers: () => apiFetch<any[]>('/api/hr/users'),
  approveUser: (userId: string, approve: boolean, generatedPassword?: string) =>
    apiFetch<any>('/api/hr/approve-user', {
      method: 'POST', body: JSON.stringify({ userId, approve, generatedPassword })
    }),
  getAttendance: () => apiFetch<any[]>('/api/hr/attendance'),
};

// ── Operations ────────────────────────────────────────────────
export const operations = {
  getIncomingGoods: () => apiFetch<any[]>('/api/operations/incoming-goods'),
  logIntake: (data: {
    productName?: string; goodsCode?: string; destination?: string;
    country: string; company: string; quantity: number; weight: number;
    discrepancies?: string; isFaulty?: boolean; productImage?: string;
  }) =>
    apiFetch<any>('/api/operations/intake', { method: 'POST', body: JSON.stringify(data) }),
  getFulfillmentTickets: () => apiFetch<any[]>('/api/operations/fulfillment-tickets'),
  releaseToDispatch: (orderId: string, vehicleId: string, driverName?: string) =>
    apiFetch<any>('/api/operations/release-to-dispatch', {
      method: 'POST', body: JSON.stringify({ orderId, vehicleId, driverName })
    }),
};

// ── Management ────────────────────────────────────────────────
export const management = {
  getAuditLog: () => apiFetch<any[]>('/api/management/audit-log'),
  getPrices: () => apiFetch<any[]>('/api/management/prices'),
  setPrice: (data: { productName: string; category: string; unitPrice: number; currency: string }) =>
    apiFetch<any>('/api/management/set-price', { method: 'POST', body: JSON.stringify(data) }),
  approveIntake: (intakeId: string, approve: boolean, unitPrice?: number) =>
    apiFetch<any>('/api/management/approve-intake', {
      method: 'POST', body: JSON.stringify({ intakeId, approve, unitPrice })
    }),
  approveCreditOrder: (orderId: string, approve: boolean) =>
    apiFetch<any>('/api/management/approve-credit-order', {
      method: 'POST', body: JSON.stringify({ orderId, approve })
    }),
  approveProductionRequest: (requestId: string, approve: boolean) =>
    apiFetch<any>('/api/management/approve-production-request', {
      method: 'POST', body: JSON.stringify({ requestId, approve })
    }),
};

// ── Marketing ─────────────────────────────────────────────────
export const marketing = {
  getOrders: () => apiFetch<any[]>('/api/marketing/orders'),
  createOrder: (data: {
    clientName: string; productName?: string; destination?: string;
    ghanaCard?: string; paymentMode: string; totalAmount: number;
  }) =>
    apiFetch<any>('/api/marketing/orders', { method: 'POST', body: JSON.stringify(data) }),
  getCustomers: () => apiFetch<any[]>('/api/marketing/customers'),
  registerCustomer: (data: {
    name: string; phone: string; email?: string;
    location: string; companyName: string; ghanaCard?: string; photo?: string;
  }) =>
    apiFetch<any>('/api/marketing/customers', { method: 'POST', body: JSON.stringify(data) }),
};

// ── Finance ───────────────────────────────────────────────────
export const finance = {
  getPayments: () => apiFetch<any[]>('/api/finance/payments'),
  getInvoices: () => apiFetch<any[]>('/api/finance/invoices'),
  evaluateOrder: (orderId: string, approve: boolean) =>
    apiFetch<any>('/api/finance/evaluate-order', {
      method: 'POST', body: JSON.stringify({ orderId, approve })
    }),
  finalizeOrder: (orderId: string) =>
    apiFetch<any>('/api/finance/finalize-order', {
      method: 'POST', body: JSON.stringify({ orderId })
    }),
  releaseProductionMaterials: (requestId: string) =>
    apiFetch<any>('/api/finance/release-production-materials', {
      method: 'POST', body: JSON.stringify({ requestId })
    }),
};

// ── Production ────────────────────────────────────────────────
export const production = {
  getRequests: () => apiFetch<any[]>('/api/production/requests'),
  requestMaterials: (items: Array<{ materialName: string; quantity: number }>, notes?: string) =>
    apiFetch<any>('/api/production/raw-materials', {
      method: 'POST', body: JSON.stringify({ items, notes })
    }),
};

// ── Dispatch ──────────────────────────────────────────────────
export const dispatch = {
  getDeliveries: () => apiFetch<any[]>('/api/dispatch/deliveries'),
  updateDelivery: (orderId: string, status: 'IN_TRANSIT' | 'DELIVERED', coordinates?: { lat: number; lng: number }) =>
    apiFetch<any>('/api/dispatch/deliver-order', {
      method: 'POST', body: JSON.stringify({ orderId, status, coordinates })
    }),
};

// ── Reception ─────────────────────────────────────────────────
export const reception = {
  getVisitors: () => apiFetch<any[]>('/api/reception/visitors'),
  checkInVisitor: (fullName: string, purpose: string, hostName: string) =>
    apiFetch<any>('/api/reception/visitors', {
      method: 'POST', body: JSON.stringify({ fullName, purpose, hostName })
    }),
  checkOutVisitor: (visitorId: string) =>
    apiFetch<any>('/api/reception/visitors/check-out', {
      method: 'POST', body: JSON.stringify({ visitorId })
    }),
  checkInAttendance: (employeeUserId: string) =>
    apiFetch<any>('/api/reception/attendance/check-in', {
      method: 'POST', body: JSON.stringify({ employeeUserId })
    }),
  checkOutAttendance: (employeeUserId: string) =>
    apiFetch<any>('/api/reception/attendance/check-out', {
      method: 'POST', body: JSON.stringify({ employeeUserId })
    }),
};
