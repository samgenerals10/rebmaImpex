// rebma-web/src/types/erp.ts

export interface OrderLineItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  ticketNumber?: string;
  clientName: string;
  customerId?: string;
  phone?: string;
  productName?: string;
  destination?: string;
  ghanaCard?: string;
  paymentMode: string;
  totalAmount: number;
  status: 'PENDING_RISK' | 'PENDING_MANAGEMENT' | 'PENDING_FINANCE' | 'PENDING_RISK_RELEASE' | 'APPROVED' | 'PROCESSING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'REJECTED' | 'RETURNED_FOR_CORRECTION';
  createdAt: string;
  quantity?: number;
  products?: string;
  submittedBy?: string;
  amountPaid?: number;
  rejectionReason?: string;
  metadata?: {
    items?: OrderLineItem[];
    [key: string]: any;
  };
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
  status: 'PENDING_RISK_APPROVAL' | 'APPROVED' | 'REJECTED' | 'RETURNED_FOR_CORRECTION';
  unitPrice?: number;
  createdAt?: string;
  containerNumber?: string;
  rejectionReason?: string;
}

export interface Waybill {
  id: string;
  waybillNumber: string;
  orderId?: string;
  deliveryLogId?: string;
  containerNumber?: string;
  createdAt: string;
  createdBy?: string;
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
  isAdmin: boolean;
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
  ghanaCardFront?: string;
  ghanaCardBack?: string;
  email?: string;
  photo?: string; // base64 data URL
  registeredAt: string;
  updatedAt?: string;
  orderHistory?: string[];
  creditHistory?: Array<{ orderId: string; amount: number; date: string; status: string }>;
  isSpecialCustomer?: boolean;
  discountPercent?: number;
  houseAddress?: string;
  companyAddress?: string;
  gpsLat?: number;
  gpsLng?: number;
  ghanaCard2?: string;
  partnerName?: string;
  businessCertificateUrl?: string;
  notes?: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED_FOR_CORRECTION';
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  // Individual credit terms — Risk-owned (Phase 6). null/undefined limit
  // means "no per-customer override, the global CEO cap applies."
  creditLimit?: number | null;
  creditStatus?: 'ACTIVE' | 'ON_HOLD';
  creditTermsSetBy?: string;
  creditTermsSetAt?: string;
}

export interface Driver {
  id: string;
  driverId?: string;
  fullName: string;
  phone: string;
  ghanaCard: string;
  licenseNumber: string;
  truckId: string;
  status: 'ACTIVE' | 'OFFLINE' | 'ON_DELIVERY';
  photo?: string;
  totalDeliveries?: number;
  joinedAt?: string;
  userId?: string;
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
  employeeNumber?: string;
  resumeUrl?: string;
  address?: string;
  hrRemarks?: string;
  guarantorName?: string;
  guarantorPhone?: string;
  guarantorRelationship?: string;
  guarantorIdNumber?: string;
  guarantorAddress?: string;
  staffCategory?: string;
  performanceTaskScore?: number;
  performanceTeamScore?: number;
  performanceQualityScore?: number;
  performanceNotes?: string;
  performanceReviewedBy?: string;
  performanceReviewedAt?: string;
}

export interface EmployeeQuery {
  id: string;
  staffId: string;
  staffName: string;
  department: string;
  subject: string;
  body: string;
  status: 'OPEN' | 'RESOLVED';
  response?: string;
  respondedBy?: string;
  respondedAt?: string;
  createdAt: string;
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
  referenceId?: string;
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
  status: 'PENDING_ASSIGNMENT' | 'ASSIGNED' | 'IN_TRANSIT' | 'PENDING_RISK_REVIEW' | 'POD_REJECTED' | 'DELIVERED' | 'FAILED';
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

export interface GeneralPurchase {
  id: string;
  itemName: string;
  itemCode: string;
  category: string;
  quantity: number;
  cost: number;
  status: 'PENDING_MANAGEMENT_APPROVAL' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  dateReceived: string;
  approvedById?: string;
}

