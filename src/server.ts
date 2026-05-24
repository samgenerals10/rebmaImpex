// src/server.ts

import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
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
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
  }
});

const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

app.use(express.json());

// Socket.io Real-time connection handler (for Messaging & Community chats)
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Employee joins department room for group broadcasts
  socket.on('join_department', (department: string) => {
    const roomName = `dept-${department.toLowerCase()}`;
    socket.join(roomName);
    console.log(`Socket ${socket.id} joined room: ${roomName}`);
  });

  // Direct 1-on-1 employee message emitter
  socket.on('send_direct_message', ({ recipientId, content, senderId }) => {
    // In a real application, persist message to Database then emit:
    io.to(recipientId).emit('receive_direct_message', { senderId, content });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// ==========================================
// 1. AUTHENTICATION & ONBOARDING ROUTE ENDPOINTS
// ==========================================

/**
 * Endpoint: Register standard staff or Whitelisted CEO accounts
 */
app.post('/api/auth/register', validateCeoRegistration, async (req, res) => {
  try {
    const { email, password, fullName, ghanaCardId, department } = req.body;

    if (!email || !password || !fullName || !department) {
      res.status(400).json({ error: 'Missing required credentials or employee details.' });
      return;
    }

    // Hash password (mock placeholder - in production use bcryptjs or argon2)
    const passwordHash = `hashed_${password}`;

    // Divergent Registration Workflow
    let initialStatus: UserStatus = UserStatus.PENDING_APPROVAL;
    let smsOtp: string | null = null;
    let smsOtpExpiresAt: Date | null = null;
    let isCeo = false;

    if (department === Department.CEO) {
      if (isWhitelistedCeo(email)) {
        isCeo = true;
        initialStatus = UserStatus.OTP_VERIFICATION;
        // Generate numeric 6-digit verification code
        smsOtp = Math.floor(100000 + Math.random() * 900000).toString();
        smsOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

        // Trigger SMS Gateway transmission (Ghana SMS provider mockup)
        console.log(`[SMS GATEWAY] Transmission sent to CEO phone. OTP Code: ${smsOtp}`);
      } else {
        res.status(403).json({ error: 'CEO department registration is restricted.' });
        return;
      }
    }

    const newUser = await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        passwordHash,
        fullName,
        ghanaCardId: department === Department.CEO ? null : ghanaCardId, // Ghana card not required for whitelisted CEO
        department: department as Department,
        status: initialStatus,
        smsOtp,
        smsOtpExpiresAt,
        isCeo,
      },
    });

    res.status(201).json({
      message: department === Department.CEO 
        ? 'Registration complete. Verify SMS OTP code to activate.' 
        : 'Registration submitted. Awaiting HR approval.',
      userId: newUser.id,
      status: newUser.status,
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'An account with this email already exists.' });
      return;
    }
    res.status(500).json({ error: 'Internal registration failure.', details: error.message });
  }
});

/**
 * Endpoint: Verify CEO SMS OTP bypass code to grant immediate ACTIVE status
 */
app.post('/api/auth/verify-ceo-otp', async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    res.status(400).json({ error: 'Email and OTP code are required.' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() }
    });

    if (!user || user.department !== Department.CEO) {
      res.status(404).json({ error: 'CEO account not found.' });
      return;
    }

    if (user.status !== UserStatus.OTP_VERIFICATION || !user.smsOtp) {
      res.status(400).json({ error: 'Account is not pending OTP verification.' });
      return;
    }

    if (user.smsOtpExpiresAt && new Date() > user.smsOtpExpiresAt) {
      res.status(400).json({ error: 'OTP code has expired. Please request a new code.' });
      return;
    }

    if (user.smsOtp !== otp) {
      res.status(400).json({ error: 'Incorrect verification code.' });
      return;
    }

    // Activate CEO
    await prisma.user.update({
      where: { id: user.id },
      data: {
        status: UserStatus.ACTIVE,
        smsOtp: null,
        smsOtpExpiresAt: null,
      }
    });

    res.status(200).json({ message: 'CEO verified successfully. You may now log in.' });
  } catch (error: any) {
    res.status(500).json({ error: 'OTP verification failed.', details: error.message });
  }
});

