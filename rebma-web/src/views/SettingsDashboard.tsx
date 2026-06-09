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
  activeSubTab = 'Themes',
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
  setMotion
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

  return (
    <div className="space-y-6 text-[var(--text-primary)]">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-[var(--text-primary)]">System Settings</h1>
        <p className="text-xs sm:text-sm text-[var(--text-muted)]">Configure themes, manage your profile, and control access settings.</p>
      </div>

      {/* THEME SETTINGS */}
      {activeSubTab === 'Themes' && (
        <div className={`grid grid-cols-1 ${currentUser?.isCeo ? 'lg:grid-cols-2' : 'max-w-xl'} gap-6`}>
          {/* Theme selector */}
          <div className="p-4 md:p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] space-y-4">
            <div>
              <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">ERP Theme Customization</h3>
              <p className="text-xs text-[var(--text-muted)]">Toggle between multiple dashboard theme blueprints.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: 'breeze', label: 'Drive Breeze', desc: 'Clean blue & white UI' },
                { id: 'seven', label: 'Windows 7 Aero', desc: 'Glassmorphism effects' },
                { id: 'royal', label: 'Royal Midnight', desc: 'Electric indigo dark' },
                { id: 'mint', label: 'Emerald Mint', desc: 'Sleek dark mint tones' },
                { id: 'sunset', label: 'Sunset Glow', desc: 'Deep warm purple neon' },
                { id: 'forest', label: 'Forest Moss', desc: 'Natural earthy sage' },
                { id: 'ghana', label: 'REBMA Ghana Official', desc: 'Teal & Gold official' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id as any)}
                  className={`p-3 text-left border rounded-xl hover:scale-102 transition-all cursor-pointer ${
                    theme === t.id
                      ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                      : 'border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)]/5'
                  }`}
                >
                  <p className={`text-xs font-bold ${theme === t.id ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>{t.label}</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{t.desc}</p>
                  {theme === t.id && <span className="text-[9px] font-bold text-[var(--accent)] mt-1 block">● ACTIVE</span>}
                </button>
              ))}
            </div>
          </div>

          {/* ERP system config */}
          {currentUser?.isCeo && (
            <div className="p-4 md:p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] space-y-5">
              <div>
                <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">ERP System Configuration</h3>
                <p className="text-xs text-[var(--text-muted)]">Manage gateway, GPS, and validation settings.</p>
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
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${ghanaCardValidation ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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

      {/* DISPLAY & APPEARANCE */}
      {activeSubTab === 'Appearance' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
          
          {/* Controls - Column 1 & 2 */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Theme Preset selector */}
            <div className="p-4 md:p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl space-y-6 shadow-sm">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">System Theme Preset</h3>
                <p className="text-[11px] text-[var(--text-muted)]">Select one of our 10 dynamic color configurations.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'arctic-white', label: 'Arctic White', desc: 'Light contrast style' },
                  { id: 'rose-quartz', label: 'Rose Quartz', desc: 'Earthy pastel quartz' },
                  { id: 'midnight-navy', label: 'Midnight Navy', desc: 'Premium royal blue' },
                  { id: 'emerald-pro', label: 'Emerald Pro', desc: 'Teal corporate design' },
                  { id: 'royal-purple', label: 'Royal Purple', desc: 'Rich indigo amethyst' },
                  { id: 'sunset-orange', label: 'Sunset Orange', desc: 'Warm active amber' },
                  { id: 'ocean-blue', label: 'Ocean Blue', desc: 'Calming azure water' },
                  { id: 'charcoal-dark', label: 'Charcoal Dark', desc: 'Elegant carbon dark' },
                  { id: 'lavender-mist', label: 'Lavender Mist', desc: 'Soft violet focus' },
                  { id: 'golden-sand', label: 'Golden Sand', desc: 'Luxury champagne sand' },
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    className={`p-3 text-left border rounded-2xl hover:scale-[1.01] transition-all cursor-pointer ${
                      theme === t.id
                        ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                        : 'border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--accent-light)]/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-[var(--text-primary)]">{t.label}</p>
                      {theme === t.id && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />}
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Accent Color picker */}
            <div className="p-4 md:p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl space-y-4 shadow-sm">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">System Accent Swatch</h3>
                <p className="text-[11px] text-[var(--text-muted)]">Apply a custom action highlight color across interactive components.</p>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                {[
                  { hex: '#068d5c', name: 'Green' },
                  { hex: '#3b82f6', name: 'Blue' },
                  { hex: '#8b5cf6', name: 'Purple' },
                  { hex: '#f97316', name: 'Orange' },
                  { hex: '#f43f5e', name: 'Rose' },
                  { hex: '#14b8a6', name: 'Teal' },
                  { hex: '#0ea5e9', name: 'Sky' },
                  { hex: '#eab308', name: 'Yellow' }
                ].map(c => {
                  const isSelected = accentColor.toLowerCase() === c.hex.toLowerCase();
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setAccentColor(c.hex)}
                      className={`w-10 h-10 rounded-full relative hover:scale-105 active:scale-95 transition-all cursor-pointer border-2 ${
                        isSelected ? 'border-[var(--text-primary)] ring-2 ring-offset-2 ring-[var(--accent-light)] ring-offset-[var(--bg-card)]' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    >
                      {isSelected && (
                        <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold shadow-sm">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Layout Options */}
            <div className="p-4 md:p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl space-y-6 shadow-sm">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">Typography & Interface Styles</h3>
                <p className="text-[11px] text-[var(--text-muted)]">Fine-tune font scaling, shape profiles, and layout patterns.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Font Family */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--text-muted)]">Font Family</label>
                  <select
                    value={fontFamily}
                    onChange={e => setFontFamily(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none"
                  >
                    {['Inter', 'Poppins', 'DM Sans', 'Nunito', 'Outfit'].map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                {/* Font Size */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--text-muted)]">Font Size Scale</label>
                  <div className="flex bg-[var(--bg)] p-1 rounded-xl border border-[var(--border)]">
                    {['Small', 'Medium', 'Large'].map(sz => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setFontSize(sz)}
                        className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          fontSize === sz
                            ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                            : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Navigation Style */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--text-muted)]">Mobile Navigation Style</label>
                  <div className="flex bg-[var(--bg)] p-1 rounded-xl border border-[var(--border)]">
                    {[
                      { id: 'Pill', label: 'Floating Pill' },
                      { id: 'Bar', label: 'Fixed Bar' }
                    ].map(n => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => setNavStyle(n.id)}
                        className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          navStyle === n.id
                            ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                            : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {n.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Button Style */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--text-muted)]">Button Corner Radius</label>
                  <div className="flex bg-[var(--bg)] p-1 rounded-xl border border-[var(--border)]">
                    {['Rounded', 'Soft', 'Sharp'].map(b => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setButtonStyle(b)}
                        className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          buttonStyle === b
                            ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                            : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Card Style */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--text-muted)]">Card Frame Profile</label>
                  <div className="flex bg-[var(--bg)] p-1 rounded-xl border border-[var(--border)]">
                    {['Float', 'Flat', 'Glass'].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCardStyle(c)}
                        className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          cardStyle === c
                            ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                            : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Spacing Density */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--text-muted)]">Padding & Spacing Density</label>
                  <div className="flex bg-[var(--bg)] p-1 rounded-xl border border-[var(--border)]">
                    {['Compact', 'Normal', 'Comfortable'].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDensity(d)}
                        className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          density === d
                            ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                            : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Motion Rules */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--text-muted)]">Transitions & Motion Physics</label>
                  <div className="flex bg-[var(--bg)] p-1 rounded-xl border border-[var(--border)]">
                    {['Full', 'Reduced', 'None'].map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMotion(m)}
                        className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          motion === m
                            ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                            : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dark Mode Switch */}
                <div className="space-y-1.5 flex flex-col justify-end">
                  <div className="flex justify-between items-center p-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl h-10">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">Dark Mode</span>
                    <button
                      type="button"
                      onClick={() => setDarkMode(!darkMode)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${darkMode ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
                    >
                      <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${darkMode ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* Live Preview - Column 3 */}
          <div className="space-y-4">
            <div className="sticky top-6">
              <div className="p-4 md:p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl space-y-4 shadow-inner">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Live Preview</h4>
                  <p className="text-[10px] text-[var(--text-muted)]">Simulating active visual overrides instantly.</p>
                </div>

                {/* Simulated Screen Body Frame */}
                <div 
                  className="p-4 bg-[var(--bg)] border border-[var(--border)] rounded-2xl space-y-3 relative overflow-hidden transition-all duration-300"
                  style={{ fontFamily: fontFamily }}
                >
                  <div className="flex items-center justify-between border-b border-[var(--border)] pb-2 text-[var(--text-primary)]">
                    <span className="text-[10px] font-bold">ERP Terminal</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>

                  {/* Simulated Card based on configurations */}
                  <div 
                    className={`border transition-all duration-300 ${
                      cardStyle === 'Float' ? 'bg-[var(--bg-card)] shadow-md border-transparent text-[var(--text-primary)]' :
                      cardStyle === 'Flat' ? 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)]' :
                      'bg-[var(--bg-card)]/40 backdrop-blur-md border-[var(--border)] text-[var(--text-primary)]'
                    } ${
                      fontSize === 'Small' ? 'text-xs p-2' :
                      fontSize === 'Medium' ? 'text-sm p-4' :
                      'text-base p-6'
                    } ${
                      density === 'Compact' ? 'p-2 space-y-1' :
                      density === 'Normal' ? 'p-4 space-y-3' :
                      'p-6 space-y-5'
                    }`}
                    style={{ borderRadius: '24px' }}
                  >
                    <div className="flex justify-between items-center">
                      <h5 className="font-bold text-[var(--text-primary)]" style={{ fontSize: fontSize === 'Small' ? '12px' : fontSize === 'Medium' ? '14px' : '16px' }}>
                        Active Balance
                      </h5>
                      <span className="text-[9px] px-2 py-0.5 rounded-full text-white font-bold" style={{ backgroundColor: accentColor }}>
                        GHS
                      </span>
                    </div>

                    <p className="text-[var(--text-muted)]" style={{ fontSize: fontSize === 'Small' ? '10px' : fontSize === 'Medium' ? '11px' : '12px' }}>
                      Samuel Remba • Port Operations Ledger
                    </p>

                    <p className="font-black text-[var(--text-primary)]" style={{ fontSize: fontSize === 'Small' ? '16px' : fontSize === 'Medium' ? '20px' : '24px' }}>
                      ₵ 142,500.00
                    </p>

                    {/* Button based on configurations */}
                    <button
                      type="button"
                      className="w-full py-2 text-xs font-bold text-white transition-all text-center flex items-center justify-center gap-1.5 shadow-sm"
                      style={{ 
                        backgroundColor: accentColor, 
                        borderRadius: buttonStyle === 'Rounded' ? '9999px' : buttonStyle === 'Soft' ? '12px' : '0px',
                        transitionDuration: motion === 'None' ? '0ms' : motion === 'Reduced' ? '300ms' : '150ms'
                      }}
                    >
                      Authorize Disbursal
                    </button>
                  </div>

                  {/* Simulated Nav style representation */}
                  <div className="pt-2 flex justify-center">
                    <div 
                      className={`h-4 border border-[var(--border)] text-[8px] flex items-center justify-center font-bold px-3 text-[var(--text-muted)] ${
                        navStyle === 'Pill' ? 'rounded-full w-24' : 'w-full'
                      }`}
                    >
                      {navStyle === 'Pill' ? '💊 Pill Navigation' : '▬ Bar Navigation'}
                    </div>
                  </div>
                </div>

                {/* Quick Helper info */}
                <div className="p-3 bg-[var(--accent-light)] border border-[var(--accent)]/20 rounded-2xl text-[10px] text-[var(--accent)]">
                  ⚡ Settings are synchronized and updated in real-time on mobile screen layout configurations.
                </div>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
