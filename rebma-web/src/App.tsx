import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Check, X, ArrowRight, Lock, Mail, User, CreditCard, Phone, AlertCircle, Info, CheckCircle } from 'lucide-react';
import type { Order, IncomingGoods, ProductionRequest, Visitor, Attendance, ChatMessage, BoardroomMeeting, FinancePayment, Customer, GoodsPrice, AuditEntry, PendingRegistration, StaffMember } from './types/erp';

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

import { auth, hr, operations, management, marketing, finance, production, dispatch, reception, getToken, setToken, clearToken } from './services/apiClient';
import { supabase } from './lib/supabaseClient';

export default function App() {
  // Helper to map UI dropdown values to database role values
  const getNormalizedRole = (dept: string): string => {
    const d = dept.trim();
    if (d === 'CEO Office (OTP verification)' || d === 'CEO Office (OTP bypass)' || d === 'CEO') return 'CEO';
    if (d === 'Human Resources' || d === 'HR') return 'HR';
    if (d === 'Management Office' || d === 'MANAGEMENT' || d === 'admin') return 'admin';
    if (d === 'Marketing Department' || d === 'MARKETING' || d === 'marketing') return 'marketing';
    if (d === 'Operations (Warehouse)' || d === 'OPERATIONS' || d === 'operations') return 'operations';
    if (d === 'Finance (Ledgers)' || d === 'FINANCE' || d === 'finance') return 'finance';
    if (d === 'Production Line' || d === 'PRODUCTION' || d === 'production') return 'production';
    if (d === 'Reception Desk' || d === 'RECEPTION' || d === 'receptionist') return 'receptionist';
    if (d === 'Dispatch Fleet' || d === 'DISPATCH' || d === 'dispatch') return 'dispatch';
    if (d === 'Logistics & Supply Chain' || d === 'LOGISTICS' || d === 'logistics') return 'logistics';
    return d;
  };

  // Theme State - Default to 'ghana' official logo theme matching colors!
  const [theme, setTheme] = useState<'breeze' | 'seven' | 'royal' | 'mint' | 'sunset' | 'forest' | 'ghana'>('ghana');
  
  // Authentication & Onboarding States
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<{
    fullName: string;
    email: string;
    department: string;
    isCeo: boolean;
    requiresPasswordReset?: boolean;
  } | null>(null);
  
  const [activeDepartment, setActiveDepartment] = useState<string>('CEO');
  const [activeSubTab, setActiveSubTab] = useState<string>('Overview');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Multi-Step Registration UI
  const [authScreen, setAuthScreen] = useState<'welcome' | 'login' | 'register' | 'otp' | 'forgot' | 'email_verification_sent' | 'activation_expired'>('login');
  const [registerEmail, setRegisterEmail] = useState<string>('');
  const [registerPhone, setRegisterPhone] = useState<string>('');
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [registerDept, setRegisterDept] = useState<string>('Marketing Department');
  const [registerName, setRegisterName] = useState<string>('');
  const [registerCard, setRegisterCard] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [simulatedReceivedOtp, setSimulatedReceivedOtp] = useState<string>('');
  const [otpResendCountdown, setOtpResendCountdown] = useState<number>(0);
  const [otpExpireCountdown, setOtpExpireCountdown] = useState<number>(0);
  const [registrationMessage, setRegistrationMessage] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [staySignedIn, setStaySignedIn] = useState<boolean>(true);
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [forgotSubmitted, setForgotSubmitted] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [loginRole, setLoginRole] = useState<string>('Staff');

  useEffect(() => {
    setLoginError('');
  }, [authScreen]);

  // Custom Alert Modal State
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'error' | 'success' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  // Custom Prompt Modal State
  const [promptModal, setPromptModal] = useState<{
    isOpen: boolean;
    message: string;
    defaultValue: string;
    resolve: (val: string | null) => void;
  } | null>(null);

  const [promptInputValue, setPromptInputValue] = useState<string>('');

  // Custom Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    resolve: (val: boolean) => void;
  } | null>(null);

  // Custom alert function
  const alert = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    let detectedType = type;
    if (type === 'info') {
      const lower = message.toLowerCase();
      if (lower.includes('fail') || lower.includes('error') || lower.includes('invalid') || lower.includes('expired') || lower.includes('reject') || lower.includes('not whitelisted') || lower.includes('does not match') || lower.includes('required')) {
        detectedType = 'error';
      } else if (lower.includes('success') || lower.includes('complete') || lower.includes('sent') || lower.includes('verified') || lower.includes('resent')) {
        detectedType = 'success';
      }
    }
    setAlertModal({
      isOpen: true,
      title: detectedType === 'error' ? 'System & Security Message' : detectedType === 'success' ? 'System Success' : 'System Notification',
      message,
      type: detectedType,
    });
  };

  const renderAlertModal = () => {
    if (!alertModal.isOpen) return null;
    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-[24px] border border-slate-100 shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4 relative text-slate-800"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {alertModal.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
              ) : alertModal.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              ) : (
                <Info className="w-5 h-5 text-blue-500 shrink-0" />
              )}
              <h4 className="text-sm font-bold text-slate-900 leading-none">
                {alertModal.title}
              </h4>
            </div>
            <button 
              onClick={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
            {alertModal.message}
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  const renderPromptModal = () => {
    if (!promptModal || !promptModal.isOpen) return null;
    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-[24px] border border-slate-100 shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4 relative text-slate-800"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Info className="w-5 h-5 text-emerald-500 shrink-0" />
              <h4 className="text-sm font-bold text-slate-900 leading-none">
                Input Required
              </h4>
            </div>
            <button 
              onClick={() => {
                promptModal.resolve(null);
                setPromptModal(null);
              }}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            {promptModal.message}
          </p>
          <input
            type="text"
            value={promptInputValue}
            onChange={(e) => setPromptInputValue(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                promptModal.resolve(promptInputValue);
                setPromptModal(null);
              }
            }}
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                promptModal.resolve(null);
                setPromptModal(null);
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                promptModal.resolve(promptInputValue);
                setPromptModal(null);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Submit
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  const renderConfirmModal = () => {
    if (!confirmModal || !confirmModal.isOpen) return null;
    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-[24px] border border-slate-100 shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4 relative text-slate-800"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
              <h4 className="text-sm font-bold text-slate-900 leading-none">
                Confirmation Required
              </h4>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            {confirmModal.message}
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                confirmModal.resolve(false);
                setConfirmModal(null);
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                confirmModal.resolve(true);
                setConfirmModal(null);
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Confirm
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  // Financial Payments & Tickets
  const [paymentsList, setPaymentsList] = useState<FinancePayment[]>([]);

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
  const [incomingGoodsList, setIncomingGoodsList] = useState<IncomingGoods[]>([]);
  const [ordersList, setOrdersList] = useState<Order[]>([]);
  const [productionRequests, setProductionRequests] = useState<ProductionRequest[]>([]);
  const [visitorsList, setVisitorsList] = useState<Visitor[]>([]);
  const [attendanceList, setAttendanceList] = useState<Attendance[]>([]);

  // Customer List for Marketing Registration
  const [customersList, setCustomersList] = useState<Customer[]>([]);

  // Audit Log & Price Management
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [goodsPrices, setGoodsPrices] = useState<GoodsPrice[]>([]);

  // HR pending & active staff
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);

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

  const refreshAllData = async () => {
    if (!getToken()) return;

    // Fetch incoming goods
    try {
      const goods = await operations.getIncomingGoods();
      setIncomingGoodsList(goods.map((item: any) => ({
        id: item.id,
        productName: item.productName || 'N/A',
        productImage: item.productImage || undefined,
        goodsCode: item.goodsCode || 'N/A',
        destination: item.destination || 'N/A',
        country: item.country,
        company: item.company,
        quantity: item.quantity,
        weight: item.weight,
        discrepancies: item.discrepancies || 'None',
        status: item.status,
        unitPrice: item.unitPrice || undefined,
        createdAt: new Date(item.createdAt).toLocaleString()
      })));
    } catch (e) {
      console.log('Skipping incoming goods fetch (unauthorized/error)');
    }

    // Fetch orders
    try {
      const orders = await marketing.getOrders();
      setOrdersList(orders.map((o: any) => ({
        id: o.id,
        ticketNumber: o.ticketNumber || undefined,
        clientName: o.clientName,
        productName: o.productName || 'N/A',
        destination: o.destination || 'N/A',
        paymentMode: o.paymentMode,
        totalAmount: o.totalAmount,
        ghanaCard: o.ghanaCard || undefined,
        status: o.status,
        createdAt: new Date(o.createdAt).toLocaleString()
      })));
    } catch (e) {
      console.log('Skipping orders fetch (unauthorized/error)');
    }

    // Fetch customers
    try {
      const customers = await marketing.getCustomers();
      setCustomersList(customers.map((c: any) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        location: c.location,
        companyName: c.companyName,
        ghanaCard: c.ghanaCard || undefined,
        email: c.email || undefined,
        photo: c.photo || undefined,
        registeredAt: new Date(c.registeredAt).toLocaleString(),
        creditHistory: c.creditHistory ? (typeof c.creditHistory === 'string' ? JSON.parse(c.creditHistory) : c.creditHistory) : undefined
      })));
    } catch (e) {
      console.log('Skipping customers fetch (unauthorized/error)');
    }

    // Fetch audit entries
    try {
      const logs = await management.getAuditLog();
      setAuditLog(logs.map((log: any) => ({
        id: log.id,
        action: log.action,
        department: log.department,
        performedBy: log.performedBy,
        details: log.details,
        timestamp: new Date(log.timestamp).toLocaleString()
      })));
    } catch (e) {
      console.log('Skipping audit log fetch (unauthorized/error)');
    }

    // Fetch goods prices
    try {
      const prices = await management.getPrices();
      setGoodsPrices(prices.map((p: any) => ({
        id: p.id,
        productName: p.productName,
        category: p.category,
        unitPrice: p.unitPrice,
        currency: p.currency,
        setBy: p.setBy,
        setAt: new Date(p.setAt).toLocaleString()
      })));
    } catch (e) {
      console.log('Skipping goods prices fetch (unauthorized/error)');
    }

    // Fetch production requests
    try {
      const reqs = await production.getRequests();
      setProductionRequests(reqs.map((r: any) => ({
        id: r.id,
        items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items,
        status: r.status,
        producedGoods: r.producedGoods || undefined,
        createdAt: new Date(r.createdAt).toLocaleString()
      })));
    } catch (e) {
      console.log('Skipping production requests fetch (unauthorized/error)');
    }

    // Fetch payments
    try {
      const payments = await finance.getPayments();
      setPaymentsList(payments.map((p: any) => ({
        id: p.id,
        clientName: p.clientName,
        amount: p.amount,
        paymentMode: p.paymentMode,
        paymentType: p.paymentType,
        orderId: p.orderId || undefined,
        createdAt: new Date(p.createdAt).toLocaleString()
      })));
    } catch (e) {
      console.log('Skipping payments fetch (unauthorized/error)');
    }

    // Fetch visitors
    try {
      const visitors = await reception.getVisitors();
      setVisitorsList(visitors.map((v: any) => ({
        id: v.id,
        fullName: v.fullName,
        purpose: v.purpose,
        hostName: v.hostName,
        checkInTime: new Date(v.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        checkOutTime: v.checkOutTime ? new Date(v.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined
      })));
    } catch (e) {
      console.log('Skipping visitors fetch (unauthorized/error)');
    }

    // Fetch attendance
    try {
      const attendance = await hr.getAttendance();
      setAttendanceList(attendance.map((a: any) => ({
        id: a.id,
        fullName: a.user?.fullName || 'Unknown',
        checkInTime: new Date(a.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: a.status as 'PRESENT' | 'LATE',
        date: new Date(a.date).toLocaleDateString()
      })));
    } catch (e) {
      console.log('Skipping attendance fetch (unauthorized/error)');
    }

    // Fetch pending registrations (HR)
    try {
      const pendings = await hr.getPendingUsers();
      setPendingRegistrations(pendings.map((p: any) => ({
        id: p.id,
        fullName: p.fullName,
        email: p.email,
        department: p.department,
        ghanaCard: p.ghanaCardId || 'N/A',
        submittedAt: new Date(p.createdAt).toLocaleString(),
        status: 'PENDING'
      })));
    } catch (e) {
      console.log('Skipping pending users fetch (unauthorized/error)');
    }

    // Fetch active users (staff list in HR)
    try {
      const activeUsers = await hr.getAllUsers();
      setStaffList(activeUsers.map((u: any) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        department: u.department,
        role: u.isCeo ? 'CEO' : `${u.department} Staff`,
        ghanaCard: u.ghanaCardId || 'GHA-XXXXXXX-X',
        phone: u.phone || 'N/A',
        photo: u.photo || undefined,
        joinedAt: new Date(u.createdAt).toLocaleDateString(),
        status: 'ACTIVE'
      })));
    } catch (e) {
      console.log('Skipping staff list fetch (unauthorized/error)');
    }

    // Fetch chat messages
    try {
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (messages && messages.length > 0) {
        setChatMessagesState(messages.map((m: any) => ({
          id: m.id,
          sender: m.sender,
          content: m.content,
          time: m.time,
          receiver: m.receiver || undefined
        })));
      }
    } catch (e) {
      console.log('Skipping chat messages fetch:', e);
    }
  };

  // Auth initialize hook
  useEffect(() => {
    // Override alert, prompt, and confirm globally so they show our gorgeous glassmorphic custom modal dialogs
    window.alert = (message: string) => {
      alert(message);
    };

    window.prompt = (message?: string, defaultValue?: string): any => {
      return new Promise<string | null>((resolve) => {
        setPromptInputValue(defaultValue || '');
        setPromptModal({
          isOpen: true,
          message: message || '',
          defaultValue: defaultValue || '',
          resolve,
        });
      });
    };

    window.confirm = (message?: string): any => {
      return new Promise<boolean>((resolve) => {
        setConfirmModal({
          isOpen: true,
          message: message || '',
          resolve,
        });
      });
    };

    let isMounted = true;

    const handleSession = async (session: any) => {
      try {
        const token = session.access_token;
        setToken(token);

        let profile;
        try {
          profile = await auth.me();
        } catch (meError: any) {
          const user = session.user;
          if (user) {
            const rawRole = user.user_metadata?.role || user.user_metadata?.department || 'Staff';
            const userRole = getNormalizedRole(rawRole);
            const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Employee';
            const isCeo = user.user_metadata?.is_ceo || userRole === 'CEO';

            // Insert new profile row
            const { error: insertError } = await supabase.from('profiles').insert({
              id: user.id,
              email: user.email,
              full_name: fullName,
              role: userRole,
              status: 'ACTIVE',
              is_ceo: isCeo,
              requires_password_reset: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

            if (insertError) {
              console.error('Failed to auto-create profile:', insertError);
              throw meError;
            }

            profile = await auth.me();
          } else {
            throw meError;
          }
        }

        if (isMounted) {
          setCurrentUser({
            fullName: profile.fullName,
            email: profile.email,
            department: profile.department,
            isCeo: profile.isCeo,
            requiresPasswordReset: profile.requiresPasswordReset
          });
          setActiveDepartment(profile.department);
          setIsAuthenticated(true);
        }
      } catch (e: any) {
        console.error('Session initialization error:', e);
        if (isMounted) {
          await supabase.auth.signOut().catch(() => {});
          clearToken();
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      }
    };

    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && isMounted) {
        await handleSession(session);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session && isMounted) {
          await handleSession(session);
          if (window.location.hash) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        if (isMounted) {
          setIsAuthenticated(false);
          setCurrentUser(null);
          clearToken();
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Sync data & auto-poll
  useEffect(() => {
    if (isAuthenticated) {
      refreshAllData();
      const interval = setInterval(refreshAllData, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Supabase Realtime subscriptions hook
  useEffect(() => {
    if (currentUser) {
      const channel = supabase.channel('erp-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles' },
          (payload) => {
            const newRecord = payload.new as any;
            const oldRecord = payload.old as any;
            if (payload.eventType === 'INSERT') {
              if (newRecord.status === 'PENDING_APPROVAL') {
                if (currentUser.department === 'HR' || currentUser.isCeo) {
                  addNotification(`New pending user: ${newRecord.full_name || 'Unknown'}`);
                  refreshAllData();
                }
              }
            } else if (payload.eventType === 'UPDATE') {
              if (oldRecord && oldRecord.status !== 'ACTIVE' && newRecord.status === 'ACTIVE') {
                addNotification(`User ${newRecord.full_name || 'Unknown'} approved.`);
                refreshAllData();
              }
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'cargo_intake' },
          (payload) => {
            const newRecord = payload.new as any;
            const oldRecord = payload.old as any;
            if (payload.eventType === 'INSERT') {
              if (currentUser.department === 'MANAGEMENT' || currentUser.isCeo) {
                addNotification(`New cargo intake logged for ${newRecord.company || 'N/A'}`);
                refreshAllData();
              }
            } else if (payload.eventType === 'UPDATE') {
              if (oldRecord && oldRecord.status !== 'APPROVED' && newRecord.status === 'APPROVED') {
                if (currentUser.department === 'OPERATIONS' || currentUser.isCeo) {
                  addNotification(`Intake approved: ${newRecord.id}`);
                  refreshAllData();
                }
              } else if (oldRecord && oldRecord.status !== 'REJECTED' && newRecord.status === 'REJECTED') {
                if (currentUser.department === 'OPERATIONS' || currentUser.isCeo) {
                  addNotification(`Intake rejected: ${newRecord.id}`);
                  refreshAllData();
                }
              }
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'delivery_logs' },
          (payload) => {
            const newRecord = payload.new as any;
            if (currentUser.department === 'DISPATCH' || currentUser.isCeo) {
              addNotification(`New delivery assigned: Order ${newRecord.order_id || 'N/A'}`);
              refreshAllData();
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'goods_prices' },
          () => {
            if (['FINANCE', 'MARKETING', 'MANAGEMENT'].includes(currentUser.department) || currentUser.isCeo) {
              addNotification(`Price catalog updated`);
              refreshAllData();
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_messages' },
          (payload) => {
            const newMsg = payload.new as any;
            const formattedMsg: ChatMessage = {
              id: newMsg.id,
              sender: newMsg.sender,
              content: newMsg.content,
              time: newMsg.time,
              receiver: newMsg.receiver || undefined
            };
            setChatMessagesState((prev) => {
              const tempIndex = prev.findIndex(
                (m) =>
                  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(m.id) &&
                  m.sender === formattedMsg.sender &&
                  m.content === formattedMsg.content &&
                  m.receiver === formattedMsg.receiver
              );
              if (tempIndex !== -1) {
                const next = [...prev];
                next[tempIndex] = formattedMsg;
                return next;
              }
              if (prev.some((msg) => msg.id === formattedMsg.id)) return prev;
              return [...prev, formattedMsg];
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentUser]);

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
  const [chatMessages, setChatMessagesState] = useState<ChatMessage[]>([
    { id: '1', sender: 'System Terminal', content: 'Supabase Realtime initialized. Boardroom chat active.', time: '09:00 AM' }
  ]);

  const setChatMessages = (
    val: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])
  ) => {
    setChatMessagesState((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      const added = next.filter((m) => !prev.some((p) => p.id === m.id));
      for (const msg of added) {
        if (msg.sender === 'System Terminal') continue;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(msg.id);
        if (!isUuid) {
          supabase
            .from('chat_messages')
            .insert({
              sender: msg.sender,
              content: msg.content,
              time: msg.time,
              receiver: msg.receiver || null
            })
            .then(({ error }) => {
              if (error) console.error('Failed to sync message to Supabase:', error);
            });
        }
      }
      return next;
    });
  };
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

  // Handle standard and privileged registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerEmail || !registerName) {
      alert('Please fill out all fields.');
      return;
    }

    // Strict recognized email domain verification (only Gmail, Outlook, Yahoo, Hotmail)
    const emailVal = registerEmail.trim();
    const allowedDomains = ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com'];
    const emailParts = emailVal.split('@');
    const domain = emailParts[emailParts.length - 1].toLowerCase();
    
    if (emailParts.length !== 2 || !allowedDomains.includes(domain)) {
      alert("Please register with a valid, recognized email provider (e.g., Gmail, Outlook, Yahoo).");
      return;
    }

    // Map the UI dropdown value to the exact database role value
    const mappedDept = getNormalizedRole(registerDept);
    const isPrivileged = mappedDept === 'CEO' || mappedDept === 'HR';
    const emailLower = registerEmail.trim().toLowerCase();

    if (isPrivileged) {
      const whitelistedCeoRaw = import.meta.env.VITE_WHITELISTED_CEO_EMAIL || 'samgenerals@gmail.com';
      const whitelistedHrRaw = import.meta.env.VITE_WHITELISTED_HR_EMAIL || 'ryggogen10@gmail.com';
      
      const whitelistedCeo = whitelistedCeoRaw.trim().toLowerCase();
      const whitelistedHr = whitelistedHrRaw.trim().toLowerCase();
      
      if (mappedDept === 'CEO' && emailLower !== whitelistedCeo) {
        alert("Email is not whitelisted for the CEO role.");
        return;
      }
      if (mappedDept === 'HR' && emailLower !== whitelistedHr) {
        alert("Email is not whitelisted for the HR role.");
        return;
      }

      // Privileged roles directly call magic link flow
      try {
        const res = await auth.login(emailLower, '', mappedDept);
        alert(res.message || 'Magic link sent! Check your email.');
        setAuthScreen('email_verification_sent');
        addNotification(`Privileged onboarding link sent to ${registerName} (${mappedDept}).`);
        
        // Clear registration states
        setRegisterName('');
        setRegisterEmail('');
        setRegisterPhone('');
        setRegisterCard('');
      } catch (err: any) {
        alert(err.message || 'Onboarding registration failed.');
      }
    } else {
      // Standard non-privileged registration
      try {
        const res = await auth.register({
          email: emailLower,
          fullName: registerName,
          department: mappedDept,
          phone: registerPhone.trim() || undefined,
          ghanaCardId: registerCard || undefined
        });
        setRegistrationMessage(res.message);
        setAuthScreen('login');
        addNotification(`New registration request from ${registerName} (${mappedDept}) submitted.`);
        
        // Clear registration states
        setRegisterName('');
        setRegisterEmail('');
        setRegisterPhone('');
        setRegisterCard('');
      } catch (err: any) {
        alert(err.message || 'Registration failed.');
      }
    }
  };

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginEmail) {
      setLoginError('Please fill out all fields.');
      return;
    }

    const isPrivileged = loginRole === 'CEO' || loginRole === 'HR';
    if (!isPrivileged && !loginPassword) {
      setLoginError('Please fill out all fields.');
      return;
    }

    if (!isPrivileged) {
      const pwErrors = getPasswordValidationErrors(loginPassword);
      if (pwErrors.length > 0) {
        setLoginError(`Password does not meet REBMA policies:\n- ${pwErrors.join('\n- ')}`);
        return;
      }
    }

    setIsLoggingIn(true);
    try {
      if (isPrivileged) {
        const res = await auth.login(loginEmail, '', loginRole);
        alert(res.message || 'Magic link sent! Check your email.');
        setAuthScreen('email_verification_sent');
        addNotification(`Magic link request sent to whitelisted email ${loginEmail}`);
      } else {
        const res = await auth.login(loginEmail, loginPassword);
        
        if ('user' in res && res.user) {
          const userStatus = (res.user.status || '').toLowerCase();
          if (userStatus === 'pending' || userStatus === 'pending_approval') {
            await auth.signOut();
            setLoginError("Registration submitted. Please await HR approval");
            setLoginPassword('');
            return;
          }

          if (res.token) setToken(res.token);
          setCurrentUser({
            fullName: res.user.fullName,
            email: res.user.email,
            department: res.user.department,
            isCeo: res.user.isCeo,
            requiresPasswordReset: res.user.requiresPasswordReset
          });
          setActiveDepartment(res.user.department);
          setIsAuthenticated(true);
          addNotification(`Logged in as ${res.user.fullName} (${res.user.department})`);
          setLoginPassword('');
        }
      }
    } catch (err: any) {
      setLoginError(err.message || 'Login failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Workflow A action triggers
  const handleLogIntake = async (data: Omit<IncomingGoods, 'id' | 'status'>) => {
    try {
      await operations.logIntake({
        productName: data.productName,
        goodsCode: data.goodsCode,
        destination: data.destination,
        country: data.country,
        company: data.company,
        quantity: data.quantity,
        weight: data.weight,
        discrepancies: data.discrepancies,
        isFaulty: false,
        productImage: data.productImage
      });
      addNotification(`Operations logged new port cargo intake for ${data.company}. Sent to Management.`);
      refreshAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to log intake.');
    }
  };

  const handleApproveIntake = async (id: string, approve: boolean, price?: number) => {
    try {
      await management.approveIntake(id, approve, price);
      addNotification(`Management cargo approval updated.`);
      refreshAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to process cargo approval.');
    }
  };

  // Workflow B action triggers
  const handleCreateOrder = async (data: Partial<Order>) => {
    try {
      await marketing.createOrder({
        clientName: data.clientName || 'Unknown',
        productName: data.productName,
        destination: data.destination,
        ghanaCard: data.ghanaCard,
        paymentMode: data.paymentMode || 'CASH',
        totalAmount: data.totalAmount || 0
      });
      addNotification(`Marketing created order successfully. Routed to Finance.`);
      refreshAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to create order.');
    }
  };

  // Marketing Register Customer (now takes Partial<Customer> object from modal)
  const handleRegisterCustomer = async (data: Partial<Customer>) => {
    try {
      await marketing.registerCustomer({
        name: data.name || 'Unknown',
        phone: data.phone || '',
        location: data.location || '',
        companyName: data.companyName || data.name || '',
        ghanaCard: data.ghanaCard,
        email: data.email,
        photo: data.photo
      });
      addNotification(`Marketing registered new customer successfully.`);
      refreshAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to register customer.');
    }
  };

  const handleEvaluateOrder = async (id: string, approve: boolean) => {
    try {
      await finance.evaluateOrder(id, approve);
      addNotification(`Finance processed evaluation decision.`);
      refreshAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to evaluate order.');
    }
  };

  const handleManagementCreditDecision = async (id: string, approve: boolean) => {
    try {
      await management.approveCreditOrder(id, approve);
      addNotification(`Management credit decision submitted.`);
      refreshAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to process credit decision.');
    }
  };

  const handleFinalizeOrder = async (id: string) => {
    try {
      await finance.finalizeOrder(id);
      addNotification(`Finance generated invoice and warehouse fulfillment ticket.`);
      refreshAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to finalize order.');
    }
  };

  const handleReleaseToDispatch = async (id: string) => {
    try {
      const randomVehicle = `TRK-${Math.floor(100 + Math.random() * 900)}`;
      const randomDriver = 'Kwame Kyeremeh';
      await operations.releaseToDispatch(id, randomVehicle, randomDriver);
      addNotification(`Operations released order ${id} to dispatch fleet.`);
      refreshAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to release to dispatch.');
    }
  };

  const handleMarkDelivered = async (id: string) => {
    try {
      await dispatch.updateDelivery(id, 'DELIVERED', activeCoordinates);
      addNotification(`Order ${id} marked as DELIVERED.`);
      refreshAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to mark delivery status.');
    }
  };

  // Workflow D triggers
  const handleCheckInAttendance = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const target = e.target as any;
    const name = target.name.value.trim();
    
    // Find employee user by name
    const employee = staffList.find(s => s.fullName.toLowerCase() === name.toLowerCase());
    if (!employee) {
      alert(`Employee profile for "${name}" not found. Please register employee first via HR.`);
      return;
    }
    
    try {
      await reception.checkInAttendance(employee.id);
      addNotification(`Attendance check-in logged for ${employee.fullName}.`);
      refreshAllData();
      target.reset();
    } catch (err: any) {
      alert(err.message || 'Failed to check in employee.');
    }
  };

  const handleAddVisitor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const target = e.target as any;
    const fullName = target.visitor.value;
    const purpose = target.purpose.value;
    const hostName = target.host.value;

    try {
      await reception.checkInVisitor(fullName, purpose, hostName);
      addNotification(`Front desk: Visitor ${fullName} checked in for ${hostName}.`);
      refreshAllData();
      target.reset();
    } catch (err: any) {
      alert(err.message || 'Failed to log visitor.');
    }
  };

  const handleCheckoutVisitor = async (id: string) => {
    try {
      await reception.checkOutVisitor(id);
      addNotification(`Front desk: Visitor checked out.`);
      refreshAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to check out visitor.');
    }
  };

  // HR approvals
  const handleApproveUser = async (reg: PendingRegistration, pw: string) => {
    try {
      await hr.approveUser(reg.id, true, pw);
      addNotification(`User ${reg.fullName} approved successfully.`);
      refreshAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to approve user.');
    }
  };

  const handleDenyUser = async (reg: PendingRegistration) => {
    try {
      await hr.approveUser(reg.id, false);
      addNotification(`User ${reg.fullName} denied.`);
      refreshAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to deny user.');
    }
  };

  // Chat message submission
  const sendChatMessage = async (content: string) => {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          sender: currentUser?.fullName || 'Self',
          content: content,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      if (error) throw error;
    } catch (err: any) {
      console.error('Failed to send chat message:', err);
    }
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

        {loginError && (
          <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-center text-xs text-rose-800 font-semibold leading-normal whitespace-pre-wrap">
            {loginError}
          </div>
        )}

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

        {/* Access Role Selection */}
        <div className="space-y-1">
          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Access Role</label>
          <select 
            value={loginRole}
            onChange={(e) => setLoginRole(e.target.value)}
            className="w-full bg-transparent border-b border-slate-200 pb-1.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
          >
            <option value="Staff">Employee / Staff (Password)</option>
            <option value="CEO">CEO Office (Magic Link)</option>
            <option value="HR">Human Resources (Magic Link)</option>
          </select>
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

        {/* Password Input (only shown for standard staff/employees) */}
        {loginRole === 'Staff' && (
          <>
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
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
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
          </>
        )}

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
              <span>{loginRole === 'CEO' || loginRole === 'HR' ? 'Sending Link...' : 'Signing In...'}</span>
            </>
          ) : (
            <span>{loginRole === 'CEO' || loginRole === 'HR' ? 'Send Magic Link' : 'Sign In'}</span>
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
              setRegisterDept('Human Resources');
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
              setRegisterDept('Production Line');
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

        {/* Phone Input */}
        <div className="flex items-center gap-2 border-b border-slate-200 focus-within:border-emerald-600 pb-1.5 transition-colors">
          <Phone className="w-4 h-4 text-slate-400" />
          <input 
            type="tel" 
            required 
            placeholder="Phone number (e.g. +233555123456)"
            value={registerPhone}
            onChange={(e) => setRegisterPhone(e.target.value)}
            className="w-full bg-transparent border-0 p-0 text-sm text-slate-800 placeholder-slate-400 focus:ring-0 focus:outline-none"
          />
        </div>

        {/* Registration is passwordless. Temporary password will be generated upon HR approval. */}

        {/* Department Dropdown */}
        <div className="space-y-1">
          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Target Department</label>
          <select 
            value={registerDept}
            onChange={(e) => setRegisterDept(e.target.value)}
            className="w-full bg-transparent border-b border-slate-200 pb-1.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
          >
            <option value="CEO Office (OTP verification)">CEO Office (OTP verification)</option>
            <option value="Management Office">Management Office</option>
            <option value="Human Resources">Human Resources</option>
            <option value="Marketing Department">Marketing Department</option>
            <option value="Operations (Warehouse)">Operations (Warehouse)</option>
            <option value="Finance (Ledgers)">Finance (Ledgers)</option>
            <option value="Production Line">Production Line</option>
            <option value="Reception Desk">Reception Desk</option>
            <option value="Dispatch Fleet">Dispatch Fleet</option>
            <option value="Logistics & Supply Chain">Logistics & Supply Chain</option>
          </select>
        </div>

        {/* Ghana Card ID Input */}
        {getNormalizedRole(registerDept) !== 'CEO' && (
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

        {(getNormalizedRole(registerDept) === 'CEO' || getNormalizedRole(registerDept) === 'HR') && (
          <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100 text-[9px] text-amber-600 leading-normal font-medium">
            <strong>Privileged Role Verification Active:</strong> Phone verification required. Ensure your phone number matches the whitelisted configuration.
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

    /* SMS OTP Form removed */

    const renderEmailVerificationSentCard = () => (
      <motion.div
        key="email_verification_sent"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10 }}
        className="space-y-4 text-slate-800 text-center"
      >
        <h3 className="text-xl font-bold text-emerald-800">Login Link Dispatched</h3>
        <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 text-xs text-emerald-800 leading-relaxed font-medium">
          A login link has been sent to your email. Click the link to access the REBMA IMPEX ERP.
        </div>
        <p className="text-[10px] text-slate-400">
          The link is valid for 1 hour.
        </p>
        <button
          type="button"
          onClick={() => setAuthScreen('login')}
          className="w-full py-2.5 bg-gradient-to-r from-[#5ce1ab] to-[#34d399] hover:from-[#4fd69e] hover:to-[#059669] rounded-full text-xs font-bold text-slate-900 shadow-md hover:shadow-lg transition-all cursor-pointer text-center"
        >
          ← Return to Login
        </button>
      </motion.div>
    );

    const renderActivationExpiredCard = () => (
      <motion.div
        key="activation_expired"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10 }}
        className="space-y-4 text-slate-800 text-center"
      >
        <h3 className="text-xl font-bold text-rose-800">Login Link Expired</h3>
        <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100 text-xs text-rose-800 leading-relaxed font-medium">
          Your login link has expired. Please return to the login screen and request a new link.
        </div>
        <button
          type="button"
          onClick={() => setAuthScreen('login')}
          className="w-full py-2.5 bg-gradient-to-r from-[#5ce1ab] to-[#34d399] hover:from-[#4fd69e] hover:to-[#059669] rounded-full text-xs font-bold text-slate-900 shadow-md hover:shadow-lg transition-all cursor-pointer text-center"
        >
          ← Return to Login
        </button>
      </motion.div>
    );

    // Helper view for welcome options inside the white card
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
                {/* SMS OTP Flow retracted */}
                {authScreen === 'email_verification_sent' && renderEmailVerificationSentCard()}
                {authScreen === 'activation_expired' && renderActivationExpiredCard()}
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

        {renderAlertModal()}
      </div>
    );
  }

  const handleSetPrice = async (price: Omit<GoodsPrice, 'id'>) => {
    try {
      await management.setPrice({
        productName: price.productName,
        category: price.category,
        unitPrice: price.unitPrice,
        currency: price.currency
      });
      addNotification(`Management set price for ${price.productName}: ${price.currency} ${price.unitPrice}`);
      refreshAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to set price.');
    }
  };

  const renderDashboard = () => {
    if (currentUser?.requiresPasswordReset) {
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
          activeSubTab="ChangePassword"
          currentUser={currentUser}
          addNotification={addNotification}
        />
      );
    }

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
            pendingRegistrations={pendingRegistrations}
            staffList={staffList}
            onApprove={handleApproveUser}
            onDeny={handleDenyUser}
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
            addNotification={addNotification}
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
        activeDepartment={currentUser?.requiresPasswordReset ? 'SETTINGS' : activeDepartment}
        setActiveDepartment={currentUser?.requiresPasswordReset ? () => {} : setActiveDepartment}
        activeSubTab={currentUser?.requiresPasswordReset ? 'ChangePassword' : activeSubTab}
        setActiveSubTab={currentUser?.requiresPasswordReset ? () => {} : setActiveSubTab}
        theme={theme}
        currentUser={currentUser}
        onLogout={async () => {
          await auth.signOut();
          setIsAuthenticated(false);
          setCurrentUser(null);
        }}
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

      {renderAlertModal()}
      {renderPromptModal()}
      {renderConfirmModal()}
    </div>
  );
}
