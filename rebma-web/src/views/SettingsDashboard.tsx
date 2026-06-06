import { useState, useRef } from 'react';
import { Settings, User, Lock, Trash2, Camera, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import type { CurrentUser } from '../types/erp';
import { auth } from '../services/apiClient';
import { supabase } from '../lib/supabaseClient';

interface SettingsDashboardProps {
  theme: 'breeze' | 'seven' | 'royal' | 'mint' | 'sunset' | 'forest' | 'ghana';
  setTheme: (theme: 'breeze' | 'seven' | 'royal' | 'mint' | 'sunset' | 'forest' | 'ghana') => void;
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
  addNotification
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">System Settings</h1>
        <p className="text-xs sm:text-sm text-slate-500 text-muted">Configure themes, manage your profile, and control access settings.</p>
      </div>

      {/* THEME SETTINGS */}
      {activeSubTab === 'Themes' && (
        <div className={`grid grid-cols-1 ${currentUser?.isCeo ? 'lg:grid-cols-2' : 'max-w-xl'} gap-6`}>
          {/* Theme selector */}
          <div className="p-4 md:p-6 app-card space-y-4">
            <div>
              <h3 className="text-base md:text-lg font-bold">ERP Theme Customization</h3>
              <p className="text-xs text-slate-500 text-muted">Toggle between multiple dashboard theme blueprints.</p>
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
                      ? 'border-blue-600 bg-blue-50/10'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <p className={`text-xs font-bold ${theme === t.id ? 'text-blue-700' : 'text-slate-700'}`}>{t.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{t.desc}</p>
                  {theme === t.id && <span className="text-[9px] font-bold text-blue-600 mt-1 block">● ACTIVE</span>}
                </button>
              ))}
            </div>
          </div>

          {/* ERP system config */}
          {currentUser?.isCeo && (
            <div className="p-4 md:p-6 app-card space-y-5">
              <div>
                <h3 className="text-base md:text-lg font-bold">ERP System Configuration</h3>
                <p className="text-xs text-slate-500 text-muted">Manage gateway, GPS, and validation settings.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">CEO Whitelisted Emails</label>
                  <textarea
                    rows={2}
                    value={whitelistedCeos}
                    onChange={e => setWhitelistedCeos(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 font-mono resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">SMS Gateway</label>
                  <select value={smsGateway} onChange={e => setSmsGateway(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none">
                    <option value="arkesel">Arkesel (Ghana)</option>
                    <option value="twilio">Twilio (International)</option>
                    <option value="hubtel">Hubtel Ghana</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">GPS Ping Interval (seconds)</label>
                  <input type="number" value={gpsInterval} onChange={e => setGpsInterval(parseInt(e.target.value))} min={5} max={60} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500" />
                </div>

                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">Ghana Card Validation</p>
                    <p className="text-[10px] text-slate-400">Require Ghana Card for all registrations</p>
                  </div>
                  <button
                    onClick={() => setGhanaCardValidation(!ghanaCardValidation)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${ghanaCardValidation ? 'bg-blue-600' : 'bg-slate-300'}`}
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
          <div className="p-4 md:p-6 app-card space-y-6">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-blue-500" />
              <h3 className="text-base md:text-lg font-bold">Profile Settings</h3>
            </div>
            <form onSubmit={handleSaveProfile} className="space-y-5">
              {/* Photo upload */}
              <div className="flex items-center gap-5">
                <div className="relative">
                  {profilePhoto ? (
                    <img src={profilePhoto} alt="Profile" className="w-20 h-20 rounded-full object-cover border-4 border-blue-200 shadow" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-blue-100 border-4 border-blue-200 flex items-center justify-center text-3xl font-bold text-blue-600 shadow">
                      {(displayName || 'U')[0]}
                    </div>
                  )}
                  <button type="button" onClick={() => photoRef.current?.click()} className="absolute bottom-0 right-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:bg-blue-700">
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                  <input ref={photoRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700">Profile Photo</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Click the camera button to upload a photo</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Full Name</label>
                <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email Address</label>
                <input type="email" value={displayEmail} onChange={e => setDisplayEmail(e.target.value)} required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500" />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-[10px] text-slate-500">
                <p>Department: <strong className="text-slate-700">{currentUser?.department || '—'}</strong></p>
                <p>Role: <strong className="text-slate-700">{currentUser?.isCeo ? 'Chief Executive Officer' : currentUser?.department}</strong></p>
              </div>

              <button type="submit" className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all">
                Save Profile Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CHANGE PASSWORD */}
      {activeSubTab === 'ChangePassword' && (
        <div className="max-w-md">
          <div className="p-4 md:p-6 app-card space-y-5">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-indigo-500" />
              <h3 className="text-base md:text-lg font-bold">Change Password</h3>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Current Password</label>
                <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} required={!currentUser?.requiresPasswordReset} placeholder={currentUser?.requiresPasswordReset ? "Temporary password (optional)" : "Your current password"} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">New Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)} required placeholder="New secure password" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 pr-10" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer">
                    {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Strength meter */}
                {strength && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">Password Strength</span>
                      <span className={`font-bold ${strength.score >= 4 ? 'text-emerald-600' : strength.score >= 3 ? 'text-amber-600' : 'text-rose-600'}`}>{strength.label}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${strength.color}`} style={{ width: `${(strength.score / 5) * 100}%` }} />
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {strength.checks.map((c, i) => (
                        <div key={i} className={`flex items-center gap-1 text-[9px] ${c.pass ? 'text-emerald-600' : 'text-slate-400'}`}>
                          <span>{c.pass ? '✓' : '○'}</span><span>{c.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Confirm New Password</label>
                <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required placeholder="Retype new password" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500" />
              </div>

              {pwMsg && (
                <div className={`p-3 rounded-xl text-xs font-semibold ${pwMsg.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {pwMsg}
                </div>
              )}

              <button type="submit" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all">
                Update Password
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DELETE ACCOUNT */}
      {activeSubTab === 'DeleteAccount' && (
        <div className="max-w-md">
          <div className="p-4 md:p-6 app-card space-y-5 border-2 border-rose-200">
            <div className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-600" />
              <h3 className="text-base md:text-lg font-bold text-rose-700">Delete Account</h3>
            </div>

            {deleteSubmitted ? (
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-amber-600" />
                    <p className="text-xs font-bold text-amber-800">Deletion Request Submitted</p>
                  </div>
                  <p className="text-xs text-amber-700">
                    Your account deletion request for <strong>{currentUser?.fullName}</strong> has been forwarded to the <strong>HR Department</strong> for review. 
                    Account deletion will only proceed once HR approves the request.
                  </p>
                  <p className="text-[10px] text-amber-600 font-semibold">⏳ Awaiting HR Approval — you will be notified via email.</p>
                </div>
                <button onClick={() => setDeleteSubmitted(false)} className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer">
                  Cancel Request
                </button>
              </div>
            ) : (
              <form onSubmit={handleDeleteRequest} className="space-y-4">
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 space-y-1">
                  <p className="font-bold">⚠ This action requires HR approval</p>
                  <p>Submitting a deletion request does not immediately delete your account. HR must review and approve the request before any data is removed. You will remain logged in until the request is processed.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Reason for Deletion <span className="text-rose-500">*</span></label>
                  <textarea
                    value={deleteReason}
                    onChange={e => setDeleteReason(e.target.value)}
                    required
                    rows={3}
                    placeholder="Please provide a reason for your account deletion request..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-rose-400 resize-none"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl text-[10px] text-slate-500">
                  Account: <strong className="text-slate-700">{currentUser?.fullName}</strong><br />
                  Department: <strong className="text-slate-700">{currentUser?.department}</strong><br />
                  Email: <strong className="text-slate-700">{currentUser?.email}</strong>
                </div>

                <button type="submit" className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all">
                  Submit Deletion Request to HR
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