/**
 * Endpoint: Credentials login
 */
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() }
    });

    if (!user || user.passwordHash !== `hashed_${password}`) {
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    if (user.status !== UserStatus.ACTIVE) {
      res.status(403).json({
        error: 'Account not active.',
        status: user.status,
        message: 'Your registration requires approval or verification.'
      });
      return;
    }

    // Generate JWT access token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '8h' });

    res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        department: user.department,
        isCeo: user.isCeo,
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Login process failed.', details: error.message });
  }
});

// ==========================================
// 2. PROTECTED DEPARTMENTAL ENDPOINTS
// ==========================================

// Global routes accessible to CEO & Management (such as Live GPS fleet trackers)
app.get('/api/fleet/live-tracking', 
  authenticateToken, 
  authorizeDepartments([Department.CEO, Department.MANAGEMENT, Department.HR, Department.MARKETING]), 
  async (req: AuthenticatedRequest, res) => {
    // Logic to retrieve live coordinates of vehicles
    res.json({ message: 'Live GPS locations retrieved.', locations: [] });
});

// HR: Registration Approval queue route
app.post('/api/hr/approve-user', 
  authenticateToken, 
  authorizeDepartments([Department.HR]), 
  async (req: AuthenticatedRequest, res) => {
    const { userId, approve } = req.body;

    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          status: approve ? UserStatus.ACTIVE : UserStatus.REJECTED
        }
      });
      res.json({ message: `User status updated to: ${updatedUser.status}` });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update user status.' });
    }
});

// RECEPTION: Guest Check-in Terminal route
app.post('/api/reception/visitors', 
  authenticateToken, 
  authorizeDepartments([Department.RECEPTION]), 
  async (req: AuthenticatedRequest, res) => {
    const { fullName, purpose, hostName } = req.body;
    
    try {
      const visitor = await prisma.visitorRecord.create({
        data: {
          fullName,
          purpose,
          hostName,
          checkedInById: req.user!.id
        }
      });
      res.status(201).json({ message: 'Visitor checked in successfully.', visitor });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to log visitor check-in.', details: error.message });
    }
});

// WebSocket Alert helper function (emits real-time alerts to rooms)
function broadcastGlobalAlert(message: string) {
  io.emit('global_alert', { message, timestamp: new Date() });
}

// ==========================================
// 3. CORE WORKFLOWS BUSINESS LOGIC API ROUTES
// ==========================================

// ----------------------------------------------------
// WORKFLOW A: PORT INVENTORY INTAKE & PRICING ROUTES
// ----------------------------------------------------

/**
 * Operations department logs details of incoming goods from port.
 * Initial Status: PENDING_MANAGEMENT_APPROVAL
 */
app.post('/api/operations/intake',
  authenticateToken,
  authorizeDepartments([Department.OPERATIONS]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { country, company, quantity, weight, discrepancies, isFaulty } = req.body;
      if (!country || !company || !quantity || !weight) {
        res.status(400).json({ error: 'Missing country, company, quantity, or weight details.' });
        return;
      }

      const intake = await prisma.incomingGoods.create({
        data: {
          country,
          company,
          quantity: parseInt(quantity),
          weight: parseFloat(weight),
          discrepancies,
          isFaulty: !!isFaulty,
          status: GoodsStatus.PENDING_MANAGEMENT_APPROVAL
        }
      });

      // Send WebSocket notification alert to Management department room
      io.to('dept-management').emit('intake_logged', { 
        intakeId: intake.id, 
        company, 
        quantity, 
        message: 'New Port Ingest shipment requires approval & pricing.' 
      });

      res.status(201).json({ message: 'Port intake logged. Sent to Management for pricing and approval.', intake });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to record port intake.', details: error.message });
    }
  }
);

/**
 * Management approves/rejects intake goods and sets unit price.
 */
