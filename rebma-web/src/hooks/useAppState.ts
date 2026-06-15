import { useState, useEffect, useRef } from 'react';
import { applyAccentOverride } from '../utils/accentOverride';
import type { CurrentUser, ChatMessage, FinancePayment, BoardroomMeeting, IncomingGoods, Order, ProductionRequest, Visitor, Attendance, Customer, AuditEntry, GoodsPrice, PendingRegistration, StaffMember } from '../types/erp';

const _getAppearance = () => {
  try { return JSON.parse(localStorage.getItem('erp-appearance') || '{}'); } catch { return {}; }
};

export function useAppState() {
  // ── Appearance ──────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<any>(() => {
    const a = _getAppearance(); return a.template || localStorage.getItem('erp-theme') || 'salespulse';
  });
  const [accentColor, setAccentColor] = useState<string>(() => {
    const a = _getAppearance(); return (a.accentType === 'solid' ? a.accentSolid : undefined) || localStorage.getItem('erp-accent') || '#22c55e';
  });
  const [fontFamily, setFontFamily] = useState<string>(() => {
    const a = _getAppearance(); return a.fontFamily || localStorage.getItem('erp-font') || 'Inter';
  });
  const [fontSize, setFontSize] = useState<string>(() => {
    const a = _getAppearance(); return a.fontSize || localStorage.getItem('erp-font-size') || 'Medium';
  });
  const [navStyle, setNavStyle] = useState<string>(() => {
    return localStorage.getItem('erp-nav-style') || 'Pill';
  });
  const [buttonStyle, setButtonStyle] = useState<string>(() => {
    const a = _getAppearance(); return a.buttonStyle || localStorage.getItem('erp-button-style') || 'Rounded';
  });
  const [cardStyle, setCardStyle] = useState<string>(() => {
    const a = _getAppearance(); return a.cardStyle || localStorage.getItem('erp-card-style') || 'Float';
  });
  const [density, setDensity] = useState<string>(() => {
    const a = _getAppearance(); return a.density || localStorage.getItem('erp-density') || 'Normal';
  });
  const [motionSetting, setMotionSetting] = useState<string>(() => {
    return localStorage.getItem('erp-motion') || 'Full';
  });
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('erp-dark-mode') === 'true';
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('erp-sidebar-collapsed') === 'true';
  });
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [glassTheme, setGlassTheme] = useState<string>('none');

  // ── Mobile overlays ─────────────────────────────────────────────────────────
  const [isMobileSearchActive, setIsMobileSearchActive] = useState<boolean>(false);
  const [isMobileNotificationsActive, setIsMobileNotificationsActive] = useState<boolean>(false);
  const [isQuickActionOpen, setIsQuickActionOpen] = useState<boolean>(false);
  const [activeMobileView, setActiveMobileView] = useState<'dashboard' | 'profile' | 'chat'>('dashboard');

  // ── Sync appearance to localStorage + DOM ───────────────────────────────────
  useEffect(() => {
    localStorage.setItem('erp-theme', theme);
    localStorage.setItem('erp-accent', accentColor);
    localStorage.setItem('erp-font', fontFamily);
    localStorage.setItem('erp-font-size', fontSize);
    localStorage.setItem('erp-nav-style', navStyle);
    localStorage.setItem('erp-button-style', buttonStyle);
    localStorage.setItem('erp-card-style', cardStyle);
    localStorage.setItem('erp-density', density);
    localStorage.setItem('erp-motion', motionSetting);
    localStorage.setItem('erp-dark-mode', String(darkMode));
    localStorage.setItem('erp-sidebar-collapsed', String(sidebarCollapsed));

    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark-mode');
    }

    const body = document.body;
    const classesToRemove = [
      /theme-\S+/, /font-family-\S+/, /font-size-\S+/,
      /btn-style-\S+/, /card-style-\S+/, /density-\S+/, /motion-\S+/,
    ];
    body.className = body.className.split(' ').filter(cls => {
      return !classesToRemove.some(regex => regex.test(cls));
    }).join(' ');
    body.classList.add(`theme-${theme}`);
    body.classList.add(`font-family-${fontFamily.toLowerCase().replace(/ /g, '')}`);
    body.classList.add(`font-size-${fontSize.toLowerCase()}`);
    body.classList.add(`btn-style-${buttonStyle.toLowerCase()}`);
    body.classList.add(`card-style-${cardStyle.toLowerCase()}`);
    body.classList.add(`density-${density.toLowerCase()}`);
    body.classList.add(`motion-${motionSetting.toLowerCase()}`);

    const root = document.documentElement;
    root.style.setProperty('--accent', accentColor);
    root.style.setProperty('--accent-color', accentColor);

    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
    };
    const rgb = hexToRgb(accentColor);
    if (rgb) {
      root.style.setProperty('--accent-light', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`);
      root.style.setProperty('--accent-soft',  `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.10)`);
      root.style.setProperty('--accent-hover', `rgba(${Math.max(0, rgb.r - 20)}, ${Math.max(0, rgb.g - 20)}, ${Math.max(0, rgb.b - 20)}, 1)`);
      root.style.setProperty('--accent-2',     `rgba(${Math.max(0, rgb.r - 30)}, ${Math.max(0, rgb.g - 30)}, ${Math.max(0, rgb.b - 30)}, 1)`);
    }

    const _fontMap: Record<string, string> = {
      'Inter':   "'Inter', sans-serif",
      'Poppins': "'Poppins', sans-serif",
      'DM Sans': "'DM Sans', sans-serif",
      'Nunito':  "'Nunito', sans-serif",
      'Outfit':  "'Outfit', sans-serif",
    };
    const _fontStack = _fontMap[fontFamily] || "'Inter', sans-serif";
    root.style.setProperty('--font-base', _fontStack);
    document.body.style.fontFamily = _fontStack;

    setReducedMotion(motionSetting === 'Reduced');
  }, [theme, accentColor, fontFamily, fontSize, navStyle, buttonStyle, cardStyle, density, motionSetting, darkMode]);

  // Restore accent override on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('erp-appearance') || '{}');
      if (saved.accentType && saved.accentType !== 'none') applyAccentOverride(saved);
    } catch { /* ignore */ }
  }, []);

  // Theme class safety sync
  useEffect(() => {
    const body = document.body;
    body.className = body.className.split(' ').filter(c => !c.startsWith('theme-')).join(' ');
    body.classList.add(`theme-${theme}`);
  }, [theme]);

  // ── Auth & navigation ───────────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [profileTempName, setProfileTempName] = useState<string>('');
  const [isEditingProfileName, setIsEditingProfileName] = useState<boolean>(false);
  const [chatTab, setChatTab] = useState<'global' | 'department'>('global');
  const [chatMobileInput, setChatMobileInput] = useState<string>('');

  const [activeDepartmentRaw, setActiveDepartmentRaw] = useState<string>(
    () => sessionStorage.getItem('rebma-last-dept') || 'CEO'
  );
  const [activeSubTabRaw, setActiveSubTabRaw] = useState<string>(
    () => sessionStorage.getItem('rebma-last-tab') || 'Overview'
  );
  const isInitialLoad = useRef(true);

  const setActiveDepartment = (department: string) => {
    setActiveDepartmentRaw(department);
    sessionStorage.setItem('rebma-last-dept', department);
  };
  const setActiveSubTab = (tab: string) => {
    setActiveSubTabRaw(tab);
    sessionStorage.setItem('rebma-last-tab', tab);
  };

  const [searchQuery, setSearchQuery] = useState<string>('');

  // ── Auth form state ─────────────────────────────────────────────────────────
  const [authScreen, setAuthScreen] = useState<'welcome' | 'login' | 'register' | 'otp' | 'forgot' | 'email_verification_sent' | 'activation_expired' | 'forgot_reset'>('login');
  const [resetPassword, setResetPassword] = useState<string>('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState<string>('');
  const [showResetPassword, setShowResetPassword] = useState<boolean>(false);
  const [resetMessage, setResetMessage] = useState<string>('');
  const [resetError, setResetError] = useState<string>('');
  const isResettingPassword = useRef(false);
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
  const [loginMethod, setLoginMethod] = useState<'password' | 'magic_link'>('password');
  const [showMagicLinkRequest, setShowMagicLinkRequest] = useState<boolean>(false);
  const [privName, setPrivName] = useState<string>('');
  const [privEmail, setPrivEmail] = useState<string>('');
  const [privPassword, setPrivPassword] = useState<string>('');
  const [privConfirmPassword, setPrivConfirmPassword] = useState<string>('');
  const [privRole, setPrivRole] = useState<string>('CEO');
  const [showPrivPassword, setShowPrivPassword] = useState<boolean>(false);
  const [isRegisteringPriv, setIsRegisteringPriv] = useState<boolean>(false);

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean; title: string; message: string; type: 'error' | 'success' | 'info';
  }>({ isOpen: false, title: '', message: '', type: 'info' });
  const [promptModal, setPromptModal] = useState<{
    isOpen: boolean; message: string; defaultValue: string; resolve: (val: string | null) => void;
  } | null>(null);
  const [promptInputValue, setPromptInputValue] = useState<string>('');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean; message: string; resolve: (val: boolean) => void;
  } | null>(null);

  // ── Domain data state ────────────────────────────────────────────────────────
  const [paymentsList, setPaymentsList] = useState<FinancePayment[]>([]);
  const [meetingsList, setMeetingsList] = useState<BoardroomMeeting[]>([
    { id: 'MTG-001', title: 'Q2 Strategy & Port Logistics Align', date: '2026-05-25', time: '10:00 AM', organizer: 'Samuel Remba', participants: ['CEO', 'OPERATIONS', 'FINANCE'] }
  ]);
  const [whitelistedCeos, setWhitelistedCeos] = useState<string>('ceo@rembaimpex.com, ceo2@rembaimpex.com');
  const [smsGateway, setSmsGateway] = useState<string>('arkesel');
  const [gpsInterval, setGpsInterval] = useState<number>(10);
  const [ghanaCardValidation, setGhanaCardValidation] = useState<boolean>(true);
  const [incomingGoodsList, setIncomingGoodsList] = useState<IncomingGoods[]>([]);
  const [ordersList, setOrdersList] = useState<Order[]>([]);
  const [productionRequests, setProductionRequests] = useState<ProductionRequest[]>([]);
  const [visitorsList, setVisitorsList] = useState<Visitor[]>([]);
  const [attendanceList, setAttendanceList] = useState<Attendance[]>([]);
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [goodsPrices, setGoodsPrices] = useState<GoodsPrice[]>([]);
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);

  // ── Live trades (login page animation) ──────────────────────────────────────
  const [liveTrades, setLiveTrades] = useState([
    { id: '1', type: 'BUY', item: 'Raw Cocoa Beans', qty: '50 MT', amount: '$160,000', dest: 'Tema Port', time: 'Just now' },
    { id: '2', type: 'SELL', item: 'Shea Butter', qty: '80 Crates', amount: '$12,500', dest: 'Rotterdam', time: '1 min ago' },
    { id: '3', type: 'BUY', item: 'Polymer Granules', qty: '200 Bags', amount: '$45,000', dest: 'Accra Depot', time: '3 mins ago' },
  ]);

  // ── Tracking & real-time ─────────────────────────────────────────────────────
  const [activeCoordinates, setActiveCoordinates] = useState<{ lat: number; lng: number }>({ lat: 5.6037, lng: -0.1870 });
  const [deliveryStatus, setDeliveryStatus] = useState<string>('IN_TRANSIT');

  // ── Chat & notifications ─────────────────────────────────────────────────────
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatMessages, setChatMessagesState] = useState<ChatMessage[]>([
    { id: '1', sender: 'System Terminal', content: 'Supabase Realtime initialized. Boardroom chat active.', time: '09:00 AM' },
  ]);
  const [boardroomMinutes, setBoardroomMinutes] = useState<string>(
    "REMBA IMPEX GHANA LIMITED Boardroom Log - May 24, 2026\n1. Target fleet tracking refresh set to 10s.\n2. Ghana card formats must validate correctly."
  );
  const [unreadEmailCount, setUnreadEmailCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<Array<{ id: string; msg: string; time: string }>>([]);

  return {
    // Appearance
    theme, setTheme,
    accentColor, setAccentColor,
    fontFamily, setFontFamily,
    fontSize, setFontSize,
    navStyle, setNavStyle,
    buttonStyle, setButtonStyle,
    cardStyle, setCardStyle,
    density, setDensity,
    motionSetting, setMotionSetting,
    darkMode, setDarkMode,
    sidebarCollapsed, setSidebarCollapsed,
    reducedMotion, setReducedMotion,
    glassTheme, setGlassTheme,
    // Mobile overlays
    isMobileSearchActive, setIsMobileSearchActive,
    isMobileNotificationsActive, setIsMobileNotificationsActive,
    isQuickActionOpen, setIsQuickActionOpen,
    activeMobileView, setActiveMobileView,
    // Auth & navigation
    isAuthenticated, setIsAuthenticated,
    currentUser, setCurrentUser,
    isAuthLoading, setIsAuthLoading,
    isSidebarOpen, setIsSidebarOpen,
    profileTempName, setProfileTempName,
    isEditingProfileName, setIsEditingProfileName,
    chatTab, setChatTab,
    chatMobileInput, setChatMobileInput,
    activeDepartment: activeDepartmentRaw, setActiveDepartment,
    activeSubTab: activeSubTabRaw, setActiveSubTab,
    isInitialLoad,
    searchQuery, setSearchQuery,
    // Auth form
    authScreen, setAuthScreen,
    resetPassword, setResetPassword,
    resetConfirmPassword, setResetConfirmPassword,
    showResetPassword, setShowResetPassword,
    resetMessage, setResetMessage,
    resetError, setResetError,
    isResettingPassword,
    registerEmail, setRegisterEmail,
    registerPhone, setRegisterPhone,
    loginEmail, setLoginEmail,
    loginPassword, setLoginPassword,
    registerDept, setRegisterDept,
    registerName, setRegisterName,
    registerCard, setRegisterCard,
    otpCode, setOtpCode,
    simulatedReceivedOtp, setSimulatedReceivedOtp,
    otpResendCountdown, setOtpResendCountdown,
    otpExpireCountdown, setOtpExpireCountdown,
    registrationMessage, setRegistrationMessage,
    password, setPassword,
    confirmPassword, setConfirmPassword,
    showPassword, setShowPassword,
    showConfirmPassword, setShowConfirmPassword,
    staySignedIn, setStaySignedIn,
    forgotEmail, setForgotEmail,
    forgotSubmitted, setForgotSubmitted,
    isLoggingIn, setIsLoggingIn,
    loginError, setLoginError,
    loginRole, setLoginRole,
    loginMethod, setLoginMethod,
    showMagicLinkRequest, setShowMagicLinkRequest,
    privName, setPrivName,
    privEmail, setPrivEmail,
    privPassword, setPrivPassword,
    privConfirmPassword, setPrivConfirmPassword,
    privRole, setPrivRole,
    showPrivPassword, setShowPrivPassword,
    isRegisteringPriv, setIsRegisteringPriv,
    // Modals
    alertModal, setAlertModal,
    promptModal, setPromptModal,
    promptInputValue, setPromptInputValue,
    confirmModal, setConfirmModal,
    // Domain data
    paymentsList, setPaymentsList,
    meetingsList, setMeetingsList,
    whitelistedCeos, setWhitelistedCeos,
    smsGateway, setSmsGateway,
    gpsInterval, setGpsInterval,
    ghanaCardValidation, setGhanaCardValidation,
    incomingGoodsList, setIncomingGoodsList,
    ordersList, setOrdersList,
    productionRequests, setProductionRequests,
    visitorsList, setVisitorsList,
    attendanceList, setAttendanceList,
    customersList, setCustomersList,
    auditLog, setAuditLog,
    goodsPrices, setGoodsPrices,
    pendingRegistrations, setPendingRegistrations,
    staffList, setStaffList,
    // Live trades
    liveTrades, setLiveTrades,
    // Tracking
    activeCoordinates, setActiveCoordinates,
    deliveryStatus, setDeliveryStatus,
    // Chat & notifications
    isChatOpen, setIsChatOpen,
    chatMessages, setChatMessagesState,
    boardroomMinutes, setBoardroomMinutes,
    unreadEmailCount, setUnreadEmailCount,
    notifications, setNotifications,
  };
}
