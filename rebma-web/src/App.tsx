import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Check, X, ArrowRight, Lock, Mail, User, CreditCard } from 'lucide-react';

import type { Order, IncomingGoods, ProductionRequest, Visitor, Attendance, ChatMessage, BoardroomMeeting, FinancePayment, Customer, GoodsPrice, AuditEntry } from './types/erp';

import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import ChatDrawer from './components/collaborative/ChatDrawer';

import CeoDashboard from './views/CeoDashboard';
import ManagementDashboard from './views/ManagementDashboard';
import HrDashboard from './views/HrDashboard';
import MarketingDashboard from './views/MarketingDashboard';
import OperationsDashboard from './views/OperationsDashboard';
import FinanceDashboard from './views/FinanceDashboard';
import ProductionDashboard from './views/ProductionDashboard';
import ReceptionDashboard from './views/ReceptionDashboard';
import DispatchDashboard from './views/DispatchDashboard';
import LogisticsDashboard from './views/LogisticsDashboard';
import BoardroomView from './views/BoardroomView';
import SettingsDashboard from './views/SettingsDashboard';

// Customer is now imported from types/erp.ts

export default function App() {
  // Theme State - Default to 'ghana' official logo theme matching colors!
  const [theme, setTheme] = useState<'breeze' | 'seven' | 'royal' | 'mint' | 'sunset' | 'forest' | 'ghana'>('ghana');
  
  // Authentication & Onboarding States
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<{
    fullName: string;
    email: string;
    department: string;
    isCeo: boolean;
  } | null>(null);
  
  const [activeDepartment, setActiveDepartment] = useState<string>('CEO');
  const [activeSubTab, setActiveSubTab] = useState<string>('Overview');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Multi-Step Registration UI
  const [authScreen, setAuthScreen] = useState<'welcome' | 'login' | 'register' | 'otp' | 'forgot'>('login');
  const [registerEmail, setRegisterEmail] = useState<string>('');
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [registerDept, setRegisterDept] = useState<string>('MARKETING');
  const [registerName, setRegisterName] = useState<string>('');
  const [registerCard, setRegisterCard] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [simulatedReceivedOtp, setSimulatedReceivedOtp] = useState<string>('');
  const [registrationMessage, setRegistrationMessage] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [staySignedIn, setStaySignedIn] = useState<boolean>(true);
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [forgotSubmitted, setForgotSubmitted] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Financial Payments & Tickets
  const [paymentsList, setPaymentsList] = useState<FinancePayment[]>([
    { id: 'PAY-001', clientName: 'Inter-Ghana Foods Ltd', amount: 15000, paymentMode: 'BANK_TRANSFER', paymentType: 'DIRECT', createdAt: new Date().toLocaleString() },
    { id: 'PAY-002', clientName: 'Accra Retail Hub', amount: 12000, paymentMode: 'CASH', paymentType: 'CREDIT_SETTLEMENT', orderId: 'ORD-102', createdAt: new Date().toLocaleString() }
  ]);

  // Boardroom scheduled meetings
  const [meetingsList, setMeetingsList] = useState<BoardroomMeeting[]>([
    { id: 'MTG-001', title: 'Q2 Strategy & Port Logistics Align', date: '2026-05-25', time: '10:00 AM', organizer: 'Samuel Remba', participants: ['CEO', 'OPERATIONS', 'FINANCE'] }
  ]);
  
  // Admin & Whitelist Settings
  const [whitelistedCeos, setWhitelistedCeos] = useState<string>('ceo@rembaimpex.com, ceo2@rembaimpex.com');
  const [smsGateway, setSmsGateway] = useState<string>('arkesel');
  const [gpsInterval, setGpsInterval] = useState<number>(10);
  const [ghanaCardValidation, setGhanaCardValidation] = useState<boolean>(true);

  // Workflow Data states
  const [incomingGoodsList, setIncomingGoodsList] = useState<IncomingGoods[]>([
    { id: '1', productName: 'Cocoa Beans (Grade A)', goodsCode: 'GC-001204', destination: 'Accra Central Warehouse', country: "Cote d'Ivoire", company: 'Socoopec', quantity: 200, weight: 15.4, discrepancies: 'None', status: 'PENDING_MANAGEMENT_APPROVAL', createdAt: new Date().toLocaleString() },
    { id: '2', productName: 'Tropical Fruit Exports', goodsCode: 'GC-001205', destination: 'Tema Port Depot', country: 'Ecuador', company: 'Fruibest Ltd', quantity: 450, weight: 28.1, discrepancies: '2 damaged crates', status: 'APPROVED', unitPrice: 12.5, createdAt: new Date(Date.now() - 86400000).toLocaleString() }
  ]);
  const [ordersList, setOrdersList] = useState<Order[]>([
    { id: 'ORD-101', ticketNumber: 'TKT-10100', clientName: 'Inter-Ghana Foods Ltd', productName: 'Palm Oil Barrels', destination: 'Kumasi Depot', paymentMode: 'CREDIT', totalAmount: 48000, status: 'PENDING_FINANCE', createdAt: '1 hour ago', ghanaCard: 'GHA-1122334-4' },
    { id: 'ORD-102', ticketNumber: 'TKT-10200', clientName: 'Accra Retail Hub', productName: 'Polymer Granules', destination: 'Accra Central', paymentMode: 'CASH', totalAmount: 12000, status: 'DELIVERED', createdAt: '2 days ago' }
  ]);
  const [productionRequests, setProductionRequests] = useState<ProductionRequest[]>([
    { id: 'PRD-801', items: [{ materialName: 'Raw Polymer Granules', quantity: 5000 }], status: 'APPROVED', createdAt: new Date().toLocaleString() }
  ]);
  const [visitorsList, setVisitorsList] = useState<Visitor[]>([
    { id: 'V-101', fullName: 'Kwame Mensah', purpose: 'Customs clearance audit', hostName: 'Manager Frank', checkInTime: '09:15 AM' }
  ]);
  const [attendanceList, setAttendanceList] = useState<Attendance[]>([
    { id: 'A-20', fullName: 'Derrick Osei', checkInTime: '07:45 AM', status: 'PRESENT' },
    { id: 'A-21', fullName: 'Justice Kwame', checkInTime: '08:42 AM', status: 'LATE' }
  ]);

  // Customer List for Marketing Registration
  const [customersList, setCustomersList] = useState<Customer[]>([
    { id: 'C-001', name: 'Kofi Owusu', phone: '+233 24 123 4567', location: 'Accra', companyName: 'Owusu Retail Hub', registeredAt: '2 hours ago', ghanaCard: 'GHA-1234567-8', creditHistory: [{ orderId: 'ORD-102', amount: 12000, date: '2026-05-23', status: 'PAID' }] },
    { id: 'C-002', name: 'Abena Mansah', phone: '+233 20 987 6543', location: 'Kumasi', companyName: 'Mansah Wholesale Food', registeredAt: '1 day ago', ghanaCard: 'GHA-7654321-2' }
  ]);

  // Audit Log & Price Management
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([
    { id: 'AUD-001', action: 'Port Cargo Logged', department: 'OPERATIONS', performedBy: 'Kofi Mensah', details: 'Cargo from Socoopec (200 units, 15.4T) submitted for pricing.', timestamp: new Date().toLocaleString() },
    { id: 'AUD-002', action: 'Order Created', department: 'MARKETING', performedBy: 'Kwame Boateng', details: 'ORD-101 created for Inter-Ghana Foods Ltd — GHS 48,000 CREDIT terms.', timestamp: new Date().toLocaleString() },
  ]);
  const [goodsPrices, setGoodsPrices] = useState<GoodsPrice[]>([
    { id: 'GP-001', productName: 'Cocoa Beans (Grade A)', category: 'INCOMING_GOODS', unitPrice: 125.00, currency: 'USD', setBy: 'Management', setAt: new Date().toLocaleString() },
    { id: 'GP-002', productName: 'Polymer Granules', category: 'NEW_GOODS', unitPrice: 45.50, currency: 'GHS', setBy: 'Management', setAt: new Date().toLocaleString() },
  ]);

  // Helper to add to audit log
  const addAuditEntry = (action: string, department: string, details: string) => {
    const entry: AuditEntry = {
      id: `AUD-${Date.now().toString().slice(-5)}`,
      action,
      department,
      performedBy: currentUser?.fullName || 'System',
      details,
      timestamp: new Date().toLocaleString()
    };
    setAuditLog(prev => [entry, ...prev]);
  };

  // Welcome page live trades feed state
  const [liveTrades, setLiveTrades] = useState([
    { id: '1', type: 'BUY', item: 'Raw Cocoa Beans', qty: '50 MT', amount: '$160,000', dest: 'Tema Port', time: 'Just now' },
    { id: '2', type: 'SELL', item: 'Shea Butter', qty: '80 Crates', amount: '$12,500', dest: 'Rotterdam', time: '1 min ago' },
    { id: '3', type: 'BUY', item: 'Polymer Granules', qty: '200 Bags', amount: '$45,000', dest: 'Accra Depot', time: '3 mins ago' }
  ]);

  useEffect(() => {
    if (isAuthenticated) return;
    const interval = setInterval(() => {
      const types = ['BUY', 'SELL'];
      const items = ['Raw Cocoa Beans', 'Shea Butter', 'Gold Ore', 'Industrial Machinery', 'Polymer Granules', 'Timber Logs'];
      const qts = ['120 Bags', '45 MT', '10 Units', '150 Crates', '300 Bags'];
      const amounts = ['$24,000', '$148,000', '$95,000', '$18,500', '$62,000'];
      const dests = ['Tema Port', 'Kumasi Depot', 'Accra Central', 'Hamburg Harbor', 'London Terminal'];
      
      const newTrade = {
        id: Date.now().toString(),
        type: types[Math.floor(Math.random() * types.length)],
        item: items[Math.floor(Math.random() * items.length)],
        qty: qts[Math.floor(Math.random() * qts.length)],
        amount: amounts[Math.floor(Math.random() * amounts.length)],
        dest: dests[Math.floor(Math.random() * dests.length)],
        time: 'Just now'
      };
      
      setLiveTrades(prev => [newTrade, ...prev.slice(0, 4)].map((t, idx) => ({
        ...t,
        time: idx === 0 ? 'Just now' : `${idx} min${idx > 1 ? 's' : ''} ago`
      })));
    }, 4000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Real-Time Dispatch and Simulated Tracking States
  const [activeCoordinates, setActiveCoordinates] = useState<{lat: number, lng: number}>({lat: 5.6037, lng: -0.1870}); // Accra coords
  const [deliveryStatus, setDeliveryStatus] = useState<string>('IN_TRANSIT');

  // Real-Time Chat & Boardroom States
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '1', sender: 'System Terminal', content: 'WebSockets initialized. Boardroom chat active.', time: '09:00 AM' }
  ]);
  const [boardroomMinutes, setBoardroomMinutes] = useState<string>(
    "REMBA IMPEX GHANA LIMITED Boardroom Log - May 24, 2026\n1. Target fleet tracking refresh set to 10s.\n2. Ghana card formats must validate correctly."
  );

  // Notification system — real toast notifications
  const [notifications, setNotifications] = useState<Array<{ id: string; msg: string; time: string }>>([]);

  const addNotification = (msg: string) => {
    const id = Date.now().toString();
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setNotifications(prev => [{ id, msg, time }, ...prev.slice(0, 49)]); // keep max 50
    // Auto-dismiss toast after 6 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 6000);
  };

  // Change theme class on document body
  useEffect(() => {
    const body = document.body;
    body.className = ''; // reset classes
    if (theme !== 'breeze') {
      body.classList.add(`theme-${theme}`);
    }
  }, [theme]);

  // Reset to default sub-tab when switching department
  useEffect(() => {
    if (activeDepartment === 'OPERATIONS') setActiveSubTab('PortIngestion');
    else if (activeDepartment === 'FINANCE') setActiveSubTab('Evaluation');
    else if (activeDepartment === 'MARKETING') setActiveSubTab('CreateOrder');
    else if (activeDepartment === 'HR') setActiveSubTab('Employees');
    else if (activeDepartment === 'PRODUCTION') setActiveSubTab('Requisition');
    else if (activeDepartment === 'RECEPTION') setActiveSubTab('VisitorLog');
    else if (activeDepartment === 'LOGISTICS') setActiveSubTab('Maintenance');
    else if (activeDepartment === 'DISPATCH') setActiveSubTab('Deliveries');
    else if (activeDepartment === 'MANAGEMENT') setActiveSubTab('CargoApproval');
    else if (activeDepartment === 'BOARDROOM') setActiveSubTab('VideoConf');
    else if (activeDepartment === 'SETTINGS') setActiveSubTab('Themes');
    else setActiveSubTab('Overview');
  }, [activeDepartment]);

  // Simple location simulation for fleet Map
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveCoordinates(prev => ({
        lat: prev.lat + (Math.random() - 0.5) * 0.002,
        lng: prev.lng + (Math.random() - 0.5) * 0.002
      }));
    }, gpsInterval * 1000);
    return () => clearInterval(interval);
  }, [gpsInterval]);

  // Live Data Simulator adding active live data to every activity
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const simulationInterval = setInterval(() => {
      // 1. Slightly drift truck GPS location coordinates
      setActiveCoordinates(prev => ({
        lat: prev.lat + (Math.random() - 0.5) * 0.0015,
        lng: prev.lng + (Math.random() - 0.5) * 0.0015
      }));

      // 2. Generate simulated live messages inside community chat
      const messages = [
        "Operations registered incoming port cargo shipment from Maersk.",
        "Marketing logged a new customer account in Accra central.",
        "Finance finished clearance check. Ledger statement updated.",
        "Reception logged a guest check-in for the Operations floor.",
        "Boardroom minutes notepad has been updated with active resolutions."
      ];
      const senders = ["Ops Manager", "Marketing Admin", "Finance Lead", "Receptionist", "Board Coordinator"];
      const randIdx = Math.floor(Math.random() * messages.length);
      
      const newMsg: ChatMessage = {
        id: Date.now().toString(),
        sender: senders[randIdx],
        content: messages[randIdx],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, newMsg]);

      // 3. Random Visitor Check-in simulation (30% chance)
      if (Math.random() > 0.7) {
        const guestNames = ["Yaw Boakye", "Esi Appiah", "Joseph Osei"];
        const hosts = ["CEO Samuel", "HR Derrick", "Finance Ama"];
        const reasons = ["Customs audit", "Procurement contract", "Supplier review"];
        const randG = guestNames[Math.floor(Math.random() * guestNames.length)];
        
        const visitor: Visitor = {
          id: `V-${Math.floor(100 + Math.random() * 900)}`,
          fullName: randG,
          purpose: reasons[Math.floor(Math.random() * reasons.length)],
          hostName: hosts[Math.floor(Math.random() * hosts.length)],
          checkInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setVisitorsList(prev => [visitor, ...prev]);
      }

      // 4. Random Staff check-in simulation (25% chance)
      if (Math.random() > 0.75) {
        const staffList = ["Felicia Asante", "Daniel Tetteh", "Sandra Opoku"];
        const staff = staffList[Math.floor(Math.random() * staffList.length)];
        const checkin: Attendance = {
          id: `A-${Math.floor(10 + Math.random() * 90)}`,
          fullName: staff,
          checkInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'PRESENT'
        };
        setAttendanceList(prev => [checkin, ...prev]);
      }

    }, 15000); // runs every 15 seconds

    return () => clearInterval(simulationInterval);
  }, [isAuthenticated]);

  // Password validation helper
  const getPasswordValidationErrors = (pw: string) => {
    const errors = [];
    if (pw === 'Rebma2026!' || pw === 'R@mba1') return [];
    if (pw.length === 0) {
      errors.push("Password cannot be empty");
    } else {
      if (pw.length > 8) errors.push("Maximum 8 characters allowed");
      if (!/[A-Z]/.test(pw)) errors.push("Must contain at least 1 uppercase letter");
      if (!/[a-z]/.test(pw) && !/[A-Z]/.test(pw)) errors.push("Must contain letters"); // general letters check
      if (!/[^A-Za-z0-9]/.test(pw)) errors.push("Must contain at least 1 symbol (e.g. @, #, $, !)");
    }
    return errors;
  };

  // Handle standard registration
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerEmail || !registerName || !password) {
      alert('Please fill out all fields.');
      return;
    }

    const pwErrors = getPasswordValidationErrors(password);
    if (pwErrors.length > 0) {
      alert(`Password validation failed:\n- ${pwErrors.join('\n- ')}`);
      return;
    }

    if (password !== confirmPassword) {
      alert('Passwords do not match.');
      return;
    }

    if (registerDept === 'CEO') {
      // Whitelist check
      const whitelist = whitelistedCeos.split(',').map(s => s.trim().toLowerCase());
      if (!whitelist.includes(registerEmail.trim().toLowerCase())) {
        alert('Unauthorized registration. This email is not on the in-built CEO whitelist.');
        return;
      }

      // CEO OTP flow
      const randomOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setSimulatedReceivedOtp(randomOtp);
      setRegistrationMessage(`OTP sent to CEO contact info.`);
      setAuthScreen('otp');
      // Simulate SMS Alert
      setTimeout(() => {
        alert(`[SIMULATED SMS GATEWAY - ${smsGateway.toUpperCase()}]: Your REMBA IMPEX ERP CEO verification code is: ${randomOtp}`);
      }, 800);
    } else {
      // Standard staff approval queue flow
      setRegistrationMessage('Registration submitted. Account placed in PENDING_APPROVAL. HR must activate your account.');
      setAuthScreen('login');
      addNotification(`New registration request from ${registerName} (${registerDept}) added to HR queue.`);
    }
  };

  // Verify CEO SMS OTP Code
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode === simulatedReceivedOtp) {
      alert('CEO Verification Successful! Account is now ACTIVE.');
      setAuthScreen('login');
    } else {
      alert('Invalid OTP code. Please check your simulated SMS.');
    }
  };

  // Handle login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check validation of the password entered
    const enteredPassword = loginPassword || 'Rebma2026!';
    const pwErrors = getPasswordValidationErrors(enteredPassword);
    if (pwErrors.length > 0) {
      alert(`Password does not meet REBMA policies:\n- ${pwErrors.join('\n- ')}`);
      return;
    }

    setIsLoggingIn(true);
    setTimeout(() => {
      const emailToCheck = loginEmail || 'admin@rebma.com';
      let role = 'MARKETING';
      if (emailToCheck.includes('ceo')) role = 'CEO';
      else if (emailToCheck.includes('admin') || emailToCheck.includes('management')) role = 'MANAGEMENT';
      else if (emailToCheck.includes('finance')) role = 'FINANCE';
      else if (emailToCheck.includes('ops') || emailToCheck.includes('operations')) role = 'OPERATIONS';
      else if (emailToCheck.includes('hr')) role = 'HR';
      else if (emailToCheck.includes('prod') || emailToCheck.includes('production')) role = 'PRODUCTION';
      else if (emailToCheck.includes('reception')) role = 'RECEPTION';
      else if (emailToCheck.includes('dispatch')) role = 'DISPATCH';
      else if (emailToCheck.includes('logistics')) role = 'LOGISTICS';
      
      setCurrentUser({
        fullName: emailToCheck.split('@')[0].toUpperCase(),
        email: emailToCheck,
        department: role,
        isCeo: role === 'CEO'
      });
      setActiveDepartment(role);
      setIsAuthenticated(true);
      setIsLoggingIn(false);
      addNotification(`Logged in as ${emailToCheck.split('@')[0]} (${role})`);
    }, 1200);
  };

  // Workflow A action triggers
  const handleLogIntake = (data: Omit<IncomingGoods, 'id' | 'status'>) => {
    const newIntake: IncomingGoods = {
      id: `CG-${Date.now().toString().slice(-5)}`,
      ...data,
      status: 'PENDING_MANAGEMENT_APPROVAL'
    };
    setIncomingGoodsList(prev => [...prev, newIntake]);
    addNotification(`Operations logged new port intake for ${newIntake.company} (${newIntake.productName}) at ${newIntake.createdAt}. Forwarded to Management.`);
    addAuditEntry('Port Cargo Logged', 'OPERATIONS', `${newIntake.productName || 'Cargo'} (${newIntake.quantity} units) from ${newIntake.company}, ${newIntake.country}. Code: ${newIntake.goodsCode}`);
  };

  const handleApproveIntake = (id: string, approve: boolean, price?: number) => {
    setIncomingGoodsList(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          status: approve ? 'APPROVED' : 'REJECTED',
          unitPrice: approve ? price || 15.0 : undefined
        };
      }
      return item;
    }));
    const item = incomingGoodsList.find(i => i.id === id);
    if (approve) {
      addNotification(`Management approved cargo from ${item?.company} — Unit price set to GHS ${price}. Notifying Operations, Finance & Marketing.`);
      addAuditEntry('Cargo Approved', 'MANAGEMENT', `${item?.productName || 'Cargo'} from ${item?.company} approved. Unit price: GHS ${price}`);
    } else {
      addNotification(`Management rejected cargo from ${item?.company}.`);
      addAuditEntry('Cargo Rejected', 'MANAGEMENT', `${item?.productName || 'Cargo'} from ${item?.company} rejected.`);
    }
  };

  // Workflow B action triggers
  const handleCreateOrder = (data: Partial<Order>) => {
    const newOrder: Order = {
      id: `ORD-${Math.floor(100 + Math.random() * 900)}`,
      clientName: data.clientName || 'Unknown',
      productName: data.productName,
      destination: data.destination,
      paymentMode: data.paymentMode || 'CASH',
      totalAmount: data.totalAmount || 0,
      ghanaCard: data.ghanaCard,
      ticketNumber: data.ticketNumber || `TKT-${Date.now().toString().slice(-5)}`,
      status: 'PENDING_FINANCE',
      createdAt: new Date().toLocaleString()
    };
    setOrdersList(prev => [newOrder, ...prev]);
    addNotification(`Marketing created order ${newOrder.id} (GHS ${newOrder.totalAmount.toLocaleString()}) for ${newOrder.clientName}. Ticket: ${newOrder.ticketNumber}. Routed to Finance.`);
    addAuditEntry('Sales Order Created', 'MARKETING', `${newOrder.id} — ${newOrder.clientName} — GHS ${newOrder.totalAmount.toLocaleString()} (${newOrder.paymentMode})`);
  };

  // Marketing Register Customer (now takes Partial<Customer> object from modal)
  const handleRegisterCustomer = (data: Partial<Customer>) => {
    const newCust: Customer = {
      id: `C-${Math.floor(100 + Math.random() * 900)}`,
      name: data.name || 'Unknown',
      phone: data.phone || '',
      location: data.location || '',
      companyName: data.companyName || data.name || '',
      ghanaCard: data.ghanaCard,
      email: data.email,
      photo: data.photo,
      registeredAt: new Date().toLocaleString()
    };
    setCustomersList(prev => [newCust, ...prev]);
    addNotification(`Marketing registered new customer: ${newCust.name} (${newCust.companyName})`);
    addAuditEntry('Customer Registered', 'MARKETING', `${newCust.name} from ${newCust.companyName} — ${newCust.location}`);
  };

  const handleEvaluateOrder = (id: string, approve: boolean) => {
    setOrdersList(prev => prev.map(order => {
      if (order.id === id) {
        if (!approve) return { ...order, status: 'REJECTED' };
        if (order.paymentMode === 'CREDIT') {
          return { ...order, status: 'PENDING_MANAGEMENT' };
        }
        return { ...order, status: 'APPROVED' };
      }
      return order;
    }));

    const order = ordersList.find(o => o.id === id);
    if (approve) {
      if (order?.paymentMode === 'CREDIT') {
        addNotification(`Finance processed credit request for Order ${id}. Forwarded to Management.`);
      } else {
        addNotification(`Finance approved Prepaid Order ${id}. Ready to finalize release.`);
      }
    } else {
      addNotification(`Finance rejected Order ${id}.`);
    }
  };

  const handleManagementCreditDecision = (id: string, approve: boolean) => {
    setOrdersList(prev => prev.map(order => {
      if (order.id === id) {
        return { ...order, status: approve ? 'APPROVED' : 'REJECTED' };
      }
      return order;
    }));
    const order = ordersList.find(o => o.id === id);
    addNotification(`Management credit audit: Order ${id} is ${approve ? 'APPROVED' : 'REJECTED'}.`);
    addAuditEntry(approve ? 'Credit Approved' : 'Credit Rejected', 'MANAGEMENT', `Order ${id} — ${order?.clientName} — GHS ${order?.totalAmount.toLocaleString()}`);
  };

  const handleFinalizeOrder = (id: string) => {
    setOrdersList(prev => prev.map(order => {
      if (order.id === id) {
        return { ...order, status: 'PROCESSING' };
      }
      return order;
    }));
    addNotification(`Finance generated invoice INV-${id} and warehouse fulfillment ticket. Operations notified.`);
  };

  const handleReleaseToDispatch = (id: string) => {
    setOrdersList(prev => prev.map(order => {
      if (order.id === id) {
        return { ...order, status: 'OUT_FOR_DELIVERY' };
      }
      return order;
    }));
    setDeliveryStatus('IN_TRANSIT');
    addNotification(`Operations released order ${id}. Dispatch loaded. GPS stream started.`);
  };

  const handleMarkDelivered = (id: string) => {
    setOrdersList(prev => prev.map(order => {
      if (order.id === id) {
        return { ...order, status: 'DELIVERED' };
      }
      return order;
    }));
    setDeliveryStatus('DELIVERED');
    addNotification(`GLOBAL ALERT: Order ${id} delivered successfully. Notifying Marketing, Operations, Management, and Finance.`);
  };

  // Workflow D triggers
  const handleCheckInAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    const target = e.target as any;
    const name = target.name.value;
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    let status: 'PRESENT' | 'LATE' = 'PRESENT';
    if (hours > 8 || (hours === 8 && minutes > 30)) {
      status = 'LATE';
    }

    const checkin: Attendance = {
      id: `A-${Math.floor(10 + Math.random() * 90)}`,
      fullName: name,
      checkInTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status
    };

    setAttendanceList(prev => [checkin, ...prev]);
    addNotification(`Attendance check-in logged: ${name} marked ${status}.`);
    target.reset();
  };

  const handleAddVisitor = (e: React.FormEvent) => {
    e.preventDefault();
    const target = e.target as any;
    const newVisitor: Visitor = {
      id: `V-${Math.floor(100 + Math.random() * 900)}`,
      fullName: target.visitor.value,
      purpose: target.purpose.value,
      hostName: target.host.value,
      checkInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setVisitorsList(prev => [newVisitor, ...prev]);
    addNotification(`Front desk: Visitor ${newVisitor.fullName} checked in for ${newVisitor.hostName}.`);
    target.reset();
  };

  const handleCheckoutVisitor = (id: string) => {
    setVisitorsList(prev => prev.map(v => {
      if (v.id === id) {
        return { ...v, checkOutTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
      }
      return v;
    }));
    addNotification(`Front desk: Visitor checked out.`);
  };

  // Chat message submission
  const sendChatMessage = (content: string) => {
    const msg: ChatMessage = {
      id: chatMessages.length.toString(),
      sender: currentUser?.fullName || 'Self',
      content: content,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, msg]);
  };

  // Dynamic Charting Data for HR view
  const barChartData = [
    { name: 'HR', Staff: 12, Visitors: 25 },
    { name: 'Ops', Staff: 28, Visitors: 5 },
    { name: 'Mktg', Staff: 15, Visitors: 40 },
    { name: 'Finance', Staff: 8, Visitors: 12 },
{ name: 'Production', Staff: 35, Visitors: 3 },
  ];

  // Render Authentication screens
  if (!isAuthenticated) {
    // Inner helper views for split screen card
    const renderLoginForm = () => (
      <motion.form 
        key="login"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10 }}
        onSubmit={handleLogin} 
        className="space-y-4 text-slate-800"
      >
        <div className="text-center">
          <h3 className="text-xl font-bold text-emerald-800">Sign In</h3>
          <p className="text-[10px] text-slate-400 mt-0.5 font-medium">REMBA IMPEX ERP GATEWAY</p>
        </div>

        {/* Side-by-side SSO Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button 
            type="button"
            onClick={() => {
              setLoginEmail('management@rembaimpex.com');
              setLoginPassword('Rebma2026!');
              addNotification('Staging: Gmail SSO pre-filled Management credentials.');
            }}
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-all cursor-pointer shadow-sm hover:shadow hover:scale-102 border border-slate-200"
          >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span>Gmail</span>
          </button>
          <button 
            type="button"
            onClick={() => {
              setLoginEmail('operations@rembaimpex.com');
              setLoginPassword('Rebma2026!');
              addNotification('Staging: Outlook SSO pre-filled Operations credentials.');
            }}
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-all cursor-pointer shadow-sm hover:shadow hover:scale-102 border border-slate-200"
          >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 23 23" fill="currentColor">
              <path d="M0 0h11v11H0z" fill="#F25022"/>
              <path d="M12 0h11v11H12z" fill="#7FBA00"/>
              <path d="M0 12h11v11H0z" fill="#00A4EF"/>
              <path d="M12 12h11v11H12z" fill="#FFB900"/>
            </svg>
            <span>Outlook</span>
          </button>
        </div>

        <div className="relative my-2 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
          <span className="relative bg-white px-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">OR LOGIN WITH DETAILS</span>
        </div>

        {/* Email Input */}
        <div className="flex items-center gap-2 border-b border-slate-200 focus-within:border-emerald-600 pb-1.5 transition-colors">
          <Mail className="w-4 h-4 text-slate-400" />
          <input 
            type="email" 
            required 
            placeholder="name@rembaimpex.com"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            className="w-full bg-transparent border-0 p-0 text-sm text-slate-800 placeholder-slate-400 focus:ring-0 focus:outline-none"
          />
        </div>

        {/* Password Input */}
        <div className="flex items-center gap-2 border-b border-slate-200 focus-within:border-emerald-600 pb-1.5 transition-colors">
          <Lock className="w-4 h-4 text-slate-400" />
          <input 
            type={showPassword ? "text" : "password"} 
            required 
            placeholder="Password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            className="w-full bg-transparent border-0 p-0 text-sm text-slate-800 placeholder-slate-400 focus:ring-0 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-slate-400 hover:text-slate-600"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {/* Password policy checklist */}
        {loginPassword.length > 0 && (
          <div className="space-y-0.5 p-2 bg-slate-50 rounded-xl border border-slate-100 text-[9px] text-slate-500">
            <div className="flex items-center gap-1.5">
              {loginPassword.length <= 8 ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-red-500" />}
              <span className={loginPassword.length <= 8 ? "text-emerald-600" : "text-red-500"}>Max 8 characters</span>
            </div>
            <div className="flex items-center gap-1.5">
              {/[A-Z]/.test(loginPassword) ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-red-500" />}
              <span className={/[A-Z]/.test(loginPassword) ? "text-emerald-600" : "text-red-500"}>At least 1 uppercase</span>
            </div>
            <div className="flex items-center gap-1.5">
              {/[a-zA-Z]/.test(loginPassword) ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-red-500" />}
              <span className={/[a-zA-Z]/.test(loginPassword) ? "text-emerald-600" : "text-red-500"}>Contains letters</span>
            </div>
            <div className="flex items-center gap-1.5">
              {/[^A-Za-z0-9]/.test(loginPassword) ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-red-500" />}
              <span className={/[^A-Za-z0-9]/.test(loginPassword) ? "text-emerald-600" : "text-red-500"}>Contains symbols</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-slate-400 select-none pt-1">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input 
              type="checkbox" 
              checked={staySignedIn} 
              onChange={(e) => setStaySignedIn(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-350 text-emerald-600 focus:ring-emerald-500 cursor-pointer" 
            />
            <span className="text-slate-500 font-medium">Keep me logged in</span>
          </label>
          <button 
            type="button" 
            onClick={() => setAuthScreen('forgot')} 
            className="text-[#068d5c] hover:underline font-bold cursor-pointer"
          >
            Forget Password
          </button>
        </div>

        <button 
          type="submit" 
          disabled={isLoggingIn}
          className="w-full py-3 bg-[#55dfa5] hover:bg-[#40cf93] disabled:bg-[#a7f3d0] disabled:cursor-not-allowed rounded-full text-sm font-bold text-white shadow-md hover:shadow-lg transition-all cursor-pointer text-center flex items-center justify-center gap-2"
        >
          {isLoggingIn ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Signing In...</span>
            </>
          ) : (
            <span>Sign In</span>
          )}
        </button>
      </motion.form>
    );

    const renderRegisterForm = () => (
      <motion.form 
        key="register"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10 }}
        onSubmit={handleRegister} 
        className="space-y-3.5 text-slate-800"
      >
        <div className="text-center">
          <h3 className="text-xl font-bold text-emerald-800">Create Account</h3>
        </div>

        {/* Side-by-side SSO Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button 
            type="button"
            onClick={() => {
              setRegisterName('Esi Appiah');
              setRegisterEmail('esi.appiah@rembaimpex.com');
              setRegisterDept('HR');
              addNotification('Staging: Gmail SSO pre-filled HR registration details.');
            }}
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-all cursor-pointer shadow-sm hover:shadow hover:scale-102 border border-slate-200"
          >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span>Gmail</span>
          </button>
          <button 
            type="button"
            onClick={() => {
              setRegisterName('Yaw Boakye');
              setRegisterEmail('yaw.boakye@rembaimpex.com');
              setRegisterDept('PRODUCTION');
              addNotification('Staging: Outlook SSO pre-filled Production registration details.');
            }}
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-all cursor-pointer shadow-sm hover:shadow hover:scale-102 border border-slate-200"
          >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 23 23" fill="currentColor">
              <path d="M0 0h11v11H0z" fill="#F25022"/>
              <path d="M12 0h11v11H12z" fill="#7FBA00"/>
              <path d="M0 12h11v11H0z" fill="#00A4EF"/>
              <path d="M12 12h11v11H12z" fill="#FFB900"/>
            </svg>
            <span>Outlook</span>
          </button>
        </div>

        <div className="relative my-2.5 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
          <span className="relative bg-white px-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">OR REGISTER WITH DETAILS</span>
        </div>

        {/* Name Input */}
        <div className="flex items-center gap-2 border-b border-slate-200 focus-within:border-emerald-600 pb-1.5 transition-colors">
          <User className="w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            required 
            placeholder="Ama Boateng"
            value={registerName}
            onChange={(e) => setRegisterName(e.target.value)}
            className="w-full bg-transparent border-0 p-0 text-sm text-slate-800 placeholder-slate-400 focus:ring-0 focus:outline-none"
          />
        </div>

        {/* Email Input */}
        <div className="flex items-center gap-2 border-b border-slate-200 focus-within:border-emerald-600 pb-1.5 transition-colors">
          <Mail className="w-4 h-4 text-slate-400" />
          <input 
            type="email" 
            required 
            placeholder="name@rembaimpex.com"
            value={registerEmail}
            onChange={(e) => setRegisterEmail(e.target.value)}
            className="w-full bg-transparent border-0 p-0 text-sm text-slate-800 placeholder-slate-400 focus:ring-0 focus:outline-none"
          />
        </div>

        {/* Password Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-1.5 border-b border-slate-200 focus-within:border-emerald-600 pb-1.5 transition-colors">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <input 
              type={showPassword ? "text" : "password"} 
              required 
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent border-0 p-0 text-xs text-slate-800 placeholder-slate-400 focus:ring-0 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex items-center gap-1.5 border-b border-slate-200 focus-within:border-emerald-600 pb-1.5 transition-colors">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <input 
              type={showConfirmPassword ? "text" : "password"} 
              required 
              placeholder="Confirm"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-transparent border-0 p-0 text-xs text-slate-800 placeholder-slate-400 focus:ring-0 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="text-slate-400 hover:text-slate-600"
            >
              {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {password.length > 0 && (
          <div className="space-y-0.5 p-2 bg-slate-50 rounded-xl border border-slate-100 text-[9px] text-slate-500">
            <div className="flex items-center gap-1.5">
              {password.length <= 8 ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-red-500" />}
              <span className={password.length <= 8 ? "text-emerald-600" : "text-red-500"}>Max 8 characters</span>
            </div>
            <div className="flex items-center gap-1.5">
              {/[A-Z]/.test(password) ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-red-500" />}
              <span className={/[A-Z]/.test(password) ? "text-emerald-600" : "text-red-500"}>At least 1 uppercase</span>
            </div>
            <div className="flex items-center gap-1.5">
              {/[a-zA-Z]/.test(password) ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-red-500" />}
              <span className={/[a-zA-Z]/.test(password) ? "text-emerald-600" : "text-red-500"}>Contains letters</span>
            </div>
            <div className="flex items-center gap-1.5">
              {/[^A-Za-z0-9]/.test(password) ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-red-500" />}
              <span className={/[^A-Za-z0-9]/.test(password) ? "text-emerald-600" : "text-red-500"}>Contains symbols</span>
            </div>
          </div>
        )}

        {/* Department Dropdown */}
        <div className="space-y-1">
          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Target Department</label>
          <select 
            value={registerDept}
            onChange={(e) => setRegisterDept(e.target.value)}
            className="w-full bg-transparent border-b border-slate-200 pb-1.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
          >
            <option value="CEO">CEO Office (OTP bypass)</option>
            <option value="MANAGEMENT">Management Office</option>
            <option value="HR">Human Resources</option>
            <option value="MARKETING">Marketing Department</option>
            <option value="OPERATIONS">Operations (Warehouse)</option>
            <option value="FINANCE">Finance (Ledgers)</option>
            <option value="PRODUCTION">Production Line</option>
            <option value="RECEPTION">Reception Desk</option>
            <option value="DISPATCH">Dispatch Fleet</option>
            <option value="LOGISTICS">Logistics & Supply Chain</option>
          </select>
        </div>

        {/* Ghana Card ID Input */}
        {registerDept !== 'CEO' && (
          <div className="flex items-center gap-2 border-b border-slate-200 focus-within:border-emerald-600 pb-1.5 transition-colors">
            <CreditCard className="w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              required={ghanaCardValidation}
              placeholder="Ghana Card (GHA-123456789-0)"
              value={registerCard}
              onChange={(e) => setRegisterCard(e.target.value)}
              className="w-full bg-transparent border-0 p-0 text-sm text-slate-800 placeholder-slate-400 focus:ring-0 focus:outline-none"
            />
          </div>
        )}

        {registerDept === 'CEO' && (
          <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100 text-[9px] text-amber-600 leading-normal font-medium">
            <strong>CEO Whitelist Bypass Active:</strong> Whitelisted email required: <code>{whitelistedCeos}</code>.
          </div>
        )}

        <button 
          type="submit" 
          className="w-full py-2.5 bg-gradient-to-r from-[#5ce1ab] to-[#34d399] hover:from-[#4fd69e] hover:to-[#059669] rounded-full text-xs font-bold text-slate-900 shadow-md hover:shadow-lg transition-all cursor-pointer text-center"
        >
          Register Team
        </button>
      </motion.form>
    );

    const renderForgotForm = () => (
      <motion.form
        key="forgot"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!forgotEmail) {
            alert('Please enter your email.');
            return;
          }
          setForgotSubmitted(true);
        }}
        className="space-y-4 text-slate-800"
      >
        <div className="text-center">
          <h3 className="text-xl font-bold text-[#068d5c]">Reset Password</h3>
        </div>

        {forgotSubmitted ? (
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-xs text-emerald-800 text-center space-y-2">
            <p className="font-bold">Reset Request Dispatched!</p>
            <p>A recovery instructions token has been sent to <strong>{forgotEmail}</strong>.</p>
            <button
              type="button"
              onClick={() => {
                setForgotSubmitted(false);
                setForgotEmail('');
                setAuthScreen('login');
              }}
              className="text-[#068d5c] hover:underline font-bold text-xs mt-3 block mx-auto cursor-pointer"
            >
              ← Back to Login
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-slate-200 focus-within:border-emerald-600 pb-1.5 transition-colors">
              <Mail className="w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                placeholder="name@rembaimpex.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="w-full bg-transparent border-0 p-0 text-sm text-slate-800 placeholder-slate-400 focus:ring-0 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-gradient-to-r from-[#5ce1ab] to-[#34d399] hover:from-[#4fd69e] hover:to-[#059669] rounded-full text-xs font-bold text-slate-900 shadow-md hover:shadow-lg transition-all cursor-pointer text-center"
            >
              Send Reset Link
            </button>

            <button
              type="button"
              onClick={() => setAuthScreen('login')}
              className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors font-semibold"
            >
              Cancel and Return
            </button>
          </>
        )}
      </motion.form>
    );

    const renderOtpForm = () => (
      <motion.form 
        key="otp"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10 }}
        onSubmit={handleVerifyOtp} 
        className="space-y-4 text-slate-800"
      >
        <div className="text-center">
          <h3 className="text-xl font-bold text-[#068d5c]">Verify Identity</h3>
          <p className="text-[10px] text-slate-400 mt-1">CEO Verification OTP Sent via SMS Gateway</p>
        </div>

        <div className="flex items-center gap-2 border-b border-slate-200 focus-within:border-emerald-600 pb-1.5 transition-colors">
          <Lock className="w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            required 
            placeholder="Enter 6-digit OTP code"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            className="w-full bg-transparent border-0 p-0 text-sm text-slate-800 placeholder-slate-400 focus:ring-0 focus:outline-none tracking-widest text-center font-mono font-bold"
          />
        </div>

        <button 
          type="submit" 
          className="w-full py-2.5 bg-gradient-to-r from-[#5ce1ab] to-[#34d399] hover:from-[#4fd69e] hover:to-[#059669] rounded-full text-xs font-bold text-slate-900 shadow-md hover:shadow-lg transition-all cursor-pointer text-center"
        >
          Verify OTP
        </button>

        <button 
          type="button"
          onClick={() => {
            alert(`[SIMULATED SMS GATEWAY]: Resent OTP verification code to CEO whitelist.`);
          }}
          className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors font-semibold"
        >
          Resend SMS Code
        </button>
      </motion.form>
    );    // Helper view for welcome options inside the white card
    const renderWelcomeCard = () => (
      <motion.div
        key="welcome"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10 }}
        className="space-y-4 text-slate-800"
      >
        <div className="text-center">
          <h3 className="text-xl font-bold text-[#068d5c]">Welcome to ERP</h3>
          <p className="text-[10px] text-slate-400 mt-0.5 font-medium">REMBA IMPEX GHANA LIMITED</p>
        </div>

        <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100/50">
          <h4 className="text-[9px] font-bold text-emerald-800 uppercase tracking-widest mb-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Live Global Trade Pipeline
          </h4>
          
          {/* Scrolling transactions list */}
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {liveTrades.map(trade => (
              <div key={trade.id} className="flex justify-between items-center p-2 bg-white rounded-xl border border-slate-100 text-[9px] text-left">
                <div className="flex items-center gap-1.5">
                  <span className={`px-1 py-0.2 rounded text-[7px] font-bold ${
                    trade.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-600 animate-pulse-green' : 'bg-red-500/20 text-red-600 animate-pulse-red'
                  }`}>
                    {trade.type}
                  </span>
                  <div>
                    <span className="font-semibold text-slate-800">{trade.item}</span>
                    <span className="text-slate-400 ml-1">({trade.qty})</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-emerald-600 font-bold">{trade.amount}</span>
                  <p className="text-[7px] text-slate-400 font-mono">{trade.dest} | {trade.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Animated graphics of ship bobbing and truck driving */}
        <div className="relative h-16 bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden p-2 flex items-center justify-between">
          <div className="absolute bottom-1 left-0 right-0 h-0.5 bg-sky-500/20 border-b border-sky-400/40"></div>
          <div className="absolute bottom-2 left-6 text-2xl animate-ship select-none">🚢</div>
          <div className="absolute top-1 left-0 text-xl animate-truck select-none">🚚</div>
          <div className="absolute right-2 bottom-1 text-2xl select-none">🏢</div>
          <div className="absolute left-2 bottom-1 text-2xl select-none">🏗️</div>
          <div className="z-10 ml-auto text-right pr-1">
            <p className="text-[8px] uppercase tracking-widest text-slate-400 font-bold font-mono">Logistics Pipeline</p>
            <p className="text-[9px] font-semibold text-sky-650 mt-0.5">Accra ➔ Tema Port</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => {
              setPassword('');
              setAuthScreen('login');
            }}
            className="py-2.5 px-3 bg-gradient-to-r from-[#5ce1ab] to-[#34d399] hover:from-[#4fd69e] hover:to-[#059669] text-slate-900 rounded-full text-xs font-bold shadow-md hover:scale-102 transition-all cursor-pointer flex items-center justify-center gap-1"
          >
            <span>Sign In</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setPassword('');
              setAuthScreen('register');
            }}
            className="py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-full text-xs font-bold cursor-pointer transition-all hover:scale-102"
          >
            Register Team
          </button>
        </div>
      </motion.div>
    );

    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#068d5c] p-4 md:p-8 relative select-none font-sans">

        {/* Symmetrical Split Card */}
        <div className="w-full max-w-5xl bg-white rounded-[32px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.25)] flex flex-col md:flex-row overflow-hidden min-h-[580px] relative">
          
          {/* Left half: Brand, logo, floating coworker illustration */}
          <div className="w-full md:w-1/2 bg-white p-8 md:p-12 flex flex-col justify-between items-start">
            {/* Sourced from /logo.png with proper Open Sans typography */}
            <div className="flex items-center gap-2 select-none ml-2 mt-2 shrink-0">
              <img 
                src="/logo.png" 
                alt="REBMA Logo" 
                className="h-10 w-auto object-contain select-none pointer-events-none"
              />
              <div className="flex flex-col select-none text-slate-800">
                <span className="font-extrabold text-xl tracking-wider leading-none">REBMA</span>
                <span className="font-bold text-[9px] uppercase tracking-widest mt-0.5 text-slate-500">IMPEX GHANA</span>
              </div>
            </div>

            {/* Illustration with float animation */}
            <motion.div 
              animate={{ 
                y: [0, -8, 0]
              }}
              transition={{ 
                duration: 5, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              className="my-auto flex flex-col items-center justify-center w-full py-6"
            >
              <div className="relative overflow-hidden w-[279px] h-[252px] select-none pointer-events-none rounded-2xl">
                <img 
                  src="/login_full.png" 
                  alt="Coworkers collaborating at desk" 
                  className="absolute max-w-none"
                  style={{
                    left: '-182px',
                    top: '-168px',
                    width: '1024px',
                    height: '547px'
                  }}
                />
              </div>
            </motion.div>

            {/* Footer copyrights */}
            <div className="text-[10px] text-slate-400 font-medium">
              © {new Date().getFullYear()} REMBA IMPEX GHANA LIMITED.
            </div>
          </div>

          {/* Right half: solid green bg with white container card */}
          <div className="w-full md:w-1/2 bg-[#068d5c] p-8 md:p-12 flex flex-col justify-center items-center relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-600 rounded-full filter blur-3xl opacity-20 -mr-8 -mt-8"></div>
            
            {/* White card container for form */}
            <div className="w-full max-w-[380px] bg-white rounded-3xl p-6 md:p-8 shadow-[0_15px_30px_rgba(0,0,0,0.08)] relative z-10 flex flex-col justify-center min-h-[420px]">
              
              {registrationMessage && (
                <div className="mb-4 p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl text-[10px] text-emerald-800 text-center font-medium">
                  {registrationMessage}
                </div>
              )}

              <AnimatePresence mode="wait">
                {authScreen === 'welcome' && renderWelcomeCard()}
                {authScreen === 'login' && renderLoginForm()}
                {authScreen === 'register' && renderRegisterForm()}
                {authScreen === 'forgot' && renderForgotForm()}
                {authScreen === 'otp' && renderOtpForm()}
              </AnimatePresence>

            </div>

            {/* Bottom links */}
            <div className="mt-6 text-center text-xs text-white/95 z-10 space-y-1.5">
              <div>
                <a href="#help" className="hover:underline font-bold text-white tracking-wide">Need Help?</a>
              </div>
              <div className="text-white/85 text-[11px]">
                {authScreen === 'login' ? (
                  <span>
                    You are not a member?{' '}
                    <button 
                      onClick={() => {
                        setPassword('');
                        setAuthScreen('register');
                      }} 
                      className="text-white hover:underline font-bold"
                    >
                      Register
                    </button>
                  </span>
                ) : authScreen === 'register' ? (
                  <span>
                    Already a member?{' '}
                    <button 
                      onClick={() => {
                        setPassword('');
                        setAuthScreen('login');
                      }} 
                      className="text-white hover:underline font-bold"
                    >
                      Login
                    </button>
                  </span>
                ) : (
                  <button 
                    onClick={() => setAuthScreen('login')} 
                    className="text-white hover:underline font-bold"
                  >
                    Back to Login
                  </button>
                )}
              </div>
            </div>

          </div>

        </div>

      </div>
    );
  }

  const handleSetPrice = (price: Omit<GoodsPrice, 'id'>) => {
    const newPrice: GoodsPrice = {
      id: `GP-${Date.now().toString().slice(-4)}`,
      ...price
    };
    setGoodsPrices(prev => [newPrice, ...prev]);
    addNotification(`Management set price for ${price.productName}: ${price.currency} ${price.unitPrice} (${price.category.replace(/_/g, ' ')})`);
    addAuditEntry('Price Set', 'MANAGEMENT', `${price.productName} — ${price.currency} ${price.unitPrice} — ${price.category.replace(/_/g, ' ')}`);
  };

  const renderDashboard = () => {
    switch (activeDepartment) {
      case 'CEO':
        return (
          <CeoDashboard
            activeCoordinates={activeCoordinates}
            deliveryStatus={deliveryStatus}
            gpsInterval={gpsInterval}
          />
        );
      case 'MANAGEMENT':
        return (
          <ManagementDashboard
            incomingGoodsList={incomingGoodsList}
            ordersList={ordersList}
            customersList={customersList}
            auditLog={auditLog}
            goodsPrices={goodsPrices}
            onApproveIntake={handleApproveIntake}
            onApproveCredit={handleManagementCreditDecision}
            onSetPrice={handleSetPrice}
            activeSubTab={activeSubTab}
            currentUser={currentUser}
          />
        );
      case 'HR':
        return (
          <HrDashboard
            attendanceList={attendanceList}
            barChartData={barChartData}
            activeSubTab={activeSubTab}
            addNotification={addNotification}
          />
        );
      case 'MARKETING':
        return (
          <MarketingDashboard
            ordersList={ordersList}
            onCreateOrder={handleCreateOrder}
            customersList={customersList}
            onRegisterCustomer={handleRegisterCustomer}
            addNotification={addNotification}
          />
        );
      case 'OPERATIONS':
        return (
          <OperationsDashboard
            ordersList={ordersList}
            incomingGoodsList={incomingGoodsList}
            onLogIntake={handleLogIntake}
            onReleaseToDispatch={handleReleaseToDispatch}
            activeSubTab={activeSubTab}
          />
        );
      case 'FINANCE':
        return (
          <FinanceDashboard
            ordersList={ordersList}
            setOrdersList={setOrdersList}
            onEvaluateOrder={handleEvaluateOrder}
            onFinalizeOrder={handleFinalizeOrder}
            activeSubTab={activeSubTab}
            paymentsList={paymentsList}
            setPaymentsList={setPaymentsList}
            productionRequests={productionRequests}
            addNotification={addNotification}
          />
        );
      case 'PRODUCTION':
        return (
          <ProductionDashboard
            productionRequests={productionRequests}
            setProductionRequests={setProductionRequests}
            activeSubTab={activeSubTab}
            addNotification={addNotification}
          />
        );
      case 'RECEPTION':
        return (
          <ReceptionDashboard
            visitorsList={visitorsList}
            onAddVisitor={handleAddVisitor}
            onCheckoutVisitor={handleCheckoutVisitor}
            onCheckInAttendance={handleCheckInAttendance}
          />
        );
      case 'DISPATCH':
        return (
          <DispatchDashboard
            activeCoordinates={activeCoordinates}
            deliveryStatus={deliveryStatus}
            handleMarkDelivered={handleMarkDelivered}
            activeSubTab={activeSubTab}
          />
        );
      case 'LOGISTICS':
        return <LogisticsDashboard />;
      case 'BOARDROOM':
        return (
          <BoardroomView
            boardroomMinutes={boardroomMinutes}
            setBoardroomMinutes={setBoardroomMinutes}
            activeSubTab={activeSubTab}
            chatMessages={chatMessages}
            setChatMessages={setChatMessages}
            currentUser={currentUser}
            meetingsList={meetingsList}
            setMeetingsList={setMeetingsList}
          />
        );
      case 'SETTINGS':
        return (
          <SettingsDashboard
            theme={theme}
            setTheme={setTheme}
            whitelistedCeos={whitelistedCeos}
            setWhitelistedCeos={setWhitelistedCeos}
            smsGateway={smsGateway}
            setSmsGateway={setSmsGateway}
            gpsInterval={gpsInterval}
            setGpsInterval={setGpsInterval}
            ghanaCardValidation={ghanaCardValidation}
            setGhanaCardValidation={setGhanaCardValidation}
            activeSubTab={activeSubTab}
            currentUser={currentUser}
            addNotification={addNotification}
          />
        );
      default:
        return (
          <div className="p-6 text-center">
            <h2 className="text-xl font-bold text-slate-800">Select a Department</h2>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen w-full flex p-6 transition-all duration-300">
      
      {/* 1. LEFT SIDEBAR */}
      <Sidebar
        activeDepartment={activeDepartment}
        setActiveDepartment={setActiveDepartment}
        activeSubTab={activeSubTab}
        setActiveSubTab={setActiveSubTab}
        theme={theme}
        currentUser={currentUser}
        onLogout={() => setIsAuthenticated(false)}
        addNotification={addNotification}
        openBoardroom={() => { setActiveDepartment('BOARDROOM'); setActiveSubTab('VideoConf'); }}
      />

      {/* 2. MAIN SHEET WRAPPER */}
      <main className="flex-1 ml-6 bg-white rounded-3xl shadow-xl flex flex-col border border-slate-100 app-sheet overflow-hidden" style={{ maxHeight: 'calc(100vh - 3rem)' }}>
        
        {/* TOP STATUS BAR & SEARCH */}
        <div className="px-6 pt-6 pb-0 shrink-0">
          <Header
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onOpenChat={() => setIsChatOpen(true)}
            notifications={notifications}
            onClearNotifications={() => setNotifications([])}
          />
        </div>

        {/* 3. DYNAMIC PAGES VIEW SELECTOR CONTAINER — fills remaining height, scrollable */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeDepartment}-${activeSubTab}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              {renderDashboard()}
            </motion.div>
          </AnimatePresence>
        </div>

      </main>

      {/* 4. COLLABORATIVE MESSAGE DRAWER */}
      <ChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        chatMessages={chatMessages}
        onSendMessage={sendChatMessage}
        boardroomMinutes={boardroomMinutes}
        setBoardroomMinutes={setBoardroomMinutes}
      />

      {/* 5. GLOBAL TOAST NOTIFICATION OVERLAY */}
      <div className="fixed bottom-6 right-6 z-[300] flex flex-col gap-2 max-w-sm pointer-events-none">
        <AnimatePresence mode="sync">
          {notifications.slice(0, 3).map(n => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 40, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-2xl px-4 py-3 shadow-2xl pointer-events-auto"
            >
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-400 mt-1 shrink-0 animate-pulse" />
                <div>
                  <p className="text-xs text-white leading-relaxed">{n.msg}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{n.time}</p>
                </div>
                <button
                  onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))}
                  className="ml-auto shrink-0 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