app.post('/api/management/approve-intake',
  authenticateToken,
  authorizeDepartments([Department.MANAGEMENT]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { intakeId, approve, unitPrice } = req.body;
      if (!intakeId) {
        res.status(400).json({ error: 'Missing intakeId.' });
        return;
      }

      if (approve && (typeof unitPrice !== 'number' || unitPrice <= 0)) {
        res.status(400).json({ error: 'A valid unit price is required to approve inventory.' });
        return;
      }

      const status = approve ? GoodsStatus.APPROVED : GoodsStatus.REJECTED;

      const intake = await prisma.incomingGoods.update({
        where: { id: intakeId },
        data: {
          status,
          unitPrice: approve ? unitPrice : null,
          approvedById: req.user!.id
        }
      });

      if (approve) {
        // Emit Socket event to Operations confirming ingestion
        io.to('dept-operations').emit('intake_approved', { 
          intakeId: intake.id, 
          message: 'Inventory successfully ingested into primary stock.' 
        });

        // Trigger instant notification alerts to Finance and Marketing with updated prices
        io.to('dept-finance').emit('price_catalog_updated', { intakeId: intake.id, company: intake.company, unitPrice });
        io.to('dept-marketing').emit('price_catalog_updated', { intakeId: intake.id, company: intake.company, unitPrice });
      } else {
        io.to('dept-operations').emit('intake_rejected', { 
          intakeId: intake.id, 
          message: 'Shipment rejected by Management.' 
        });
      }

      res.json({ message: `Port intake state resolved: ${status}`, intake });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to resolve intake approval.', details: error.message });
    }
  }
);

// ----------------------------------------------------
// WORKFLOW B: ORDER PROCESSING & DISPATCH DELIVERY
// ----------------------------------------------------

/**
 * Marketing creates a client order.
 * Initial Status: PENDING_FINANCE
 */
app.post('/api/marketing/orders',
  authenticateToken,
  authorizeDepartments([Department.MARKETING]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { clientName, paymentMode, totalAmount } = req.body;
      if (!clientName || !paymentMode || typeof totalAmount !== 'number') {
        res.status(400).json({ error: 'Missing clientName, paymentMode or totalAmount details.' });
        return;
      }

      const order = await prisma.order.create({
        data: {
          clientName,
          paymentMode: paymentMode as PaymentMode,
          totalAmount,
          status: OrderStatus.PENDING_FINANCE,
          createdById: req.user!.id
        }
      });

      // Socket notification to Finance queue
      io.to('dept-finance').emit('order_submitted', { 
        orderId: order.id, 
        clientName, 
        totalAmount, 
        paymentMode 
      });

      res.status(201).json({ message: 'Order submitted. Pending Finance credit check evaluation.', order });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to submit order.', details: error.message });
    }
  }
);

/**
 * Finance checks the payment mode:
 * - If Credit: Forwards order to Management (PENDING_MANAGEMENT).
 * - If Cash/Online: Finance approves order directly (APPROVED).
 */
app.post('/api/finance/evaluate-order',
  authenticateToken,
  authorizeDepartments([Department.FINANCE]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { orderId, approve } = req.body;
      if (!orderId) {
        res.status(400).json({ error: 'Missing orderId.' });
        return;
      }

      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order) {
        res.status(404).json({ error: 'Order not found.' });
        return;
      }

      if (!approve) {
        const rejectedOrder = await prisma.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.REJECTED }
        });
        res.json({ message: 'Order rejected by Finance.', order: rejectedOrder });
        return;
      }

      if (order.paymentMode === PaymentMode.CREDIT) {
        // Forward to Management for strict approval
        const updatedOrder = await prisma.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.PENDING_MANAGEMENT }
        });

        io.to('dept-management').emit('credit_approval_required', { 
          orderId: order.id, 
          clientName: order.clientName, 
          totalAmount: order.totalAmount 
        });

        res.json({ message: 'Credit Order routed to Management for strict sign-off.', order: updatedOrder });
      } else {
        // Direct approval for Cash/Online/Prepaid
        const updatedOrder = await prisma.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.APPROVED }
        });

        res.json({ message: 'Direct Cash/Online Order approved by Finance.', order: updatedOrder });
      }
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to evaluate order payment terms.', details: error.message });
    }
  }
);

