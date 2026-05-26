// src/server.ts

import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {
  PrismaClient,
  Department,
  UserStatus,
  GoodsStatus,
  OrderStatus,
  PaymentMode,
  ProductionStatus,
  DeliveryStatus
} from '@prisma/client';
import {
  authenticateToken,
  authorizeDepartments,
  validateCeoRegistration,
  isWhitelistedCeo,
  AuthenticatedRequest
} from './middleware/rbac';

const app = express();
const server = http.createServer(app);

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.FRONTEND_URL || 'https://rebma-impex.vercel.app',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

const io = new SocketIOServer(server, {
  cors: { origin: ALLOWED_ORIGINS, credentials: true }
});

const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';
const BCRYPT_ROUNDS = 12;

app.use(express.json({ limit: '10mb' })); // 10mb for base64 image uploads

// ==========================================
// UTILITIES
// ==========================================

function broadcastGlobalAlert(message: string) {
  io.emit('global_alert', { message, timestamp: new Date() });
}

function generateTicketNumber(): string {
  return `TKT-${Math.floor(10000 + Math.random() * 90000)}`;
}

// ==========================================
// SOCKET.IO REAL-TIME
// ==========================================

io.on('connection', (socket) => {
  console.log(`[Socket.io] Connected: ${socket.id}`);

  socket.on('join_department', (department: string) => {
    socket.join(`dept-${department.toLowerCase()}`);
  });

  socket.on('send_direct_message', ({ recipientId, content, senderId }) => {
    io.to(recipientId).emit('receive_direct_message', { senderId, content });
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Disconnected: ${socket.id}`);
  });
});

// ==========================================
// HEALTH CHECK
// ==========================================

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================

// POST /api/auth/register
app.post('/api/auth/register', validateCeoRegistration, async (req, res) => {
  try {
    const { email, password, fullName, ghanaCardId, department, phone } = req.body;

    if (!email || !password || !fullName || !department) {
      res.status(400).json({ error: 'Missing required fields.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    let initialStatus: UserStatus = UserStatus.PENDING_APPROVAL;
    let smsOtp: string | null = null;
    let smsOtpExpiresAt: Date | null = null;
    let isCeo = false;

    if (department === Department.CEO) {
      if (isWhitelistedCeo(email)) {
        isCeo = true;
        initialStatus = UserStatus.OTP_VERIFICATION;
        smsOtp = Math.floor(100000 + Math.random() * 900000).toString();
        smsOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
        console.log(`[SMS GATEWAY] OTP for CEO ${email}: ${smsOtp}`);
      } else {
        res.status(403).json({ error: 'CEO registration is restricted to whitelisted emails.' });
        return;
      }
    }

    const newUser = await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        passwordHash,
        fullName,
        phone: phone || null,
        ghanaCardId: department === Department.CEO ? null : ghanaCardId,
        department: department as Department,
        status: initialStatus,
        smsOtp,
        smsOtpExpiresAt,
        isCeo,
      },
    });

    // Notify HR of new pending registration
    io.to('dept-hr').emit('new_registration_pending', {
      userId: newUser.id,
      fullName: newUser.fullName,
      department: newUser.department,
    });

    res.status(201).json({
      message: department === Department.CEO
        ? 'CEO registered. Verify SMS OTP to activate.'
        : 'Registration submitted. Awaiting HR approval.',
      userId: newUser.id,
      status: newUser.status,
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'An account with this email already exists.' });
      return;
    }
    res.status(500).json({ error: 'Registration failed.', details: error.message });
  }
});

// POST /api/auth/verify-ceo-otp
app.post('/api/auth/verify-ceo-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) { res.status(400).json({ error: 'Email and OTP are required.' }); return; }

  try {
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || user.department !== Department.CEO) { res.status(404).json({ error: 'CEO account not found.' }); return; }
    if (user.status !== UserStatus.OTP_VERIFICATION || !user.smsOtp) { res.status(400).json({ error: 'Account is not pending OTP verification.' }); return; }
    if (user.smsOtpExpiresAt && new Date() > user.smsOtpExpiresAt) { res.status(400).json({ error: 'OTP expired. Request a new one.' }); return; }
    if (user.smsOtp !== otp) { res.status(400).json({ error: 'Incorrect OTP code.' }); return; }

    await prisma.user.update({
      where: { id: user.id },
      data: { status: UserStatus.ACTIVE, smsOtp: null, smsOtpExpiresAt: null }
    });

    res.json({ message: 'CEO verified. You may now log in.' });
  } catch (error: any) {
    res.status(500).json({ error: 'OTP verification failed.', details: error.message });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400).json({ error: 'Email and password required.' }); return; }

  try {
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });

    if (!user) { res.status(401).json({ error: 'Invalid credentials.' }); return; }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) { res.status(401).json({ error: 'Invalid credentials.' }); return; }

    if (user.status !== UserStatus.ACTIVE) {
      res.status(403).json({
        error: 'Account not active.',
        status: user.status,
        message: user.status === UserStatus.PENDING_APPROVAL
          ? 'Your account is pending HR approval.'
          : 'Your account requires verification.',
      });
      return;
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '8h' });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        department: user.department,
        isCeo: user.isCeo,
        photo: user.photo,
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Login failed.', details: error.message });
  }
});

// GET /api/auth/me — fetch current user profile
app.get('/api/auth/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, fullName: true, department: true, isCeo: true, photo: true, phone: true, status: true, createdAt: true }
    });
    if (!user) { res.status(404).json({ error: 'User not found.' }); return; }
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch profile.', details: error.message });
  }
});

// ==========================================
// 2. HR ROUTES
// ==========================================

// GET /api/hr/pending-users — pending registrations queue
app.get('/api/hr/pending-users',
  authenticateToken,
  authorizeDepartments([Department.HR, Department.CEO]),
  async (_req, res) => {
    try {
      const users = await prisma.user.findMany({
        where: { status: UserStatus.PENDING_APPROVAL },
        select: { id: true, email: true, fullName: true, department: true, ghanaCardId: true, createdAt: true },
        orderBy: { createdAt: 'desc' }
      });
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch pending users.', details: error.message });
    }
  }
);

// GET /api/hr/users — all staff members
app.get('/api/hr/users',
  authenticateToken,
  authorizeDepartments([Department.HR, Department.CEO, Department.MANAGEMENT]),
  async (_req, res) => {
    try {
      const users = await prisma.user.findMany({
        where: { status: UserStatus.ACTIVE },
        select: { id: true, email: true, fullName: true, department: true, isCeo: true, photo: true, phone: true, createdAt: true },
        orderBy: { department: 'asc' }
      });
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch staff.', details: error.message });
    }
  }
);

// POST /api/hr/approve-user
app.post('/api/hr/approve-user',
  authenticateToken,
  authorizeDepartments([Department.HR]),
  async (req: AuthenticatedRequest, res) => {
    const { userId, approve, generatedPassword } = req.body;
    try {
      let updateData: any = { status: approve ? UserStatus.ACTIVE : UserStatus.REJECTED };
      if (approve && generatedPassword) {
        updateData.passwordHash = await bcrypt.hash(generatedPassword, BCRYPT_ROUNDS);
      }
      const updatedUser = await prisma.user.update({ where: { id: userId }, data: updateData });

      if (approve) {
        io.emit('user_approved', { userId, department: updatedUser.department, fullName: updatedUser.fullName });
      }

      // Log audit entry
      await prisma.auditEntry.create({
        data: {
          action: approve ? 'APPROVE_USER' : 'REJECT_USER',
          department: 'HR',
          performedBy: req.user!.id,
          userId: req.user!.id,
          details: `User ${updatedUser.fullName} (${updatedUser.department}) ${approve ? 'approved' : 'rejected'}.`,
        }
      });

      res.json({ message: `User ${approve ? 'approved' : 'rejected'}.`, user: updatedUser });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to update user status.', details: error.message });
    }
  }
);

// GET /api/hr/attendance — today's attendance
app.get('/api/hr/attendance',
  authenticateToken,
  authorizeDepartments([Department.HR, Department.CEO, Department.MANAGEMENT]),
  async (_req, res) => {
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const logs = await prisma.attendanceLog.findMany({
        where: { date: today },
        include: { user: { select: { fullName: true, department: true } } },
        orderBy: { checkInTime: 'desc' }
      });
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch attendance.', details: error.message });
    }
  }
);

// ==========================================
// 3. OPERATIONS ROUTES
// ==========================================

// GET /api/operations/incoming-goods
app.get('/api/operations/incoming-goods',
  authenticateToken,
  authorizeDepartments([Department.OPERATIONS, Department.MANAGEMENT, Department.CEO, Department.FINANCE]),
  async (_req, res) => {
    try {
      const goods = await prisma.incomingGoods.findMany({
        include: { approvedBy: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' }
      });
      res.json(goods);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch incoming goods.', details: error.message });
    }
  }
);

// POST /api/operations/intake
app.post('/api/operations/intake',
  authenticateToken,
  authorizeDepartments([Department.OPERATIONS]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { productName, goodsCode, destination, country, company, quantity, weight, discrepancies, isFaulty, productImage } = req.body;
      if (!country || !company || !quantity || !weight) {
        res.status(400).json({ error: 'Missing required fields: country, company, quantity, weight.' });
        return;
      }

      const intake = await prisma.incomingGoods.create({
        data: {
          productName: productName || null,
          goodsCode: goodsCode || `GC-${Date.now()}`,
          destination: destination || null,
          productImage: productImage || null,
          country,
          company,
          quantity: parseInt(quantity),
          weight: parseFloat(weight),
          discrepancies: discrepancies || null,
          isFaulty: !!isFaulty,
          status: GoodsStatus.PENDING_MANAGEMENT_APPROVAL,
        }
      });

      // Audit log
      await prisma.auditEntry.create({
        data: {
          action: 'LOG_PORT_INTAKE',
          department: 'OPERATIONS',
          performedBy: req.user!.id,
          userId: req.user!.id,
          details: `Port intake logged: ${productName || company} (${quantity} units) from ${country}. Code: ${intake.goodsCode}`,
        }
      });

      io.to('dept-management').emit('intake_logged', { intakeId: intake.id, company, quantity, productName });

      res.status(201).json({ message: 'Port intake logged. Sent to Management for approval.', intake });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to record port intake.', details: error.message });
    }
  }
);

// GET /api/operations/fulfillment-tickets
app.get('/api/operations/fulfillment-tickets',
  authenticateToken,
  authorizeDepartments([Department.OPERATIONS, Department.MANAGEMENT, Department.CEO]),
  async (_req, res) => {
    try {
      const tickets = await prisma.fulfillmentTicket.findMany({
        include: {
          order: { select: { clientName: true, totalAmount: true } },
          productionRequest: true,
        },
        orderBy: { createdAt: 'desc' }
      });
      res.json(tickets);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch fulfillment tickets.', details: error.message });
    }
  }
);

// POST /api/operations/release-to-dispatch
app.post('/api/operations/release-to-dispatch',
  authenticateToken,
  authorizeDepartments([Department.OPERATIONS]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { orderId, vehicleId, driverName } = req.body;
      if (!orderId || !vehicleId) { res.status(400).json({ error: 'Missing orderId or vehicleId.' }); return; }

      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order || order.status !== OrderStatus.PROCESSING) {
        res.status(400).json({ error: 'Order must be in PROCESSING status.' });
        return;
      }

      const delivery = await prisma.deliveryLog.create({
        data: { orderId, vehicleId, driverName: driverName || null, status: DeliveryStatus.ASSIGNED }
      });

      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.OUT_FOR_DELIVERY }
      });

      io.to('dept-dispatch').emit('new_delivery_assigned', { orderId, vehicleId, driverName });

      res.json({ message: 'Released to dispatch.', order: updatedOrder, delivery });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to release to dispatch.', details: error.message });
    }
  }
);

// ==========================================
// 4. MANAGEMENT ROUTES
// ==========================================

// GET /api/management/audit-log
app.get('/api/management/audit-log',
  authenticateToken,
  authorizeDepartments([Department.MANAGEMENT, Department.CEO]),
  async (_req, res) => {
    try {
      const entries = await prisma.auditEntry.findMany({
        orderBy: { timestamp: 'desc' },
        take: 200,
      });
      res.json(entries);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch audit log.', details: error.message });
    }
  }
);

// GET /api/management/prices
app.get('/api/management/prices',
  authenticateToken,
  async (_req, res) => {
    try {
      const prices = await prisma.goodsPrice.findMany({ orderBy: { setAt: 'desc' } });
      res.json(prices);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch price catalog.', details: error.message });
    }
  }
);

// POST /api/management/set-price
app.post('/api/management/set-price',
  authenticateToken,
  authorizeDepartments([Department.MANAGEMENT, Department.CEO]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { productName, category, unitPrice, currency } = req.body;
      if (!productName || !unitPrice) { res.status(400).json({ error: 'productName and unitPrice are required.' }); return; }

      const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { fullName: true } });

      const price = await prisma.goodsPrice.create({
        data: {
          productName,
          category: category || 'INCOMING_GOODS',
          unitPrice: parseFloat(unitPrice),
          currency: currency || 'GHS',
          setBy: user?.fullName || 'Management',
        }
      });

      io.to('dept-finance').emit('price_catalog_updated', { price });
      io.to('dept-marketing').emit('price_catalog_updated', { price });

      res.status(201).json({ message: 'Price set successfully.', price });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to set price.', details: error.message });
    }
  }
);

// POST /api/management/approve-intake
app.post('/api/management/approve-intake',
  authenticateToken,
  authorizeDepartments([Department.MANAGEMENT]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { intakeId, approve, unitPrice } = req.body;
      if (!intakeId) { res.status(400).json({ error: 'Missing intakeId.' }); return; }
      if (approve && (typeof unitPrice !== 'number' || unitPrice <= 0)) {
        res.status(400).json({ error: 'A valid unit price is required to approve.' }); return;
      }

      const status = approve ? GoodsStatus.APPROVED : GoodsStatus.REJECTED;
      const intake = await prisma.incomingGoods.update({
        where: { id: intakeId },
        data: { status, unitPrice: approve ? unitPrice : null, approvedById: req.user!.id }
      });

      // Audit
      await prisma.auditEntry.create({
        data: {
          action: approve ? 'APPROVE_PORT_CARGO' : 'REJECT_PORT_CARGO',
          department: 'MANAGEMENT',
          performedBy: req.user!.id,
          userId: req.user!.id,
          details: `Port cargo ${intakeId} ${approve ? 'approved at GHS ' + unitPrice + '/unit' : 'rejected'}.`,
        }
      });

      io.to('dept-operations').emit(approve ? 'intake_approved' : 'intake_rejected', { intakeId, message: approve ? 'Cargo approved.' : 'Cargo rejected.' });
      if (approve) {
        io.to('dept-finance').emit('price_catalog_updated', { intakeId, unitPrice });
        io.to('dept-marketing').emit('price_catalog_updated', { intakeId, unitPrice });
      }

      res.json({ message: `Cargo ${status}.`, intake });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to process cargo approval.', details: error.message });
    }
  }
);

// POST /api/management/approve-credit-order
app.post('/api/management/approve-credit-order',
  authenticateToken,
  authorizeDepartments([Department.MANAGEMENT]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { orderId, approve } = req.body;
      if (!orderId) { res.status(400).json({ error: 'Missing orderId.' }); return; }

      const status = approve ? OrderStatus.APPROVED : OrderStatus.REJECTED;
      const order = await prisma.order.update({ where: { id: orderId }, data: { status } });

      await prisma.auditEntry.create({
        data: {
          action: approve ? 'APPROVE_CREDIT_ORDER' : 'REJECT_CREDIT_ORDER',
          department: 'MANAGEMENT',
          performedBy: req.user!.id,
          userId: req.user!.id,
          details: `Credit order ${orderId} for ${order.clientName} (GHS ${order.totalAmount}) ${approve ? 'approved' : 'rejected'}.`,
        }
      });

      res.json({ message: `Credit order ${status}.`, order });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to process credit approval.', details: error.message });
    }
  }
);

// POST /api/management/approve-production-request
app.post('/api/management/approve-production-request',
  authenticateToken,
  authorizeDepartments([Department.MANAGEMENT]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { requestId, approve } = req.body;
      if (!requestId) { res.status(400).json({ error: 'Missing requestId.' }); return; }

      const status = approve ? ProductionStatus.APPROVED : ProductionStatus.REJECTED;
      const request = await prisma.productionRequest.update({ where: { id: requestId }, data: { status } });

      if (approve) io.to('dept-finance').emit('production_request_authorized', { requestId });

      res.json({ message: `Production request ${status}.`, request });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to process production approval.', details: error.message });
    }
  }
);

// ==========================================
// 5. MARKETING ROUTES
// ==========================================

// GET /api/marketing/orders
app.get('/api/marketing/orders',
  authenticateToken,
  authorizeDepartments([Department.MARKETING, Department.FINANCE, Department.MANAGEMENT, Department.CEO, Department.OPERATIONS, Department.DISPATCH]),
  async (_req, res) => {
    try {
      const orders = await prisma.order.findMany({
        include: { createdBy: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' }
      });
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch orders.', details: error.message });
    }
  }
);

// GET /api/marketing/customers
app.get('/api/marketing/customers',
  authenticateToken,
  authorizeDepartments([Department.MARKETING, Department.FINANCE, Department.MANAGEMENT, Department.CEO]),
  async (_req, res) => {
    try {
      const customers = await prisma.customer.findMany({ orderBy: { registeredAt: 'desc' } });
      res.json(customers);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch customers.', details: error.message });
    }
  }
);

// POST /api/marketing/customers
app.post('/api/marketing/customers',
  authenticateToken,
  authorizeDepartments([Department.MARKETING]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { name, phone, email, location, companyName, ghanaCard, photo } = req.body;
      if (!name || !phone || !location || !companyName) {
        res.status(400).json({ error: 'name, phone, location, companyName are required.' }); return;
      }

      const customer = await prisma.customer.create({
        data: { name, phone, email: email || null, location, companyName, ghanaCard: ghanaCard || null, photo: photo || null }
      });

      res.status(201).json({ message: 'Customer registered.', customer });
    } catch (error: any) {
      if (error.code === 'P2002') {
        res.status(400).json({ error: 'A customer with this Ghana Card already exists.' }); return;
      }
      res.status(500).json({ error: 'Failed to register customer.', details: error.message });
    }
  }
);

// POST /api/marketing/orders
app.post('/api/marketing/orders',
  authenticateToken,
  authorizeDepartments([Department.MARKETING]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { clientName, productName, destination, ghanaCard, paymentMode, totalAmount } = req.body;
      if (!clientName || !paymentMode || typeof totalAmount !== 'number') {
        res.status(400).json({ error: 'clientName, paymentMode, and totalAmount are required.' }); return;
      }

      const ticketNumber = generateTicketNumber();

      const order = await prisma.order.create({
        data: {
          ticketNumber,
          clientName,
          productName: productName || null,
          destination: destination || null,
          ghanaCard: ghanaCard || null,
          paymentMode: paymentMode as PaymentMode,
          totalAmount,
          status: OrderStatus.PENDING_FINANCE,
          createdById: req.user!.id
        }
      });

      await prisma.auditEntry.create({
        data: {
          action: 'CREATE_ORDER',
          department: 'MARKETING',
          performedBy: req.user!.id,
          userId: req.user!.id,
          details: `Order ${ticketNumber} created for ${clientName} — GHS ${totalAmount} (${paymentMode}).`,
        }
      });

      io.to('dept-finance').emit('order_submitted', { orderId: order.id, clientName, totalAmount, paymentMode });

      res.status(201).json({ message: 'Order submitted. Pending Finance review.', order });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to create order.', details: error.message });
    }
  }
);

// ==========================================
// 6. FINANCE ROUTES
// ==========================================

// GET /api/finance/payments
app.get('/api/finance/payments',
  authenticateToken,
  authorizeDepartments([Department.FINANCE, Department.MANAGEMENT, Department.CEO]),
  async (_req, res) => {
    try {
      const payments = await prisma.invoice.findMany({
        include: { order: { select: { clientName: true, paymentMode: true } } },
        orderBy: { issuedAt: 'desc' }
      });
      res.json(payments);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch payments.', details: error.message });
    }
  }
);

// GET /api/finance/invoices
app.get('/api/finance/invoices',
  authenticateToken,
  authorizeDepartments([Department.FINANCE, Department.MANAGEMENT, Department.CEO, Department.MARKETING]),
  async (_req, res) => {
    try {
      const invoices = await prisma.invoice.findMany({
        include: { order: { select: { clientName: true, totalAmount: true, ticketNumber: true } } },
        orderBy: { issuedAt: 'desc' }
      });
      res.json(invoices);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch invoices.', details: error.message });
    }
  }
);

// POST /api/finance/evaluate-order
app.post('/api/finance/evaluate-order',
  authenticateToken,
  authorizeDepartments([Department.FINANCE]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { orderId, approve } = req.body;
      if (!orderId) { res.status(400).json({ error: 'Missing orderId.' }); return; }

      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order) { res.status(404).json({ error: 'Order not found.' }); return; }

      if (!approve) {
        const rejectedOrder = await prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.REJECTED } });
        res.json({ message: 'Order rejected by Finance.', order: rejectedOrder });
        return;
      }

      if (order.paymentMode === PaymentMode.CREDIT) {
        const updatedOrder = await prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.PENDING_MANAGEMENT } });
        io.to('dept-management').emit('credit_approval_required', { orderId: order.id, clientName: order.clientName, totalAmount: order.totalAmount });
        res.json({ message: 'Credit order sent to Management.', order: updatedOrder });
      } else {
        const updatedOrder = await prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.APPROVED } });
        res.json({ message: 'Order approved by Finance.', order: updatedOrder });
      }
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to evaluate order.', details: error.message });
    }
  }
);

// POST /api/finance/finalize-order
app.post('/api/finance/finalize-order',
  authenticateToken,
  authorizeDepartments([Department.FINANCE]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { orderId } = req.body;
      if (!orderId) { res.status(400).json({ error: 'Missing orderId.' }); return; }

      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order || order.status !== OrderStatus.APPROVED) {
        res.status(400).json({ error: 'Order must be APPROVED to finalize.' }); return;
      }

      const invoiceNo = `INV-${Date.now()}`;
      const taxAmount = order.totalAmount * 0.15;
      const grandTotal = order.totalAmount + taxAmount;

      const invoice = await prisma.invoice.create({
        data: { orderId, invoiceNo, amount: order.totalAmount, taxAmount, grandTotal, pdfUrl: `/invoices/${invoiceNo}.pdf` }
      });

      const ticket = await prisma.fulfillmentTicket.create({
        data: { orderId, type: 'ORDER_FULFILLMENT', details: { clientName: order.clientName, totalAmount: order.totalAmount }, status: 'PENDING' }
      });

      const updatedOrder = await prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.PROCESSING } });

      io.to('dept-marketing').emit('invoice_generated', { orderId, invoiceId: invoice.id, invoiceNo });
      io.to('dept-operations').emit('fulfillment_ticket_issued', { orderId, ticketId: ticket.id });

      res.json({ message: 'Order finalized. Invoice and fulfillment ticket issued.', order: updatedOrder, invoice, ticket });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to finalize order.', details: error.message });
    }
  }
);

// POST /api/finance/release-production-materials
app.post('/api/finance/release-production-materials',
  authenticateToken,
  authorizeDepartments([Department.FINANCE]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { requestId } = req.body;
      if (!requestId) { res.status(400).json({ error: 'Missing requestId.' }); return; }

      const request = await prisma.productionRequest.findUnique({ where: { id: requestId } });
      if (!request || request.status !== ProductionStatus.APPROVED) {
        res.status(400).json({ error: 'Production request must be APPROVED.' }); return;
      }

      const ticket = await prisma.fulfillmentTicket.create({
        data: { productionRequestId: requestId, type: 'PRODUCTION_RELEASE', details: { items: request.items }, status: 'PENDING' }
      });

      const updatedRequest = await prisma.productionRequest.update({ where: { id: requestId }, data: { status: ProductionStatus.TICKETS_ISSUED } });

      io.to('dept-operations').emit('production_release_ticket', { ticketId: ticket.id, details: ticket.details });
      io.to('dept-production').emit('materials_ready_for_pickup', { requestId, ticketId: ticket.id });

      res.json({ message: 'Production release ticket issued.', request: updatedRequest, ticket });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to release materials.', details: error.message });
    }
  }
);

// ==========================================
// 7. PRODUCTION ROUTES
// ==========================================

// GET /api/production/requests
app.get('/api/production/requests',
  authenticateToken,
  authorizeDepartments([Department.PRODUCTION, Department.MANAGEMENT, Department.FINANCE, Department.CEO]),
  async (_req, res) => {
    try {
      const requests = await prisma.productionRequest.findMany({
        include: { tickets: true },
        orderBy: { createdAt: 'desc' }
      });
      res.json(requests);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch production requests.', details: error.message });
    }
  }
);

// POST /api/production/raw-materials
app.post('/api/production/raw-materials',
  authenticateToken,
  authorizeDepartments([Department.PRODUCTION]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { items, notes } = req.body;
      if (!items || !Array.isArray(items)) { res.status(400).json({ error: 'items array is required.' }); return; }

      const request = await prisma.productionRequest.create({
        data: { items, notes: notes || null, status: ProductionStatus.PENDING_MANAGEMENT }
      });

      io.to('dept-management').emit('production_request_approval_needed', { requestId: request.id });
      io.to('dept-finance').emit('production_request_on_hold', { requestId: request.id });

      res.status(201).json({ message: 'Production request submitted to Management.', request });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to submit production request.', details: error.message });
    }
  }
);

// ==========================================
// 8. DISPATCH ROUTES
// ==========================================

// GET /api/dispatch/deliveries
app.get('/api/dispatch/deliveries',
  authenticateToken,
  authorizeDepartments([Department.DISPATCH, Department.OPERATIONS, Department.MANAGEMENT, Department.CEO]),
  async (_req, res) => {
    try {
      const deliveries = await prisma.deliveryLog.findMany({
        include: { order: { select: { clientName: true, totalAmount: true, destination: true, ticketNumber: true } } },
        orderBy: { createdAt: 'desc' }
      });
      res.json(deliveries);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch deliveries.', details: error.message });
    }
  }
);

// POST /api/dispatch/deliver-order
app.post('/api/dispatch/deliver-order',
  authenticateToken,
  authorizeDepartments([Department.DISPATCH]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { orderId, coordinates, status } = req.body;
      if (!orderId) { res.status(400).json({ error: 'Missing orderId.' }); return; }

      const deliveryLog = await prisma.deliveryLog.findFirst({
        where: { orderId, status: { not: DeliveryStatus.DELIVERED } },
        orderBy: { createdAt: 'desc' }
      });
      if (!deliveryLog) { res.status(404).json({ error: 'No active delivery for this order.' }); return; }

      const targetStatus = status === 'DELIVERED' ? DeliveryStatus.DELIVERED : DeliveryStatus.IN_TRANSIT;

      const updatedDelivery = await prisma.deliveryLog.update({
        where: { id: deliveryLog.id },
        data: { status: targetStatus, activeCoordinates: coordinates || deliveryLog.activeCoordinates, deliveredAt: targetStatus === DeliveryStatus.DELIVERED ? new Date() : null }
      });

      if (targetStatus === DeliveryStatus.DELIVERED) {
        await prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.DELIVERED } });
        broadcastGlobalAlert(`Delivery Complete: Order [${orderId}] received by client.`);
      }

      res.json({ message: `Delivery status: ${targetStatus}`, delivery: updatedDelivery });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to update delivery.', details: error.message });
    }
  }
);

// ==========================================
// 9. RECEPTION ROUTES
// ==========================================

// GET /api/reception/visitors
app.get('/api/reception/visitors',
  authenticateToken,
  authorizeDepartments([Department.RECEPTION, Department.CEO, Department.MANAGEMENT]),
  async (_req, res) => {
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      const visitors = await prisma.visitorRecord.findMany({
        where: { checkInTime: { gte: today, lt: tomorrow } },
        include: { checkedInBy: { select: { fullName: true } } },
        orderBy: { checkInTime: 'desc' }
      });
      res.json(visitors);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch visitors.', details: error.message });
    }
  }
);

// POST /api/reception/visitors
app.post('/api/reception/visitors',
  authenticateToken,
  authorizeDepartments([Department.RECEPTION]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { fullName, purpose, hostName } = req.body;
      const visitor = await prisma.visitorRecord.create({
        data: { fullName, purpose, hostName, checkedInById: req.user!.id }
      });
      res.status(201).json({ message: 'Visitor checked in.', visitor });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to log visitor.', details: error.message });
    }
  }
);

// POST /api/reception/visitors/check-out
app.post('/api/reception/visitors/check-out',
  authenticateToken,
  authorizeDepartments([Department.RECEPTION]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { visitorId } = req.body;
      const visitor = await prisma.visitorRecord.update({
        where: { id: visitorId },
        data: { checkOutTime: new Date() }
      });
      res.json({ message: 'Visitor checked out.', visitor });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to check out visitor.', details: error.message });
    }
  }
);

// POST /api/reception/attendance/check-in
app.post('/api/reception/attendance/check-in',
  authenticateToken,
  authorizeDepartments([Department.RECEPTION]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { employeeUserId } = req.body;
      if (!employeeUserId) { res.status(400).json({ error: 'Missing employeeUserId.' }); return; }

      const now = new Date();
      const status = (now.getHours() > 8 || (now.getHours() === 8 && now.getMinutes() > 30)) ? 'LATE' : 'PRESENT';
      const today = new Date(); today.setHours(0, 0, 0, 0);

      const attendance = await prisma.attendanceLog.create({
        data: { userId: employeeUserId, date: today, status, checkInTime: new Date() }
      });

      res.status(201).json({ message: `Check-in recorded: ${status}.`, attendance });
    } catch (error: any) {
      if (error.code === 'P2002') { res.status(400).json({ error: 'Already checked in today.' }); return; }
      res.status(500).json({ error: 'Failed to check in.', details: error.message });
    }
  }
);

// POST /api/reception/attendance/check-out
app.post('/api/reception/attendance/check-out',
  authenticateToken,
  authorizeDepartments([Department.RECEPTION]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { employeeUserId } = req.body;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const attendance = await prisma.attendanceLog.update({
        where: { userId_date: { userId: employeeUserId, date: today } },
        data: { checkOutTime: new Date() }
      });
      res.json({ message: 'Check-out recorded.', attendance });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to check out.', details: error.message });
    }
  }
);

// ==========================================
// START SERVER
// ==========================================

server.listen(PORT, () => {
  console.log(`✅ REBMA Impex ERP API running on port ${PORT}`);
  console.log(`📡 Socket.io real-time enabled`);
  console.log(`🗄️  Database: Neon PostgreSQL`);
});

export default app;
