// rebma-web/src/views/SettingsDashboard.tsx

interface SettingsDashboardProps {
  theme: 'breeze' | 'seven' | 'royal' | 'mint' | 'sunset' | 'forest';
  setTheme: (theme: 'breeze' | 'seven' | 'royal' | 'mint' | 'sunset' | 'forest') => void;
  whitelistedCeos: string;
  setWhitelistedCeos: (emails: string) => void;
  smsGateway: string;
  setSmsGateway: (gateway: string) => void;
  gpsInterval: number;
  setGpsInterval: (interval: number) => void;
  ghanaCardValidation: boolean;
  setGhanaCardValidation: (val: boolean) => void;
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
  setGhanaCardValidation
}: SettingsDashboardProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">ERP System Settings</h1>
        <p className="text-sm text-slate-500 text-muted">Configure multiple themes, CEO whitelist contacts, and gateway APIs.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Theme selector */}
        <div className="p-6 app-card space-y-4">
          <div>
            <h3 className="text-lg font-bold">ERP Theme Customization</h3>
            <p className="text-xs text-slate-500 text-muted">Toggle between multiple dashboard theme blueprints.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'breeze', label: 'Drive Breeze (Screenshot theme)', desc: 'Clean blue & white UI curves' },
              { id: 'seven', label: 'Windows 7 Aero Glass', desc: 'Glassmorphism and Aero transparency' },
              { id: 'royal', label: 'Royal Midnight', desc: 'Electric indigo dark mode' },
              { id: 'mint', label: 'Emerald Mint', desc: 'Sleek dark mint tones' },
              { id: 'sunset', label: 'Sunset Glow', desc: 'Deep warm purple and neon highlights' },
              { id: 'forest', label: 'Forest Moss', desc: 'Natural earthy sage palettes' }
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
                <p className="text-xs font-bold text-slate-800">{t.label}</p>
                <p className="text-[10px] text-slate-400 mt-1">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Authentication bypass rules */}
        <div className="p-6 app-card space-y-4">
          <h3 className="text-lg font-bold">Bypass & Verification Controls</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Whitelisted CEO Contacts (emails)</label>
              <input 
                type="text" 
                value={whitelistedCeos}
                onChange={(e) => setWhitelistedCeos(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">Comma separated list of emails permitted to register with immediate OTP verification.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">SMS Gateway Engine</label>
                <select 
                  value={smsGateway}
                  onChange={(e) => setSmsGateway(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                >
                  <option value="arkesel">Arkesel Gateway (Ghana)</option>
                  <option value="hubtel">Hubtel API (Ghana)</option>
                  <option value="twilio">Twilio SMS Core</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">GPS Sync Stream (seconds)</label>
                <input 
                  type="number" 
                  value={gpsInterval}
                  onChange={(e) => setGpsInterval(parseInt(e.target.value) || 10)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-700">Strict Ghana Card Format Check</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Enforce standard format validation during signup.</p>
              </div>
              <input 
                type="checkbox" 
                checked={ghanaCardValidation}
                onChange={(e) => setGhanaCardValidation(e.target.checked)}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