/**
 * Management approves/rejects credit orders.
 */
app.post('/api/management/approve-credit-order',
  authenticateToken,
  authorizeDepartments([Department.MANAGEMENT]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { orderId, approve } = req.body;
      if (!orderId) {
        res.status(400).json({ error: 'Missing orderId.' });
        return;
      }

      const status = approve ? OrderStatus.APPROVED : OrderStatus.REJECTED;
      const order = await prisma.order.update({
        where: { id: orderId },
        data: { status }
      });

      res.json({ message: `Management credit decision recorded: ${status}`, order });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to record credit approval choice.', details: error.message });
    }
  }
);

/**
 * Once order is approved, Finance runs this endpoint to finalize documents.
 * Generates invoice (notifies Marketing), issues Fulfillment ticket (notifies Operations),
 * and flags order status as PROCESSING.
 */
app.post('/api/finance/finalize-order',
  authenticateToken,
  authorizeDepartments([Department.FINANCE]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { orderId } = req.body;
      if (!orderId) {
        res.status(400).json({ error: 'Missing orderId.' });
        return;
      }

      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order || order.status !== OrderStatus.APPROVED) {
        res.status(400).json({ error: 'Order must be in APPROVED status to finalize billing & fulfillment.' });
        return;
      }

      // Generate invoice calculations (VAT 15% mockup)
      const invoiceNo = `INV-${Date.now()}`;
      const taxAmount = order.totalAmount * 0.15;
      const grandTotal = order.totalAmount + taxAmount;

      const invoice = await prisma.invoice.create({
        data: {
          orderId,
          invoiceNo,
          amount: order.totalAmount,
          taxAmount,
          grandTotal,
          pdfUrl: `/invoices/${invoiceNo}.pdf`
        }
      });

      // Generate warehouse fulfillment ticket
      const ticket = await prisma.fulfillmentTicket.create({
        data: {
          orderId,
          type: 'ORDER_FULFILLMENT',
          details: { clientName: order.clientName, totalAmount: order.totalAmount },
          status: 'PENDING'
        }
      });

      // Update Order Status
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PROCESSING }
      });

      // Notify Marketing & Operations via sockets
      io.to('dept-marketing').emit('invoice_generated', { orderId, invoiceId: invoice.id, invoiceNo });
      io.to('dept-operations').emit('fulfillment_ticket_issued', { orderId, ticketId: ticket.id });

      res.json({ 
        message: 'Billing documents and warehouse release ticket created.', 
        order: updatedOrder, 
        invoice, 
        ticket 
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to finalize order operations.', details: error.message });
    }
  }
);

/**
 * Operations pulls goods from inventory and releases them to Dispatch.
 * Status shifts: OUT_FOR_DELIVERY
 */
app.post('/api/operations/release-to-dispatch',
  authenticateToken,
  authorizeDepartments([Department.OPERATIONS]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { orderId, vehicleId } = req.body;
      if (!orderId || !vehicleId) {
        res.status(400).json({ error: 'Missing orderId or vehicleId parameters.' });
        return;
      }

      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order || order.status !== OrderStatus.PROCESSING) {
        res.status(400).json({ error: 'Order is not in warehouse processing stage.' });
        return;
      }

      // Initialize active transit logs
      const delivery = await prisma.deliveryLog.create({
        data: {
          orderId,
          vehicleId,
          status: DeliveryStatus.ASSIGNED
        }
      });

      // Shift Order Status
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.OUT_FOR_DELIVERY }
      });

      res.json({ message: 'Warehouse load released. Dispatch driver transit routing active.', order: updatedOrder, delivery });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to release order to dispatcher.', details: error.message });
    }
  }
);

/**
 * Dispatcher streams coordinates and signals delivery completion.
 * Triggers instant global alerts to Marketing, Operations, Management, and Finance on delivery.
 */
