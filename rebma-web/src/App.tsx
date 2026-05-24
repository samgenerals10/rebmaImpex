import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Check, X, ArrowRight, Lock, Mail, User, CreditCard } from 'lucide-react';

import type { Order, IncomingGoods, ProductionRequest, Visitor, Attendance, ChatMessage } from './types/erp';

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

interface Customer {
  id: string;
  name: string;
  phone: string;
  location: string;
  companyName: string;
  registeredAt: string;
}

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
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Multi-Step Registration UI
  const [authScreen, setAuthScreen] = useState<'welcome' | 'login' | 'register' | 'otp' | 'forgot'>('welcome');
  const [registerEmail, setRegisterEmail] = useState<string>('');
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
  const [staySignedIn, setStaySignedIn] = useState<boolean>(false);
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [forgotSubmitted, setForgotSubmitted] = useState<boolean>(false);
  
  // OAuth Popup Simulator State
  const [oauthPopup, setOauthPopup] = useState<{
    isOpen: boolean;
    provider: 'Google' | 'Microsoft';
    isRegister: boolean;
  } | null>(null);
  
  // Admin & Whitelist Settings
  const [whitelistedCeos, setWhitelistedCeos] = useState<string>('ceo@rembaimpex.com, ceo2@rembaimpex.com');
  const [smsGateway, setSmsGateway] = useState<string>('arkesel');
  const [gpsInterval, setGpsInterval] = useState<number>(10);
  const [ghanaCardValidation, setGhanaCardValidation] = useState<boolean>(true);

  // Workflow Data states
  const [incomingGoodsList, setIncomingGoodsList] = useState<IncomingGoods[]>([
    { id: '1', country: 'Cote d\'Ivoire', company: 'Socoopec', quantity: 200, weight: 15.4, discrepancies: 'None', status: 'PENDING_MANAGEMENT_APPROVAL' },
    { id: '2', country: 'Ecuador', company: 'Fruibest Ltd', quantity: 450, weight: 28.1, discrepancies: '2 damaged crates', status: 'APPROVED', unitPrice: 12.5 }
  ]);
  const [ordersList, setOrdersList] = useState<Order[]>([
    { id: 'ORD-101', clientName: 'Inter-Ghana Foods Ltd', paymentMode: 'CREDIT', totalAmount: 48000, status: 'PENDING_FINANCE', createdAt: '1 hour ago' },
    { id: 'ORD-102', clientName: 'Accra Retail Hub', paymentMode: 'CASH', totalAmount: 12000, status: 'DELIVERED', createdAt: '2 days ago' }
  ]);
  const [productionRequests, setProductionRequests] = useState<ProductionRequest[]>([
    { id: 'PRD-801', items: [{ materialName: 'Raw Polymer Granules', quantity: 5000 }], status: 'APPROVED' }
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
    { id: 'C-001', name: 'Kofi Owusu', phone: '+233 24 123 4567', location: 'Accra', companyName: 'Owusu Retail Hub', registeredAt: '2 hours ago' },
    { id: 'C-002', name: 'Abena Mansah', phone: '+233 20 987 6543', location: 'Kumasi', companyName: 'Mansah Wholesale Food', registeredAt: '1 day ago' }
  ]);

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

  const addNotification = (msg: string) => {
    console.log(`[ERP Notification]: ${msg}`);
  };

  // Change theme class on document body
  useEffect(() => {
    const body = document.body;
    body.className = ''; // reset classes
    if (theme !== 'breeze') {
      body.classList.add(`theme-${theme}`);
    }
  }, [theme]);

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
    const enteredPassword = password || 'R@mba1';
    const pwErrors = getPasswordValidationErrors(enteredPassword);
    if (pwErrors.length > 0) {
      alert(`Password does not meet REMBA policies:\n- ${pwErrors.join('\n- ')}`);
      return;
    }

    const userRole = registerEmail.includes('ceo') ? 'CEO' : registerDept;
    setCurrentUser({
      fullName: registerName || 'Samuel Remba',
      email: registerEmail || 'samuel@rembaimpex.com',
      department: userRole,
      isCeo: userRole === 'CEO'
    });
    setActiveDepartment(userRole);
    setIsAuthenticated(true);
    addNotification(`Logged in as ${registerName || 'Samuel Remba'} (${userRole})`);
  };

  // Handle OAuth Simulated click
  const handleOAuth = (provider: 'Google' | 'Microsoft', isRegister: boolean) => {
    setOauthPopup({ isOpen: true, provider, isRegister });
  };

  const handleSelectMockOAuthAccount = (account: { name: string; email: string; dept: string; isCeo: boolean }) => {
    setCurrentUser({
      fullName: account.name,
      email: account.email,
      department: account.isCeo ? 'CEO' : account.dept,
      isCeo: account.isCeo
    });
    setActiveDepartment(account.isCeo ? 'CEO' : account.dept);
    setIsAuthenticated(true);
    setOauthPopup(null);
    addNotification(`Authenticated via ${oauthPopup?.provider} as ${account.name} (${account.isCeo ? 'CEO' : account.dept})`);
  };

  // Workflow A action triggers
  const handleLogIntake = (e: React.FormEvent) => {
    e.preventDefault();
    const target = e.target as any;
    const newIntake: IncomingGoods = {
      id: (incomingGoodsList.length + 1).toString(),
      country: target.country.value,
      company: target.company.value,
      quantity: parseInt(target.quantity.value),
      weight: parseFloat(target.weight.value),
      discrepancies: target.discrepancies.value || 'None',
      status: 'PENDING_MANAGEMENT_APPROVAL'
    };
    setIncomingGoodsList(prev => [...prev, newIntake]);
    addNotification(`Operations logged new port intake for ${newIntake.company}. Forwarded to Management.`);
    target.reset();
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
      addNotification(`Management approved cargo from ${item?.company} and set unit price to $${price}. Sockets sent to Operations, Finance & Marketing.`);
    } else {
      addNotification(`Management rejected cargo from ${item?.company}.`);
    }
  };

  // Workflow B action triggers
  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const target = e.target as any;
    const amount = parseFloat(target.amount.value);
    const newOrder: Order = {
      id: `ORD-${Math.floor(100 + Math.random() * 900)}`,
      clientName: target.client.value,
      paymentMode: target.mode.value as any,
      totalAmount: amount,
      status: 'PENDING_FINANCE',
      createdAt: 'Just now'
    };
    setOrdersList(prev => [newOrder, ...prev]);
    addNotification(`Marketing logged order ${newOrder.id} ($${amount}) for ${newOrder.clientName}. Routed to Finance.`);
    target.reset();
  };

  // Marketing Register Customer
  const handleRegisterCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const target = e.target as any;
    const newCust: Customer = {
      id: `C-${Math.floor(100 + Math.random() * 900)}`,
      name: target.customerName.value,
      phone: target.phone.value,
      location: target.location.value,
      companyName: target.company.value,
      registeredAt: 'Just now'
    };
    setCustomersList(prev => [newCust, ...prev]);
    addNotification(`Marketing registered new customer: ${newCust.name} (${newCust.companyName})`);
    target.reset();
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
    addNotification(`Management credit audit: Order ${id} is ${approve ? 'APPROVED' : 'REJECTED'}.`);
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

  // Workflow C triggers
  const handleProductionRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const target = e.target as any;
    const newReq: ProductionRequest = {
      id: `PRD-${Math.floor(100 + Math.random() * 900)}`,
      items: [
        { materialName: target.material.value, quantity: parseInt(target.qty.value) }
      ],
      status: 'PENDING_MANAGEMENT'
    };
    setProductionRequests(prev => [...prev, newReq]);
    addNotification(`Production initiated material request ${newReq.id} on credit terms. Kept on hold by Finance.`);
    target.reset();
  };

  const handleApproveProductionRequest = (id: string) => {
    setProductionRequests(prev => prev.map(req => {
      if (req.id === id) return { ...req, status: 'APPROVED' };
      return req;
    }));
    addNotification(`Management approved factory production line credit release for ${id}.`);
  };

  const handleIssueReleaseTickets = (id: string) => {
    setProductionRequests(prev => prev.map(req => {
      if (req.id === id) return { ...req, status: 'TICKETS_ISSUED' };
      return req;
    }));
    addNotification(`Finance issued raw materials release tickets for ${id}. Operations floor ready for pickup.`);
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
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-radial from-[#0a2820] to-[#010806] p-6 relative">
        
        {/* Simulated OAuth Account Picker Popup */}
        {oauthPopup && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="text-center">
                <h3 className="text-lg font-bold text-white">Sign in with {oauthPopup.provider}</h3>
                <p className="text-xs text-slate-400 mt-1">Select an account to authorize REMBA IMPEX ERP</p>
              </div>
              <div className="space-y-2">
                {[
                  { name: 'Samuel Remba', email: 'samuel@rembaimpex.com', dept: 'CEO', isCeo: true },
                  { name: 'Ama Boateng', email: 'ama.b@rembaimpex.com', dept: 'FINANCE', isCeo: false },
                  { name: 'Frank Mensah', email: 'frank.m@rembaimpex.com', dept: 'OPERATIONS', isCeo: false },
                  { name: 'Kofi Owusu', email: 'kofi.o@rembaimpex.com', dept: 'MARKETING', isCeo: false },
                ].map((acc, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelectMockOAuthAccount(acc)}
                    className="w-full flex items-center gap-3 p-3 bg-slate-800 hover:bg-slate-750 rounded-xl text-left transition-all cursor-pointer border border-slate-700 hover:scale-102"
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-500/25 flex items-center justify-center font-bold text-emerald-400 text-xs">
                      {acc.name[0]}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white leading-none">{acc.name}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{acc.email}</p>
                    </div>
                    <span className="ml-auto text-[9px] px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-bold uppercase">{acc.isCeo ? 'CEO' : acc.dept}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setOauthPopup(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 rounded-xl text-xs font-semibold text-slate-400 cursor-pointer text-center border border-slate-700"
              >
                Cancel Authorization
              </button>
            </motion.div>
          </div>
        )}

        <motion.div 
          layout
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={`w-full ${authScreen === 'welcome' ? 'max-w-xl' : 'max-w-md'} bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden`}
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-600 rounded-full filter blur-3xl opacity-10 -mr-12 -mt-12"></div>
          
          <div className="flex flex-col items-center mb-6">
            <div className="p-3 bg-white/10 rounded-2xl border border-white/20 mb-3">
              <img 
                src="/logo.png" 
                className="w-12 h-12 object-contain" 
                alt="REMBA GHANA Logo" 
                onError={(e) => {
                  e.currentTarget.src = "https://placehold.co/60x60?text=REMBA";
                }}
              />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide text-center">REMBA IMPEX GHANA LIMITED</h1>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest text-center font-semibold font-mono">Enterprise Resource Planning Portal</p>
          </div>

          {registrationMessage && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 text-center">
              {registrationMessage}
            </div>
          )}

          <AnimatePresence mode="wait">
            {authScreen === 'welcome' && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="space-y-6 text-center"
              >
                <div className="p-4 bg-emerald-950/30 border border-emerald-800/30 rounded-2xl">
                  <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3 flex items-center justify-center gap-1.5 font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Live Trading Flow Activity
                  </h3>
                  
                  {/* Scrolling transactions list */}
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {liveTrades.map(trade => (
                      <div key={trade.id} className="flex justify-between items-center p-2.5 bg-slate-950/60 rounded-xl border border-slate-850 text-[10px] text-left animate-fade-in-up">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                            trade.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 animate-pulse-green' : 'bg-red-500/20 text-red-400 animate-pulse-red'
                          }`}>
                            {trade.type}
                          </span>
                          <div>
                            <span className="font-semibold text-white">{trade.item}</span>
                            <span className="text-slate-500 ml-1">({trade.qty})</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-emerald-400 font-bold">{trade.amount}</span>
                          <p className="text-[8px] text-slate-500 font-mono mt-0.5">{trade.dest} | {trade.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Animated graphic of ship bobbing and truck driving */}
                <div className="relative h-24 bg-slate-950/40 border border-slate-850 rounded-2xl overflow-hidden p-4 flex items-center justify-between">
                  <div className="absolute bottom-2 left-0 right-0 h-1 bg-sky-500/20 border-b border-sky-400/40"></div>
                  <div className="absolute bottom-3 left-10 text-3xl animate-ship select-none">🚢</div>
                  <div className="absolute top-2 left-0 text-2xl animate-truck select-none">🚚</div>
                  <div className="absolute right-4 bottom-2 text-3xl select-none">🏢</div>
                  <div className="absolute left-4 bottom-2 text-3xl select-none">🏗️</div>
                  <div className="z-10 ml-auto text-right pr-2">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold font-mono">Live Logistics Pipeline</p>
                    <p className="text-xs font-semibold text-sky-400 mt-0.5">Accra ➔ Tema Port Transit</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => {
                      setPassword('');
                      setAuthScreen('login');
                    }}
                    className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 cursor-pointer transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setPassword('');
                      setAuthScreen('register');
                    }}
                    className="py-3 px-4 bg-slate-800 hover:bg-slate-750 text-white border border-slate-700 rounded-xl text-sm font-bold cursor-pointer transition-all"
                  >
                    Register Team
                  </button>
                </div>
              </motion.div>
            )}

            {authScreen === 'login' && (
              <motion.form 
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleLogin} 
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Corporate Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                    <input 
                      type="email" 
                      required 
                      placeholder="name@rembaimpex.com"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                    <input 
                      type={showPassword ? "text" : "password"} 
                      required 
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="mt-2 space-y-1 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 text-[10px]">
                      <p className="font-semibold text-slate-400 mb-1">PASSWORD COMPLIANCE AUDIT:</p>
                      <div className="flex items-center gap-1.5">
                        {password.length <= 8 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-red-400" />}
                        <span className={password.length <= 8 ? "text-emerald-400 animate-pulse" : "text-red-400"}>Maximum 8 characters</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {/[A-Z]/.test(password) ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-red-400" />}
                        <span className={/[A-Z]/.test(password) ? "text-emerald-400" : "text-red-400"}>At least 1 uppercase letter</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {/[a-zA-Z]/.test(password) ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-red-400" />}
                        <span className={/[a-zA-Z]/.test(password) ? "text-emerald-400" : "text-red-400"}>Contains letters</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {/[^A-Za-z0-9]/.test(password) ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-red-400" />}
                        <span className={/[^A-Za-z0-9]/.test(password) ? "text-emerald-400" : "text-red-400"}>Contains symbols (e.g. @, #, $)</span>
                      </div>
                    </div>
                  )}
                  {password.length === 0 && (
                    <p className="text-[10px] text-slate-500 mt-1">Default demo access password is <code>R@mba1</code></p>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={staySignedIn} 
                      onChange={(e) => setStaySignedIn(e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-emerald-500 cursor-pointer" 
                    />
                    <span>Stay signed in</span>
                  </label>
                  <button 
                    type="button" 
                    onClick={() => setAuthScreen('forgot')} 
                    className="text-emerald-500 hover:underline font-semibold cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>

                <button 
                  type="submit" 
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  Access Core Terminal
                </button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
                  <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-slate-900 px-2 text-slate-500">Or sign in with</span></div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    type="button"
                    onClick={() => handleOAuth('Google', false)}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-850 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-medium transition-all cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    <span>Gmail</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleOAuth('Microsoft', false)}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-850 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-medium transition-all cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 23 23" fill="currentColor">
                      <rect x="0" y="0" width="11" height="11" fill="#F25022" />
                      <rect x="12" y="0" width="11" height="11" fill="#7FBA00" />
                      <rect x="0" y="12" width="11" height="11" fill="#00A4EF" />
                      <rect x="12" y="12" width="11" height="11" fill="#FFB900" />
                    </svg>
                    <span>Outlook</span>
                  </button>
                </div>

                <div className="flex justify-between items-center text-xs text-slate-400 mt-6 border-t border-slate-850 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setAuthScreen('welcome')}
                    className="text-slate-500 hover:text-white transition-all cursor-pointer"
                  >
                    ← Back to Welcome
                  </button>
                  <p>
                    New staff?{' '}
                    <button 
                      type="button" 
                      onClick={() => {
                        setPassword('');
                        setAuthScreen('register');
                      }} 
                      className="text-emerald-500 hover:underline font-semibold cursor-pointer"
                    >
                      Register
                    </button>
                  </p>
                </div>
              </motion.form>
            )}

            {authScreen === 'register' && (
              <motion.form 
                key="register"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleRegister} 
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                    <input 
                      type="text" 
                      required 
                      placeholder="Ama Boateng"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Work Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                    <input 
                      type="email" 
                      required 
                      placeholder="name@rembaimpex.com"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                      <input 
                        type={showPassword ? "text" : "password"} 
                        required 
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Confirm PW</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                      <input 
                        type={showConfirmPassword ? "text" : "password"} 
                        required 
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {password.length > 0 && (
                  <div className="space-y-1 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 text-[10px]">
                    <p className="font-semibold text-slate-400 mb-1">PASSWORD COMPLIANCE AUDIT:</p>
                    <div className="flex items-center gap-1.5">
                      {password.length <= 8 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-red-400" />}
                      <span className={password.length <= 8 ? "text-emerald-400" : "text-red-400"}>Maximum 8 characters</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {/[A-Z]/.test(password) ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-red-400" />}
                      <span className={/[A-Z]/.test(password) ? "text-emerald-400" : "text-red-400"}>At least 1 uppercase letter</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {/[a-zA-Z]/.test(password) ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-red-400" />}
                      <span className={/[a-zA-Z]/.test(password) ? "text-emerald-400" : "text-red-400"}>Contains letters</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {/[^A-Za-z0-9]/.test(password) ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-red-400" />}
                      <span className={/[^A-Za-z0-9]/.test(password) ? "text-emerald-400" : "text-red-400"}>Contains symbols (e.g. @, #, $)</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Target Department</label>
                  <select 
                    value={registerDept}
                    onChange={(e) => setRegisterDept(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
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

                {registerDept !== 'CEO' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Ghana Card ID</label>
                    <div className="relative">
                      <CreditCard className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                      <input 
                        type="text" 
                        required={ghanaCardValidation}
                        placeholder="GHA-123456789-0"
                        value={registerCard}
                        onChange={(e) => setRegisterCard(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}

                {registerDept === 'CEO' && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[10px] text-amber-400 font-mono">
                    <strong>CEO Whitelist Bypass Active:</strong> Whitelisted email required: <code>{whitelistedCeos}</code>.
                  </div>
                )}

                <button 
                  type="submit" 
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  Submit Registration
                </button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
                  <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-slate-900 px-2 text-slate-500">Or register with</span></div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    type="button"
                    onClick={() => handleOAuth('Google', true)}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-850 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-medium transition-all cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    <span>Gmail</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleOAuth('Microsoft', true)}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-850 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-medium transition-all cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 23 23" fill="currentColor">
                      <rect x="0" y="0" width="11" height="11" fill="#F25022" />
                      <rect x="12" y="0" width="11" height="11" fill="#7FBA00" />
                      <rect x="0" y="12" width="11" height="11" fill="#00A4EF" />
                      <rect x="12" y="12" width="11" height="11" fill="#FFB900" />
                    </svg>
                    <span>Outlook</span>
                  </button>
                </div>

                <div className="flex justify-between items-center text-xs text-slate-400 mt-6 border-t border-slate-850 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setAuthScreen('welcome')}
                    className="text-slate-500 hover:text-white transition-all cursor-pointer"
                  >
                    ← Back to Welcome
                  </button>
                  <p>
                    Have an account?{' '}
                    <button 
                      type="button" 
                      onClick={() => {
                        setPassword('');
                        setAuthScreen('login');
                      }} 
                      className="text-emerald-500 hover:underline font-semibold cursor-pointer"
                    >
                      Login
                    </button>
                  </p>
                </div>
              </motion.form>
            )}

            {authScreen === 'forgot' && (
              <motion.form
                key="forgot"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!forgotEmail) {
                    alert('Please enter your email.');
                    return;
                  }
                  setForgotSubmitted(true);
                }}
                className="space-y-4"
              >
                <div className="text-center p-3 bg-blue-500/10 rounded-xl text-xs text-blue-400 border border-blue-500/20">
                  Password Recovery Console
                </div>
                
                {forgotSubmitted ? (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 text-center space-y-2">
                    <p className="font-bold">Reset Request Dispatched!</p>
                    <p>A recovery instructions token has been sent to <strong>{forgotEmail}</strong>.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotSubmitted(false);
                        setForgotEmail('');
                        setAuthScreen('login');
                      }}
                      className="text-emerald-500 hover:underline font-semibold text-xs mt-4 block mx-auto cursor-pointer"
                    >
                      Return to Sign In
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Corporate Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                        <input
                          type="email"
                          required
                          placeholder="name@rembaimpex.com"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-sm font-bold text-white shadow-lg transition-all cursor-pointer"
                    >
                      Send Password Reset Link
                    </button>
                    <p className="text-center text-xs mt-4">
                      Remembered your details?{' '}
                      <button
                        type="button"
                        onClick={() => setAuthScreen('login')}
                        className="text-emerald-500 hover:underline font-semibold cursor-pointer"
                      >
                        Sign In
                      </button>
                    </p>
                  </>
                )}
              </motion.form>
            )}

            {authScreen === 'otp' && (
              <motion.form 
                key="otp"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleVerifyOtp} 
                className="space-y-4"
              >
                <div className="text-center p-3 bg-blue-500/10 rounded-xl text-xs text-blue-400 border border-blue-500/20">
                  Enter 6-digit OTP code sent via Ghana SMS Gateway.
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">OTP Verification Code</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-center text-white tracking-widest text-lg font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button 
                  type="submit" 
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-sm font-bold text-white shadow-lg transition-all cursor-pointer"
                >
                  Verify Immediate Bypass
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    );
  }

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
            onApproveIntake={handleApproveIntake}
            onApproveCredit={handleManagementCreditDecision}
          />
        );
      case 'HR':
        return (
          <HrDashboard
            attendanceList={attendanceList}
            barChartData={barChartData}
          />
        );
      case 'MARKETING':
        return (
          <MarketingDashboard
            ordersList={ordersList}
            onCreateOrder={handleCreateOrder}
            customersList={customersList}
            onRegisterCustomer={handleRegisterCustomer}
          />
        );
      case 'OPERATIONS':
        return (
          <OperationsDashboard
            ordersList={ordersList}
            onLogIntake={handleLogIntake}
            onReleaseToDispatch={handleReleaseToDispatch}
          />
        );
      case 'FINANCE':
        return (
          <FinanceDashboard
            ordersList={ordersList}
            onEvaluateOrder={handleEvaluateOrder}
            onFinalizeOrder={handleFinalizeOrder}
          />
        );
      case 'PRODUCTION':
        return (
          <ProductionDashboard
            productionRequests={productionRequests}
            onProductionRequest={handleProductionRequest}
            onApproveProductionRequest={handleApproveProductionRequest}
            onIssueReleaseTickets={handleIssueReleaseTickets}
            isCeo={currentUser?.isCeo || false}
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
          />
        );
      case 'LOGISTICS':
        return <LogisticsDashboard />;
      case 'BOARDROOM':
        return (
          <BoardroomView
            boardroomMinutes={boardroomMinutes}
            setBoardroomMinutes={setBoardroomMinutes}
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
        theme={theme}
        currentUser={currentUser}
        onLogout={() => setIsAuthenticated(false)}
        addNotification={addNotification}
      />

      {/* 2. MAIN SHEET WRAPPER */}
      <main className="flex-1 ml-6 bg-white rounded-3xl p-6 shadow-xl flex flex-col justify-between overflow-hidden border border-slate-100 app-sheet">
        
        {/* TOP STATUS BAR & SEARCH */}
        <Header
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onOpenChat={() => setIsChatOpen(true)}
        />

        {/* 3. DYNAMIC PAGES VIEW SELECTOR CONTAINER */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeDepartment}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="h-full"
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

    </div>
  );
}
