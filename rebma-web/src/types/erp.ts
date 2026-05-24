// rebma-web/src/types/erp.ts

export interface Order {
  id: string;
  clientName: string;
  paymentMode: 'CASH' | 'CREDIT' | 'ONLINE';
  totalAmount: number;
  status: 'PENDING_FINANCE' | 'PENDING_MANAGEMENT' | 'APPROVED' | 'PROCESSING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'REJECTED';
  createdAt: string;
}

export interface IncomingGoods {
  id: string;
  country: string;
  company: string;
  quantity: number;
  weight: number;
  discrepancies: string;
  status: 'PENDING_MANAGEMENT_APPROVAL' | 'APPROVED' | 'REJECTED';
  unitPrice?: number;
}

export interface ProductionRequest {
  id: string;
  items: Array<{ materialName: string; quantity: number }>;
  status: 'PENDING_MANAGEMENT' | 'APPROVED' | 'TICKETS_ISSUED' | 'COMPLETED';
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
}

export interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  time: string;
}

export interface CurrentUser {
  fullName: string;
  email: string;
  department: string;
  isCeo: boolean;
}