app.post('/api/dispatch/deliver-order',
  authenticateToken,
  authorizeDepartments([Department.DISPATCH]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { orderId, coordinates, status } = req.body; // status: 'IN_TRANSIT' | 'DELIVERED'
      if (!orderId) {
        res.status(400).json({ error: 'Missing orderId.' });
        return;
      }

      const deliveryLog = await prisma.deliveryLog.findFirst({
        where: { orderId, status: { not: DeliveryStatus.DELIVERED } },
        orderBy: { createdAt: 'desc' }
      });

      if (!deliveryLog) {
        res.status(404).json({ error: 'No active delivery found for this order.' });
        return;
      }

      const targetStatus = status === 'DELIVERED' ? DeliveryStatus.DELIVERED : DeliveryStatus.IN_TRANSIT;

      const updatedDelivery = await prisma.deliveryLog.update({
        where: { id: deliveryLog.id },
        data: {
          status: targetStatus,
          activeCoordinates: coordinates ? coordinates : deliveryLog.activeCoordinates,
          deliveredAt: targetStatus === DeliveryStatus.DELIVERED ? new Date() : null
        }
      });

      if (targetStatus === DeliveryStatus.DELIVERED) {
        await prisma.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.DELIVERED }
        });

        // Broadcast instantaneous global WebSocket alert to all departments
        broadcastGlobalAlert(`Deliver Complete: Order [${orderId}] successfully received by client.`);
      }

      res.json({ message: `Delivery tracking status set to ${targetStatus}`, delivery: updatedDelivery });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to update dispatch status.', details: error.message });
    }
  }
);

// ----------------------------------------------------
// WORKFLOW C: PRODUCTION RAW MATERIALS PROCESSING
// ----------------------------------------------------

/**
 * Production initiates raw materials request on credit.
 * Initial Status: PENDING_MANAGEMENT
 */
app.post('/api/production/raw-materials',
  authenticateToken,
  authorizeDepartments([Department.PRODUCTION]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { items } = req.body; // Expects array: Array<{ materialName: string, quantity: number }>
      if (!items || !Array.isArray(items)) {
        res.status(400).json({ error: 'Items list array is required.' });
        return;
      }

      const request = await prisma.productionRequest.create({
        data: {
          items,
          status: ProductionStatus.PENDING_MANAGEMENT
        }
      });

      // Emit on hold signals
      io.to('dept-finance').emit('production_request_on_hold', { requestId: request.id });
      io.to('dept-management').emit('production_request_approval_needed', { requestId: request.id });

      res.status(201).json({ message: 'Credit request logged. Sent to Management for authorization check.', request });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to log production request.', details: error.message });
    }
  }
);

/**
 * Management signs off on Production Credit request.
 */
app.post('/api/management/approve-production-request',
  authenticateToken,
  authorizeDepartments([Department.MANAGEMENT]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { requestId, approve } = req.body;
      if (!requestId) {
        res.status(400).json({ error: 'Missing requestId.' });
        return;
      }

      const status = approve ? ProductionStatus.APPROVED : ProductionStatus.REJECTED;

      const request = await prisma.productionRequest.update({
        where: { id: requestId },
        data: { status }
      });

      if (approve) {
        // Alert Finance to release goods
        io.to('dept-finance').emit('production_request_authorized', { requestId });
      }

      res.json({ message: `Management decision recorded: ${status}`, request });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to record authorization.', details: error.message });
    }
  }
);

/**
 * Finance issues material release ticket following Management signature.
 * Ticket routes to Operations warehouse, notifying Production to retrieve stock.
 */
app.post('/api/finance/release-production-materials',
  authenticateToken,
  authorizeDepartments([Department.FINANCE]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { requestId } = req.body;
      if (!requestId) {
        res.status(400).json({ error: 'Missing requestId.' });
        return;
      }

      const request = await prisma.productionRequest.findUnique({ where: { id: requestId } });
      if (!request || request.status !== ProductionStatus.APPROVED) {
        res.status(400).json({ error: 'Release blocked. Management authorization is required.' });
        return;
      }

      // Generate warehouse release tickets
      const ticket = await prisma.fulfillmentTicket.create({
        data: {
          productionRequestId: requestId,
          type: 'PRODUCTION_RELEASE',
          details: { items: request.items },
          status: 'PENDING'
        }
      });

      const updatedRequest = await prisma.productionRequest.update({
        where: { id: requestId },
        data: { status: ProductionStatus.TICKETS_ISSUED }
      });

      // Route ticket to Operations (warehousefloor) & Notify Production
      io.to('dept-operations').emit('production_release_ticket', { ticketId: ticket.id, details: ticket.details });
      io.to('dept-production').emit('materials_ready_for_pickup', { requestId, ticketId: ticket.id });

      res.json({ message: 'Production release ticket issued. Routed to Operations.', request: updatedRequest, ticket });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to process materials release.', details: error.message });
    }
  }
);

