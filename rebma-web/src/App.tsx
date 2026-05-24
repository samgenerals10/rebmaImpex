// rebma-web/src/App.tsx

import { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
import SettingsDashboard from './views/SettingsDashboard';

export default function App() {
  // Theme State
  const [theme, setTheme] = useState<'breeze' | 'seven' | 'royal' | 'mint' | 'sunset' | 'forest'>('breeze');
  
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
  const [authScreen, setAuthScreen] = useState<'login' | 'register' | 'otp'>('login');
  const [registerEmail, setRegisterEmail] = useState<string>('');
  const [registerDept, setRegisterDept] = useState<string>('MARKETING');
  const [registerName, setRegisterName] = useState<string>('');
  const [registerCard, setRegisterCard] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [simulatedReceivedOtp, setSimulatedReceivedOtp] = useState<string>('');
  const [registrationMessage, setRegistrationMessage] = useState<string>('');
  
  // Admin & Whitelist Settings
  const [whitelistedCeos, setWhitelistedCeos] = useState<string>('ceo@rebmaimpex.com, ceo2@rebmaimpex.com');
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

  // Real-Time Dispatch and Simulated Tracking States
  const [activeCoordinates, setActiveCoordinates] = useState<{lat: number, lng: number}>({lat: 5.6037, lng: -0.1870}); // Accra coords
  const [deliveryStatus, setDeliveryStatus] = useState<string>('IN_TRANSIT');

  // Real-Time Chat & Boardroom States
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '1', sender: 'System Terminal', content: 'WebSockets initialized. Boardroom chat active.', time: '09:00 AM' }
  ]);
  const [boardroomMinutes, setBoardroomMinutes] = useState<string>(
    "Rebma Impex Boardroom Log - May 24, 2026\n1. Target fleet tracking refresh set to 10s.\n2. Ghana card formats must validate correctly."
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

  // Handle standard registration
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerEmail || !registerName) {
      alert('Please fill out all fields.');
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
        alert(`[SIMULATED SMS GATEWAY - ${smsGateway.toUpperCase()}]: Your Rebma ERP CEO verification code is: ${randomOtp}`);
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
    const userRole = registerEmail.includes('ceo') ? 'CEO' : registerDept;
    setCurrentUser({
      fullName: registerName || 'Samuel Rebma',
      email: registerEmail || 'samuel@rebmaimpex.com',
      department: userRole,
      isCeo: userRole === 'CEO'
    });
    setActiveDepartment(userRole);
    setIsAuthenticated(true);
    addNotification(`Logged in as ${registerName || 'Samuel Rebma'} (${userRole})`);
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
      <div className="min-h-screen w-full flex items-center justify-center bg-radial from-[#0a1f33] to-[#020617] p-6">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600 rounded-full filter blur-3xl opacity-10 -mr-12 -mt-12"></div>
          
          <div className="flex flex-col items-center mb-8">
            <div className="p-4 bg-blue-600/10 rounded-2xl border border-blue-500/20 mb-3">
              <Building2 className="w-10 h-10 text-blue-500" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">REBMA IMPEX LIMITED</h1>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">Enterprise Resource Planning</p>
          </div>

          {registrationMessage && (
            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-400 text-center">
              {registrationMessage}
            </div>
          )}

          <AnimatePresence mode="wait">
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
                  <input 
                    type="email" 
                    required 
                    placeholder="name@rebmaimpex.com"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Password</label>
                  <input 
                    type="password" 
                    required 
                    placeholder="••••••••"
                    defaultValue="password123"
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button 
                  type="submit" 
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
                >
                  Access Core Terminal
                </button>
                <p className="text-center text-xs text-slate-400 mt-4">
                  New staff member?{' '}
                  <button 
                    type="button" 
                    onClick={() => setAuthScreen('register')} 
                    className="text-blue-500 hover:underline font-semibold"
                  >
                    Register Workspace
                  </button>
                </p>
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
                  <input 
                    type="text" 
                    required 
                    placeholder="Ama Boateng"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Work Email</label>
                  <input 
                    type="email" 
                    required 
                    placeholder="name@rebmaimpex.com"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Target Department</label>
                  <select 
                    value={registerDept}
                    onChange={(e) => setRegisterDept(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
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
                    <input 
                      type="text" 
                      required={ghanaCardValidation}
                      placeholder="GHA-123456789-0"
                      value={registerCard}
                      onChange={(e) => setRegisterCard(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                {registerDept === 'CEO' && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-400">
                    <strong>CEO Bypass Activated:</strong> Immediate verification will trigger. Credentials must match whitelist: <code>{whitelistedCeos}</code>.
                  </div>
                )}

                <button 
                  type="submit" 
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
                >
                  Submit Registration
                </button>
                <p className="text-center text-xs text-slate-400 mt-4">
                  Already have an account?{' '}
                  <button 
                    type="button" 
                    onClick={() => setAuthScreen('login')} 
                    className="text-blue-500 hover:underline font-semibold"
                  >
                    Login
                  </button>
                </p>
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
                <div className="text-center p-3 bg-blue-500/10 rounded-xl text-xs text-blue-400">
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
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-center text-white tracking-widest text-lg font-bold focus:outline-none focus:border-blue-500"
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
