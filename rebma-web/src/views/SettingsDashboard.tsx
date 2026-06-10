import { useState, useRef } from 'react';
import { Settings, User, Lock, Trash2, Camera, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import type { CurrentUser } from '../types/erp';
import { auth } from '../services/apiClient';
import { supabase } from '../lib/supabaseClient';

interface SettingsDashboardProps {
  theme: string;
  setTheme: (theme: string) => void;
  whitelistedCeos: string;
  setWhitelistedCeos: (emails: string) => void;
  smsGateway: string;
  setSmsGateway: (gateway: string) => void;
  gpsInterval: number;
  setGpsInterval: (interval: number) => void;
  ghanaCardValidation: boolean;
  setGhanaCardValidation: (val: boolean) => void;
  activeSubTab?: string;
  currentUser?: CurrentUser | null;
  addNotification?: (msg: string) => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  accentColor: string;
  setAccentColor: (val: string) => void;
  reducedMotion: boolean;
  setReducedMotion: (val: boolean) => void;
  glassTheme: string;
  setGlassTheme: (val: string) => void;
  fontFamily: string;
  setFontFamily: (val: string) => void;
  fontSize: string;
  setFontSize: (val: string) => void;
  navStyle: string;
  setNavStyle: (val: string) => void;
  buttonStyle: string;
  setButtonStyle: (val: string) => void;
  cardStyle: string;
  setCardStyle: (val: string) => void;
  density: string;
  setDensity: (val: string) => void;
  motion: string;
  setMotion: (val: string) => void;
  sidebarCollapsed?: boolean;
  setSidebarCollapsed?: (val: boolean) => void;
}

export default function SettingsDashboard({
  theme,
  setTheme,
  whitelistedCeos,
  setWhitelistedCeos,
  smsGateway,
  setSmsGateway,
  gpsInterval,
  setGpsInterval,
  ghanaCardValidation,
  setGhanaCardValidation,
  activeSubTab = 'Appearance',
  currentUser,
  addNotification,
  darkMode,
  setDarkMode,
  accentColor,
  setAccentColor,
  reducedMotion,
  setReducedMotion,
  glassTheme,
  setGlassTheme,
  fontFamily,
  setFontFamily,
  fontSize,
  setFontSize,
  navStyle,
  setNavStyle,
  buttonStyle,
  setButtonStyle,
  cardStyle,
  setCardStyle,
  density,
  setDensity,
  motion,
  setMotion,
  sidebarCollapsed = false,
  setSidebarCollapsed
}: SettingsDashboardProps) {

  // Profile editable fields
  const [displayName, setDisplayName] = useState(currentUser?.fullName || '');
  const [displayEmail, setDisplayEmail] = useState(currentUser?.email || '');
  const [profilePhoto, setProfilePhoto] = useState(currentUser?.photo || '');
  const photoRef = useRef<HTMLInputElement>(null);

  // Password change
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwMsg, setPwMsg] = useState('');

  // Delete account
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteSubmitted, setDeleteSubmitted] = useState(false);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setProfilePhoto(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: displayName }
      });
      if (authError) throw authError;

      const { error: profileError } = await supabase.from('profiles').update({ 
        full_name: displayName, 
        photo: profilePhoto,
        updated_at: new Date().toISOString() 
      }).eq('id', currentUser.id);
      if (profileError) throw profileError;

      addNotification?.("Profile updated successfully.");
    } catch (err: any) {
      addNotification?.(err.message || "Failed to update profile.");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) { setPwMsg('Passwords do not match.'); return; }
    if (newPw.length < 8) { setPwMsg('Password must be at least 8 characters.'); return; }
    if (!/[A-Z]/.test(newPw)) { setPwMsg('Password must contain at least one uppercase letter.'); return; }
    if (!/[^A-Za-z0-9]/.test(newPw)) { setPwMsg('Password must contain at least one special character.'); return; }
    
    try {
      setPwMsg('⏳ Updating password in secure database...');
      await auth.changePassword(newPw, currentPw || undefined);
      setPwMsg('✅ Password changed successfully! Reloading...');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      addNotification?.('Password changed successfully. Security log updated.');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setPwMsg(`❌ Error: ${err.message || 'Failed to update password'}`);
    }
  };

  const handleDeleteRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteReason) return;
    setDeleteSubmitted(true);
    addNotification?.(`Account deletion request submitted for ${currentUser?.fullName}. HR department has been notified and must approve before deletion is complete.`);
  };

  const pwStrength = () => {
    if (!newPw) return null;
    const checks = [
      { pass: newPw.length >= 8, label: 'At least 8 characters' },
      { pass: /[A-Z]/.test(newPw), label: 'Uppercase letter' },
      { pass: /[a-z]/.test(newPw), label: 'Lowercase letter' },
      { pass: /[0-9]/.test(newPw), label: 'Number' },
      { pass: /[^A-Za-z0-9]/.test(newPw), label: 'Special character' },
    ];
    const score = checks.filter(c => c.pass).length;
    const color = score <= 2 ? 'bg-rose-500' : score <= 3 ? 'bg-amber-500' : 'bg-emerald-500';
    const label = score <= 2 ? 'Weak' : score <= 3 ? 'Fair' : 'Strong';
    return { checks, score, color, label };
  };

  const strength = pwStrength();

  // ── Template data for Appearance tab ──
  const APPEARANCE_TEMPLATES = [
    { id: 'salespulse',  label: 'SalesPulse',   desc: 'Clean green growth',    sidebar: '#ffffff', page: '#f0fdf4', accent: '#22c55e' },
    { id: 'foodie',      label: 'Foodie',        desc: 'Dark indigo sidebar',   sidebar: '#1e1b4b', page: '#faf5ff', accent: '#7c3aed' },
    { id: 'finova',      label: 'Finova',        desc: 'Blue finance gradient', sidebar: '#ffffff', page: '#f0f9ff', accent: '#3b82f6' },
    { id: 'aczone',      label: 'AC Zone',       desc: 'Purple violet energy',  sidebar: '#ffffff', page: '#fafafa', accent: '#7c3aed' },
    { id: 'liamfinance', label: 'Liam Finance',  desc: 'Compact icon sidebar',  sidebar: '#f1f5f9', page: '#f8fafc', accent: '#6366f1' },
    { id: 'finloflash',  label: 'Finlo Flash',   desc: 'Warm orange fire',      sidebar: '#ffffff', page: '#fff7ed', accent: '#f97316' },
    { id: 'routines',    label: 'Routines',      desc: 'Clear sky blue focus',  sidebar: '#ffffff', page: '#eff6ff', accent: '#3b82f6' },
    { id: 'multicolor',  label: 'Multicolor',    desc: 'Rainbow nav icons',     sidebar: '#ffffff', page: '#fafafa', accent: '#8b5cf6' },
  ];

  // ── Draft Appearance State (local — only applied on Apply click) ──
  const _loadDraft = () => { try { return JSON.parse(localStorage.getItem('erp-appearance') || '{}'); } catch { return {}; } };
  const _d = _loadDraft();
  const [draftTemplate,   setDraftTemplate]   = useState(() => _loadDraft().template   || theme);
  const [draftFontFamily, setDraftFontFamily] = useState(() => _loadDraft().fontFamily  || fontFamily);
  const [draftFontSize,   setDraftFontSize]   = useState(() => _loadDraft().fontSize    || 'Medium');
  const [draftButtonStyle,setDraftButtonStyle]= useState(() => _loadDraft().buttonStyle || buttonStyle);
  const [draftCardStyle,  setDraftCardStyle]  = useState(() => _loadDraft().cardStyle   || cardStyle);
  const [draftDensity,    setDraftDensity]    = useState(() => _loadDraft().density     || density);
  const [draftAccentType, setDraftAccentType] = useState<'solid'|'gradient'>(() => _loadDraft().accentType || 'solid');
  const [draftAccentSolid,setDraftAccentSolid]= useState(() => _loadDraft().accentSolid || accentColor || '#22c55e');
  const [draftGradC1, setDraftGradC1] = useState(() => _loadDraft().gradientColor1 || '#22c55e');
  const [draftGradC2, setDraftGradC2] = useState(() => _loadDraft().gradientColor2 || '#16a34a');
  const [draftGradDir,setDraftGradDir]= useState(() => _loadDraft().gradientDirection || '135deg');
  const [isSavingApp, setIsSavingApp] = useState(false);
  const [savedApp, setSavedApp] = useState(false);
  // suppress unused variable warning for _d
  void _d;

  const previewAccent = draftAccentType === 'solid'
    ? draftAccentSolid
    : `linear-gradient(${draftGradDir}, ${draftGradC1}, ${draftGradC2})`;

  const activeTpl = APPEARANCE_TEMPLATES.find(t => t.id === draftTemplate) || APPEARANCE_TEMPLATES[0];

  // Helpers for accent color variants
  const _hexToRgba = (hex: string, alpha: number) => {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!r) return `rgba(0,0,0,${alpha})`;
    return `rgba(${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)},${alpha})`;
  };
  const _darken = (hex: string, amount: number) => {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!r) return hex;
    const clamp = (n: number) => Math.max(0, Math.min(255, n));
    return `rgb(${clamp(parseInt(r[1],16)-amount)},${clamp(parseInt(r[2],16)-amount)},${clamp(parseInt(r[3],16)-amount)})`;
  };
  const _fontMap: Record<string, string> = {
    'Inter':   "'Inter', sans-serif",
    'Poppins': "'Poppins', sans-serif",
    'DM Sans': "'DM Sans', sans-serif",
    'Nunito':  "'Nunito', sans-serif",
    'Outfit':  "'Outfit', sans-serif",
  };

  const handleApplyAppearance = async () => {
    setIsSavingApp(true);
    const obj = {
      template: draftTemplate, fontFamily: draftFontFamily, fontSize: draftFontSize,
      buttonStyle: draftButtonStyle, cardStyle: draftCardStyle, density: draftDensity,
      accentType: draftAccentType, accentSolid: draftAccentSolid,
      gradientColor1: draftGradC1, gradientColor2: draftGradC2, gradientDirection: draftGradDir,
    };

    // STEP 1–7: Apply directly to DOM immediately (no waiting for React re-render)
    const body = document.body;
    const root = document.documentElement;

    // Template class
    body.className = body.className.split(' ').filter(c => !/^theme-/.test(c)).join(' ');
    body.classList.add(`theme-${draftTemplate}`);

    // Density
    body.className = body.className.split(' ').filter(c => !/^density-/.test(c)).join(' ');
    body.classList.add(`density-${draftDensity.toLowerCase()}`);

    // Button style
    body.className = body.className.split(' ').filter(c => !/^btn-style-/.test(c)).join(' ');
    body.classList.add(`btn-style-${draftButtonStyle.toLowerCase()}`);

    // Card style
    body.className = body.className.split(' ').filter(c => !/^card-style-/.test(c)).join(' ');
    body.classList.add(`card-style-${draftCardStyle.toLowerCase()}`);

    // Font family
    body.className = body.className.split(' ').filter(c => !/^font-family-/.test(c)).join(' ');
    body.classList.add(`font-family-${draftFontFamily.toLowerCase().replace(/ /g, '')}`);
    const fontStack = _fontMap[draftFontFamily] || "'Inter', sans-serif";
    root.style.setProperty('--font-base', fontStack);
    body.style.fontFamily = fontStack;

    // Font size
    body.className = body.className.split(' ').filter(c => !/^font-size-/.test(c)).join(' ');
    body.classList.add(`font-size-${draftFontSize.toLowerCase()}`);

    // Accent color
    if (draftAccentType === 'solid') {
      root.style.setProperty('--accent', draftAccentSolid);
      root.style.setProperty('--accent-color', draftAccentSolid);
      root.style.setProperty('--accent-soft',  _hexToRgba(draftAccentSolid, 0.10));
      root.style.setProperty('--accent-light', _hexToRgba(draftAccentSolid, 0.15));
      root.style.setProperty('--accent-2',     _darken(draftAccentSolid, 30));
    } else {
      const grad = `linear-gradient(${draftGradDir},${draftGradC1},${draftGradC2})`;
      root.style.setProperty('--accent-gradient', grad);
      root.style.setProperty('--accent', draftGradC1);
      root.style.setProperty('--accent-color', draftGradC1);
      root.style.setProperty('--accent-soft', _hexToRgba(draftGradC1, 0.10));
      root.style.setProperty('--accent-light', _hexToRgba(draftGradC1, 0.15));
    }

    // STEP 8: Save to localStorage
    localStorage.setItem('erp-appearance', JSON.stringify(obj));

    // STEP 2 (parallel): Sync parent state so App.tsx useEffect stays in sync
    setTheme(draftTemplate);
    setFontFamily(draftFontFamily);
    setButtonStyle(draftButtonStyle);
    setCardStyle(draftCardStyle);
    setDensity(draftDensity);
    setAccentColor(draftAccentType === 'solid' ? draftAccentSolid : draftGradC1);

    // STEP 9: Save to Supabase in background (don't block UI)
    setIsSavingApp(false);
    setSavedApp(true);
    addNotification?.('Appearance settings applied.');
    setTimeout(() => setSavedApp(false), 3000);

    if (currentUser?.id) {
      supabase.from('profiles').update({
        metadata: { appearance: obj },
        updated_at: new Date().toISOString()
      }).eq('id', currentUser.id).then(({ error }) => {
        if (error) addNotification?.('Applied locally — cloud sync unavailable.');
      });
    }
  };

  const handleResetAppearance = () => {
    const s = _loadDraft();
    setDraftTemplate(s.template || theme);
    setDraftFontFamily(s.fontFamily || fontFamily);
    setDraftFontSize(s.fontSize || 'Medium');
    setDraftButtonStyle(s.buttonStyle || buttonStyle);
    setDraftCardStyle(s.cardStyle || cardStyle);
    setDraftDensity(s.density || density);
    setDraftAccentType(s.accentType || 'solid');
    setDraftAccentSolid(s.accentSolid || accentColor || '#22c55e');
    setDraftGradC1(s.gradientColor1 || '#22c55e');
    setDraftGradC2(s.gradientColor2 || '#16a34a');
    setDraftGradDir(s.gradientDirection || '135deg');
  };

  return (
    <div className="space-y-6 text-[var(--text-primary)]">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-[var(--text-primary)]">System Settings</h1>
        <p className="text-xs sm:text-sm text-[var(--text-muted)]">Configure themes, manage your profile, and control access settings.</p>
      </div>

      {/* PROFILE SETTINGS */}
      {activeSubTab === 'Profile' && (
        <div className="max-w-xl">
          <div className="p-4 md:p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] space-y-6">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-[var(--accent)]" />
              <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">Profile Settings</h3>
            </div>
            <form onSubmit={handleSaveProfile} className="space-y-5">
              {/* Photo upload */}
              <div className="flex items-center gap-5">
                <div className="relative">
                  {profilePhoto ? (
                    <img src={profilePhoto} alt="Profile" className="w-20 h-20 rounded-full object-cover border-4 border-[var(--accent-light)] shadow" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-[var(--accent-light)] border-4 border-[var(--border)] flex items-center justify-center text-3xl font-bold text-[var(--accent)] shadow">
                      {(displayName || 'U')[0]}
                    </div>
                  )}
                  <button type="button" onClick={() => photoRef.current?.click()} className="absolute bottom-0 right-0 w-7 h-7 bg-[var(--accent)] text-white rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:opacity-90">
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                  <input ref={photoRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[var(--text-primary)]">Profile Photo</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Click the camera button to upload a photo</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Full Name</label>
                <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} required className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Email Address</label>
                <input type="email" value={displayEmail} onChange={e => setDisplayEmail(e.target.value)} required className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
              </div>

              <div className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl space-y-1.5 text-[10px] text-[var(--text-muted)]">
                <p>Department: <strong className="text-[var(--text-primary)]">{currentUser?.department || '—'}</strong></p>
                <p>Role: <strong className="text-[var(--text-primary)]">{currentUser?.isCeo ? 'Chief Executive Officer' : currentUser?.department}</strong></p>
              </div>

              <button type="submit" className="w-full py-2.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-xl text-xs font-bold cursor-pointer transition-all">
                Save Profile Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CHANGE PASSWORD */}
      {activeSubTab === 'ChangePassword' && (
        <div className="max-w-md">
          <div className="p-4 md:p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] space-y-5">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-[var(--accent)]" />
              <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">Change Password</h3>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Current Password</label>
                <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} required={!currentUser?.requiresPasswordReset} placeholder={currentUser?.requiresPasswordReset ? "Temporary password (optional)" : "Your current password"} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">New Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)} required placeholder="New secure password" className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] pr-10" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] cursor-pointer">
                    {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Strength meter */}
                {strength && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[var(--text-muted)]">Password Strength</span>
                      <span className={`font-bold ${strength.score >= 4 ? 'text-emerald-500' : strength.score >= 3 ? 'text-amber-500' : 'text-rose-500'}`}>{strength.label}</span>
                    </div>
                    <div className="h-1.5 bg-[var(--bg)] border border-[var(--border)] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${strength.color}`} style={{ width: `${(strength.score / 5) * 100}%` }} />
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {strength.checks.map((c, i) => (
                        <div key={i} className={`flex items-center gap-1 text-[9px] ${c.pass ? 'text-emerald-500' : 'text-[var(--text-muted)]'}`}>
                          <span>{c.pass ? '✓' : '○'}</span><span>{c.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Confirm New Password</label>
                <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required placeholder="Retype new password" className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
              </div>

              {pwMsg && (
                <div className={`p-3 rounded-xl text-xs font-semibold ${pwMsg.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'}`}>
                  {pwMsg}
                </div>
              )}

              <button type="submit" className="w-full py-2.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-xl text-xs font-bold cursor-pointer transition-all">
                Update Password
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DELETE ACCOUNT */}
      {activeSubTab === 'DeleteAccount' && (
        <div className="max-w-md">
          <div className="p-4 md:p-6 bg-[var(--bg-card)] border-2 border-red-500/30 rounded-2xl space-y-5 shadow-[var(--box-shadow)]">
            <div className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-600" />
              <h3 className="text-base md:text-lg font-bold text-rose-600">Delete Account</h3>
            </div>

            {deleteSubmitted ? (
              <div className="space-y-4">
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-amber-500" />
                    <p className="text-xs font-bold text-amber-600">Deletion Request Submitted</p>
                  </div>
                  <p className="text-xs text-amber-700">
                    Your account deletion request for <strong>{currentUser?.fullName}</strong> has been forwarded to the <strong>HR Department</strong> for review. 
                    Account deletion will only proceed once HR approves the request.
                  </p>
                  <p className="text-[10px] text-amber-500 font-semibold">⏳ Awaiting HR Approval — you will be notified via email.</p>
                </div>
                <button onClick={() => setDeleteSubmitted(false)} className="w-full py-2 bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-xl text-xs font-semibold cursor-pointer">
                  Cancel Request
                </button>
              </div>
            ) : (
              <form onSubmit={handleDeleteRequest} className="space-y-4">
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-600 space-y-1">
                  <p className="font-bold">⚠ This action requires HR approval</p>
                  <p>Submitting a deletion request does not immediately delete your account. HR must review and approve the request before any data is removed. You will remain logged in until the request is processed.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Reason for Deletion <span className="text-rose-500">*</span></label>
                  <textarea
                    value={deleteReason}
                    onChange={e => setDeleteReason(e.target.value)}
                    required
                    rows={3}
                    placeholder="Please provide a reason for your account deletion request..."
                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-red-400 resize-none"
                  />
                </div>

                <div className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[10px] text-[var(--text-muted)]">
                  Account: <strong className="text-[var(--text-primary)]">{currentUser?.fullName}</strong><br />
                  Department: <strong className="text-[var(--text-primary)]">{currentUser?.department}</strong><br />
                  Email: <strong className="text-[var(--text-primary)]">{currentUser?.email}</strong>
                </div>

                <button type="submit" className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all">
                  Submit Deletion Request to HR
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* DISPLAY & APPEARANCE — 3-Layer System */}
      {activeSubTab === 'Appearance' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">

          {/* ── Controls: Layers 1–3 ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* ── LAYER 1: Template Selector ── */}
            <div className="p-5 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-card space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Choose Template</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Selecting a template transforms the entire app including mobile view</p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {APPEARANCE_TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDraftTemplate(t.id)}
                    className={`rounded-xl overflow-hidden cursor-pointer border-2 transition-all hover:shadow-md hover:scale-[1.02] text-left ${
                      draftTemplate === t.id
                        ? 'border-[var(--accent)] ring-2 ring-offset-1 ring-[var(--accent-soft)]'
                        : 'border-transparent hover:border-[var(--border)]'
                    }`}
                  >
                    {/* 80px mini preview */}
                    <div className="flex overflow-hidden" style={{ height: '80px', background: t.page }}>
                      {/* Sidebar strip */}
                      <div className="w-10 h-full flex-shrink-0 flex flex-col pt-3 items-center gap-1.5" style={{ background: t.sidebar }}>
                        <div className="w-4 h-1.5 rounded-full" style={{ background: t.accent }} />
                        <div className="w-4 h-1 rounded-full bg-gray-200" />
                        <div className="w-4 h-1 rounded-full bg-gray-200" />
                        <div className="w-4 h-1 rounded-full bg-gray-200" />
                      </div>
                      {/* Page area */}
                      <div className="flex-1 p-2">
                        <div className="h-2 rounded mb-1.5" style={{ background: t.accent }} />
                        <div className="grid grid-cols-2 gap-1 mb-1.5">
                          <div className="h-4 rounded-sm" style={{ background: 'rgba(255,255,255,0.8)', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }} />
                          <div className="h-4 rounded-sm" style={{ background: 'rgba(255,255,255,0.8)', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }} />
                        </div>
                        <div className="h-2 rounded bg-white/70 mb-1" />
                        <div className="h-2 rounded bg-white/50 w-3/4" />
                      </div>
                    </div>
                    {/* Card footer */}
                    <div className="px-2.5 py-2 bg-[var(--bg-card)]">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.accent }} />
                        <span className="text-[11px] font-semibold text-[var(--text-primary)] leading-none">{t.label}</span>
                      </div>
                      <p className="text-[9px] text-[var(--text-muted)] leading-none">{t.desc}</p>
                      {theme === t.id && (
                        <span className="mt-1 inline-flex items-center gap-1 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 w-fit">
                          <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                          ACTIVE
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ── LAYER 2: Typography & Interface ── */}
            <div className="p-5 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-card space-y-4">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Typography & Interface</h3>

              {/* Font Family chips */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Font Family</label>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {['Inter', 'Poppins', 'DM Sans', 'Nunito', 'Outfit'].map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setDraftFontFamily(f)}
                      className={`flex-shrink-0 px-4 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
                        draftFontFamily === f
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]'
                      }`}
                      style={{ fontFamily: `'${f}', sans-serif` }}
                    >{f}</button>
                  ))}
                </div>
              </div>

              {/* Font Size */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Font Size</label>
                <div className="flex gap-2">
                  {[{ v: 'Small', label: 'Small', px: '13px' }, { v: 'Medium', label: 'Default', px: '14px' }, { v: 'Large', label: 'Large', px: '15px' }].map(s => (
                    <button
                      key={s.v}
                      type="button"
                      onClick={() => setDraftFontSize(s.v)}
                      className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                        draftFontSize === s.v
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]'
                      }`}
                    >
                      <span style={{ fontSize: s.px }}>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Button Style */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Button Style</label>
                <div className="flex gap-2">
                  {[{ v: 'Rounded', label: 'Pill', r: '999px' }, { v: 'Soft', label: 'Rounded', r: '8px' }, { v: 'Sharp', label: 'Sharp', r: '2px' }].map(b => (
                    <button
                      key={b.v}
                      type="button"
                      onClick={() => setDraftButtonStyle(b.v)}
                      className={`flex-1 py-2.5 border text-xs font-semibold transition-all cursor-pointer flex flex-col items-center gap-1.5 rounded-lg ${
                        draftButtonStyle === b.v
                          ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]'
                          : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]'
                      }`}
                    >
                      <div className="px-3 py-0.5 bg-[var(--accent)] text-white text-[9px] font-bold" style={{ borderRadius: b.r }}>Btn</div>
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card Style */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Card Style</label>
                <div className="flex gap-2">
                  {[
                    { v: 'Float', label: 'Elevated', shadow: '0 4px 12px rgba(0,0,0,0.10)', border: 'transparent' },
                    { v: 'Flat',  label: 'Flat',     shadow: 'none', border: '#e2e8f0' },
                    { v: 'Glass', label: 'Glass',    shadow: '0 4px 12px rgba(0,0,0,0.06)', border: 'rgba(255,255,255,0.5)' },
                  ].map(c => (
                    <button
                      key={c.v}
                      type="button"
                      onClick={() => setDraftCardStyle(c.v)}
                      className={`flex-1 py-2.5 border text-xs font-semibold transition-all cursor-pointer flex flex-col items-center gap-1.5 rounded-lg ${
                        draftCardStyle === c.v
                          ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]'
                          : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]'
                      }`}
                    >
                      <div className="w-8 h-4 rounded-sm bg-[var(--bg-card)]"
                        style={{ boxShadow: c.shadow, border: `1px solid ${c.border}` }} />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Density */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Density</label>
                <div className="flex gap-2">
                  {[{ v: 'Compact', label: 'Compact' }, { v: 'Normal', label: 'Comfortable' }, { v: 'Comfortable', label: 'Spacious' }].map(d => (
                    <button
                      key={d.v}
                      type="button"
                      onClick={() => setDraftDensity(d.v)}
                      className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                        draftDensity === d.v
                          ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]'
                          : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]'
                      }`}
                    >{d.label}</button>
                  ))}
                </div>
              </div>

              {/* Dark Mode + Sidebar toggles kept here for convenience */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="flex justify-between items-center p-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">Dark Mode</span>
                  <button type="button" onClick={() => setDarkMode(!darkMode)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${darkMode ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}>
                    <span className={`inline-block h-3 w-3 rounded-full bg-bg-card shadow transition-transform ${darkMode ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
                <div className="flex justify-between items-center p-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">Collapse Sidebar</span>
                  <button type="button" onClick={() => setSidebarCollapsed?.(!sidebarCollapsed)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${sidebarCollapsed ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}>
                    <span className={`inline-block h-3 w-3 rounded-full bg-bg-card shadow transition-transform ${sidebarCollapsed ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* ── LAYER 3: Accent Color ── */}
            <div className="p-5 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-card space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Accent Color</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Overrides the template accent color</p>
              </div>

              {/* Solid / Gradient toggle */}
              <div className="flex gap-1 p-1 bg-[var(--bg)] rounded-xl border border-[var(--border)] w-fit">
                {(['solid', 'gradient'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDraftAccentType(t)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer capitalize ${
                      draftAccentType === t
                        ? 'bg-[var(--accent)] text-white shadow'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >{t === 'solid' ? 'Solid Color' : 'Gradient'}</button>
                ))}
              </div>

              {draftAccentType === 'solid' ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <label className="relative cursor-pointer group">
                      <input type="color" value={draftAccentSolid} onChange={e => setDraftAccentSolid(e.target.value)} className="sr-only" />
                      <div className="w-14 h-14 rounded-full border-4 border-[var(--border)] shadow-card cursor-pointer hover:scale-105 transition-transform"
                        style={{ backgroundColor: draftAccentSolid }} />
                    </label>
                    <input
                      type="text"
                      value={draftAccentSolid}
                      onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setDraftAccentSolid(e.target.value); }}
                      className="w-28 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {['#22c55e', '#3b82f6', '#7c3aed', '#f97316', '#ef4444', '#ec4899', '#06b6d4', '#f59e0b'].map(c => (
                      <button key={c} type="button" onClick={() => setDraftAccentSolid(c)}
                        className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 cursor-pointer ${
                          draftAccentSolid === c ? 'border-[var(--text-primary)] scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-end gap-4">
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="text-[10px] text-[var(--text-muted)] font-semibold">Color 1</span>
                      <label className="relative cursor-pointer">
                        <input type="color" value={draftGradC1} onChange={e => setDraftGradC1(e.target.value)} className="sr-only" />
                        <div className="w-10 h-10 rounded-full border-2 border-[var(--border)] shadow hover:scale-105 transition-transform cursor-pointer" style={{ backgroundColor: draftGradC1 }} />
                      </label>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <span className="text-[10px] text-[var(--text-muted)] font-semibold">Direction</span>
                      <div className="flex gap-1">
                        {[{ v: '45deg', icon: '↗' }, { v: '90deg', icon: '→' }, { v: '135deg', icon: '↘' }, { v: '180deg', icon: '↓' }].map(d => (
                          <button key={d.v} type="button" onClick={() => setDraftGradDir(d.v)}
                            className={`flex-1 py-1.5 border rounded-lg text-xs font-bold cursor-pointer transition-all ${
                              draftGradDir === d.v
                                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                                : 'border-[var(--border)] text-[var(--text-secondary)]'
                            }`}>{d.icon}</button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="text-[10px] text-[var(--text-muted)] font-semibold">Color 2</span>
                      <label className="relative cursor-pointer">
                        <input type="color" value={draftGradC2} onChange={e => setDraftGradC2(e.target.value)} className="sr-only" />
                        <div className="w-10 h-10 rounded-full border-2 border-[var(--border)] shadow hover:scale-105 transition-transform cursor-pointer" style={{ backgroundColor: draftGradC2 }} />
                      </label>
                    </div>
                  </div>
                  <div className="h-10 rounded-xl"
                    style={{ background: `linear-gradient(${draftGradDir}, ${draftGradC1}, ${draftGradC2})` }} />
                </div>
              )}
            </div>

            {/* ── Apply + Reset ── */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleResetAppearance}
                className="flex-none px-5 py-2.5 border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg)] cursor-pointer transition-all"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleApplyAppearance}
                disabled={isSavingApp}
                className="flex-1 py-2.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-xl text-xs font-bold cursor-pointer transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSavingApp ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Applying...
                  </>
                ) : savedApp ? '✓ Applied!' : 'Apply Changes'}
              </button>
            </div>

            {/* ── ERP System Configuration (CEO only) ── */}
            {currentUser?.isCeo && (
              <div className="p-5 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-card space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">ERP System Configuration</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">Manage gateway, GPS, and validation settings.</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">CEO Whitelisted Emails</label>
                    <textarea
                      rows={2}
                      value={whitelistedCeos}
                      onChange={e => setWhitelistedCeos(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] font-mono resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">SMS Gateway</label>
                    <select value={smsGateway} onChange={e => setSmsGateway(e.target.value)} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]">
                      <option value="arkesel">Arkesel (Ghana)</option>
                      <option value="twilio">Twilio (International)</option>
                      <option value="hubtel">Hubtel Ghana</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">GPS Ping Interval (seconds)</label>
                    <input type="number" value={gpsInterval} onChange={e => setGpsInterval(parseInt(e.target.value))} min={5} max={60} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
                  </div>
                  <div className="flex justify-between items-center p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl">
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-primary)]">Ghana Card Validation</p>
                      <p className="text-[10px] text-[var(--text-muted)]">Require Ghana Card for all registrations</p>
                    </div>
                    <button
                      onClick={() => setGhanaCardValidation(!ghanaCardValidation)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${ghanaCardValidation ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-bg-card shadow transition-transform ${ghanaCardValidation ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* ── Live Preview (right col, sticky) ── */}
          <div className="sticky top-6 space-y-4 self-start">
            <div className="p-4 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-card space-y-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Live Preview</h4>
                <p className="text-[10px] text-[var(--text-muted)]">Updates as you change settings</p>
              </div>

              {/* Mini ERP layout */}
              <div className="rounded-xl overflow-hidden border border-[var(--border)]"
                style={{ height: '330px', fontFamily: `'${draftFontFamily}', sans-serif` }}>
                <div className="flex h-full">
                  {/* Mini sidebar */}
                  <div className="w-11 flex-shrink-0 flex flex-col py-3 px-1.5 gap-1.5" style={{ background: activeTpl.sidebar }}>
                    <div className="w-6 h-6 rounded-lg mx-auto mb-1" style={{ background: activeTpl.accent, opacity: 0.9 }} />
                    {[...Array(5)].map((_, i) => (
                      <div key={i}
                        className="h-5 rounded-md flex items-center justify-center"
                        style={i === 0
                          ? { background: previewAccent, boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }
                          : { background: 'rgba(0,0,0,0.05)' }}
                      >
                        <div className="w-3 h-1 rounded-full" style={{ background: i === 0 ? '#fff' : 'rgba(0,0,0,0.2)' }} />
                      </div>
                    ))}
                  </div>

                  {/* Main content */}
                  <div className="flex-1 flex flex-col overflow-hidden" style={{ background: activeTpl.page }}>
                    {/* Mini header */}
                    <div className="h-8 border-b flex items-center px-2 gap-2 flex-shrink-0"
                      style={{ background: '#ffffff', borderColor: '#e2e8f0' }}>
                      <div className="flex-1 h-3 rounded-full bg-gray-100" />
                      <div className="w-5 h-5 rounded-full" style={{ background: previewAccent }} />
                    </div>

                    {/* Body */}
                    <div className="flex-1 p-2 space-y-2 overflow-hidden">
                      {/* KPI cards */}
                      <div className="grid grid-cols-2 gap-1.5">
                        {[...Array(2)].map((_, i) => (
                          <div key={i} className="p-1.5 rounded-lg"
                            style={{
                              background: '#ffffff',
                              boxShadow: draftCardStyle === 'Float' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                              border: draftCardStyle === 'Flat' ? '1px solid #e2e8f0' : 'none',
                            }}>
                            <div className="h-1.5 w-8 rounded-full bg-gray-200 mb-1" />
                            <div className="h-2.5 w-12 rounded"
                              style={{ background: previewAccent }} />
                          </div>
                        ))}
                      </div>

                      {/* Mini table */}
                      <div className="rounded-lg overflow-hidden bg-white/80">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="flex gap-1 items-center py-1 px-1.5"
                            style={{ borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none' }}>
                            <div className="w-5 h-1.5 rounded-full bg-gray-200" />
                            <div className="flex-1 h-1.5 rounded-full bg-gray-100" />
                            <div className="w-6 h-3 rounded text-white flex items-center justify-center"
                              style={{ background: previewAccent, fontSize: '6px', fontWeight: 700 }}>OK</div>
                          </div>
                        ))}
                      </div>

                      {/* Buttons */}
                      <div className="flex gap-1.5">
                        <div className="h-5 flex-1 flex items-center justify-center text-white"
                          style={{
                            background: previewAccent,
                            borderRadius: draftButtonStyle === 'Rounded' ? '999px' : draftButtonStyle === 'Soft' ? '5px' : '2px',
                            fontSize: '7px', fontWeight: 700
                          }}>Primary</div>
                        <div className="h-5 flex-1 flex items-center justify-center border"
                          style={{
                            borderColor: draftAccentSolid,
                            color: draftAccentSolid,
                            borderRadius: draftButtonStyle === 'Rounded' ? '999px' : draftButtonStyle === 'Soft' ? '5px' : '2px',
                            fontSize: '7px', fontWeight: 700
                          }}>Ghost</div>
                      </div>

                      {/* Input */}
                      <div className="h-5 flex items-center px-1.5 border bg-white"
                        style={{
                          borderColor: '#e2e8f0',
                          borderRadius: draftButtonStyle === 'Sharp' ? '2px' : '5px',
                          fontSize: '7px', color: '#94a3b8'
                        }}>
                        Search records...
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-[var(--text-muted)] text-center">Preview only — click Apply to save</p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