// ----------------------------------------------------
// WORKFLOW D: FRONT DESK TERMINAL & ATTENDANCE
// ----------------------------------------------------

/**
 * Receptionist logs daily employee check-in.
 * If check-in occurs after 08:30 AM, logs status as LATE.
 */
app.post('/api/reception/attendance/check-in',
  authenticateToken,
  authorizeDepartments([Department.RECEPTION]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { employeeUserId } = req.body;
      if (!employeeUserId) {
        res.status(400).json({ error: 'Missing employeeUserId.' });
        return;
      }

      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      let status = 'PRESENT';
      // 8:30 AM threshold check
      if (currentHour > 8 || (currentHour === 8 && currentMinute > 30)) {
        status = 'LATE';
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const attendance = await prisma.attendanceLog.create({
        data: {
          userId: employeeUserId,
          date: today,
          status,
          checkInTime: new Date()
        }
      });

      res.status(201).json({ message: `Check-in recorded: employee marked ${status}.`, attendance });
    } catch (error: any) {
      if (error.code === 'P2002') {
        res.status(400).json({ error: 'Employee check-in already recorded for today.' });
        return;
      }
      res.status(500).json({ error: 'Failed to log check-in.', details: error.message });
    }
  }
);

/**
 * Receptionist logs daily employee check-out.
 */
app.post('/api/reception/attendance/check-out',
  authenticateToken,
  authorizeDepartments([Department.RECEPTION]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { employeeUserId } = req.body;
      if (!employeeUserId) {
        res.status(400).json({ error: 'Missing employeeUserId.' });
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const attendance = await prisma.attendanceLog.update({
        where: {
          userId_date: {
            userId: employeeUserId,
            date: today
          }
        },
        data: {
          checkOutTime: new Date()
        }
      });

      res.json({ message: 'Check-out recorded successfully.', attendance });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to log check-out.', details: error.message });
    }
  }
);

/**
 * Receptionist logs visitor check-out time.
 */
app.post('/api/reception/visitors/check-out',
  authenticateToken,
  authorizeDepartments([Department.RECEPTION]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { visitorRecordId } = req.body;
      if (!visitorRecordId) {
        res.status(400).json({ error: 'Missing visitorRecordId.' });
        return;
      }

      const visitor = await prisma.visitorRecord.update({
        where: { id: visitorRecordId },
        data: {
          checkOutTime: new Date()
        }
      });

      res.json({ message: 'Visitor departure checked out.', visitor });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to record visitor departure.', details: error.message });
    }
  }
);

/**
 * Exporter: Generates and downloads a CSV export file of all sales orders.
 * Restricted to FINANCE, MARKETING, MANAGEMENT, and CEO roles.
 */
app.get('/api/reports/export-csv',
  authenticateToken,
  authorizeDepartments([Department.FINANCE, Department.MARKETING, Department.MANAGEMENT, Department.CEO]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const orders = await prisma.order.findMany({
        orderBy: { createdAt: 'desc' }
      });

      let csvContent = 'Order ID,Client Name,Payment Mode,Total Amount,Status,Created At\n';
      orders.forEach(order => {
        csvContent += `${order.id},"${order.clientName}",${order.paymentMode},${order.totalAmount},${order.status},${order.createdAt.toISOString()}\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="rebma_order_ledger_export.csv"');
      res.status(200).send(csvContent);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to generate CSV export.', details: error.message });
    }
  }
);

// Start Server listener
server.listen(PORT, () => {
  console.log(`Rebma Impex ERP Backend running on port ${PORT}`);
});
