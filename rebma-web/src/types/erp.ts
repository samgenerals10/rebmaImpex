// rebma-web/src/types/erp.ts

export interface Order {
  id: string;
  ticketNumber?: string;
  clientName: string;
  productName?: string;
  destination?: string;
  ghanaCard?: string;
  paymentMode: 'CASH' | 'CREDIT' | 'MOBILE_MONEY' | 'CHEQUE';
  totalAmount: number;
  status: 'PENDING_FINANCE' | 'PENDING_MANAGEMENT' | 'APPROVED' | 'PROCESSING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'REJECTED';
  createdAt: string;
}

export interface IncomingGoods {
  id: string;
  productName?: string;
  productImage?: string; // base64 data URL
  goodsCode?: string;
  destination?: string;
  country: string;
  company: string;
  quantity: number;
  weight: number;
  discrepancies: string;
  status: 'PENDING_MANAGEMENT_APPROVAL' | 'APPROVED' | 'REJECTED';
  unitPrice?: number;
  createdAt?: string;
}

export interface ProductionRequest {
  id: string;
  items: Array<{ materialName: string; quantity: number }>;
  status: 'PENDING_MANAGEMENT' | 'APPROVED' | 'TICKETS_ISSUED' | 'COMPLETED';
  producedGoods?: number;
  createdAt?: string;
}

export interface Visitor {
  id: string;
  fullName: string;
  purpose: string;
  hostName: string;
  checkInTime: string;
  checkOutTime?: string;
}

export interface Attendance {
  id: string;
  fullName: string;
  checkInTime: string;
  status: 'PRESENT' | 'LATE';
  date?: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  time: string;
  receiver?: string;
}

export interface CurrentUser {
  id: string;
  fullName: string;
  email: string;
  department: string;
  isCeo: boolean;
  isSuperAdmin?: boolean;
  photo?: string;
  requiresPasswordReset?: boolean;
  tempAuthSecret?: string | null;
}

export interface BoardroomMeeting {
  id: string;
  title: string;
  date: string;
  time: string;
  organizer: string;
  participants: string[];
}

export interface FinancePayment {
  id: string;
  clientName: string;
  amount: number;
  paymentMode: 'CASH' | 'CHEQUE' | 'MOBILE_MONEY' | 'CREDIT';
  paymentType: 'DIRECT' | 'CREDIT_SETTLEMENT';
  orderId?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  location: string;
  companyName: string;
  ghanaCard?: string;
  email?: string;
  photo?: string; // base64 data URL
  registeredAt: string;
  orderHistory?: string[];
  creditHistory?: Array<{ orderId: string; amount: number; date: string; status: string }>;
}

export interface Driver {
  id: string;
  fullName: string;
  phone: string;
  ghanaCard: string;
  licenseNumber: string;
  truckId: string;
  status: 'ACTIVE' | 'OFFLINE' | 'ON_DELIVERY';
  photo?: string;
  totalDeliveries?: number;
  joinedAt?: string;
}

export interface StaffMember {
  id: string;
  fullName: string;
  email: string;
  department: string;
  role: string;
  ghanaCard: string;
  phone: string;
  photo?: string;
  joinedAt: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

export interface PendingRegistration {
  id: string;
  fullName: string;
  email: string;
  department: string;
  ghanaCard: string;
  phone?: string;
  submittedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface GoodsPrice {
  id: string;
  productName: string;
  category: 'NEW_GOODS' | 'INCOMING_GOODS' | 'OLD_GOODS';
  unitPrice: number;
  currency: 'GHS' | 'USD';
  setBy: string;
  setAt: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  department: string;
  performedBy: string;
  details: string;
  timestamp: string;
}

export interface DeliveryRecord {
  id: string;
  orderId: string;
  clientName: string;
  destination: string;
  driverName: string;
  driverId: string;
  dispatchedAt: string;
  deliveredAt?: string;
  status: 'PENDING_ASSIGNMENT' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED';
  vehicleId?: string;
  proofUrl?: string;
  recipientName?: string;
  deliveryNotes?: string;
}

export interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
}
