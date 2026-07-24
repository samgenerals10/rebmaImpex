// rebma-web/src/components/banani/primitives.tsx
// Exact-match "Banani UI 1" component kit. Every color/radius/shadow/spacing
// value here was pulled directly from the Banani-generated prototype's own
// compiled CSS (fetched via its screens.getActiveStructure API), not
// eyeballed from screenshots — see the design tokens below.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Loader2, TrendingUp, TrendingDown, Clock, Lock, Check, Eye } from 'lucide-react';

export type BananiTheme = typeof B;

// ── Design tokens (from Banani's generated :root) — dark, the prototype's
// native look. ────────────────────────────────────────────────────────────
export const B = {
  bg: '#0a0f1a',
  bgGradient: 'linear-gradient(160deg, #0d1117 0%, #0a0f1a 60%, #0f1525 100%)',
  card: '#111827',
  glass: 'rgba(255,255,255,0.03)',
  glassBorder: 'rgba(255,255,255,0.08)',
  sidebar: '#0a0f1a',
  surface2: '#192235',
  border: '#1e2736',
  input: '#151d2a',
  muted: '#1e2736',
  mutedFg: '#637085',
  fg: '#e7ebf3',
  primary: '#2d7ff9',
  primaryFg: '#ffffff',
  secondaryFg: '#7eb3ff',
  cyan: '#00d4ff',
  success: '#22c55e',
  successMuted: 'rgba(34,197,94,0.15)',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  highlightOverlay: 'rgba(255,255,255,0.05)',
  font: '"Space Grotesk", var(--font-base, ui-sans-serif), sans-serif',
  radiusSm: 6,
  radiusMd: 12,
  radiusLg: 16,
  radiusXl: 24,
};

// ── Light variant — same shape/brand hues, flipped for a white/light-gray
// surface (accent colors deepened slightly for AA contrast on white). ─────
export const LIGHT_B: BananiTheme = {
  bg: '#f8fafc',
  bgGradient: 'linear-gradient(160deg, #ffffff 0%, #f8fafc 55%, #eef2f7 100%)',
  card: '#ffffff',
  glass: 'rgba(15,23,42,0.035)',
  glassBorder: 'rgba(15,23,42,0.09)',
  sidebar: '#ffffff',
  surface2: '#f1f5f9',
  border: '#e2e8f0',
  input: '#f8fafc',
  muted: '#e2e8f0',
  mutedFg: '#64748b',
  fg: '#0f172a',
  primary: '#2563eb',
  primaryFg: '#ffffff',
  secondaryFg: '#1d4ed8',
  cyan: '#0891b2',
  success: '#16a34a',
  successMuted: 'rgba(22,163,74,0.12)',
  warning: '#d97706',
  danger: '#dc2626',
  purple: '#7c3aed',
  highlightOverlay: 'rgba(15,23,42,0.03)',
  font: B.font,
  radiusSm: B.radiusSm,
  radiusMd: B.radiusMd,
  radiusLg: B.radiusLg,
  radiusXl: B.radiusXl,
};

// Every primitive below reads its colors from this context instead of the
// static `B` export, so the whole kit can flip light/dark from one place —
// BananiShell wraps its output in <BananiThemeContext.Provider> based on the
// app's own light/dark toggle.
export const BananiThemeContext = createContext<BananiTheme>(B);
export const useBananiTheme = () => useContext(BananiThemeContext);

// ── Count-up number animation ───────────────────────────────────────────
// Real requestAnimationFrame-driven ticker: animates from the previous
// rendered value to the new one over ~1s with an ease-out curve, so a KPI
// jumping from 0 -> 300 visibly counts up rather than just appearing.
function useCountUp(target: number, duration = 1100) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  const firstRun = useRef(true);

  useEffect(() => {
    const from = firstRun.current ? 0 : fromRef.current;
    firstRun.current = false;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (target - from) * eased;
      setValue(current);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return value;
}

interface CountUpProps {
  value: number;
  format?: (n: number) => string;
  className?: string;
  style?: React.CSSProperties;
}

export function CountUp({ value, format, className, style }: CountUpProps) {
  const animated = useCountUp(value);
  const fmt = format || ((n: number) => Math.round(n).toLocaleString());
  return <span className={className} style={style}>{fmt(animated)}</span>;
}

export const fmtMoney = (n: number) => `GHS ${Math.round(n).toLocaleString()}`;
export const fmtCompactMoney = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `GHS ${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `GHS ${(n / 1_000).toFixed(1)}K`;
  return `GHS ${Math.round(n).toLocaleString()}`;
};

// ── KpiCard — glass card, glow orb, icon badge, trend pill, sparkline ───
interface KpiCardProps {
  icon: any;
  label: string;
  value: number;
  format?: (n: number) => string;
  trend?: string;
  trendUp?: boolean;
  color: string; // hex
  sparkline?: number[]; // 0-100 values, last one highlighted
  index?: number;
}

export function KpiCard({ icon: Icon, label, value, format, trend, trendUp = true, color, sparkline, index = 0 }: KpiCardProps) {
  const B = useBananiTheme();
  const bars = sparkline && sparkline.length > 0 ? sparkline : [40, 60, 45, 75, 55, 80, 90, 70, 95, 85];
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.05, duration: 0.35, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
      style={{
        display: 'flex', flexDirection: 'column', gap: 12, padding: 16, borderRadius: B.radiusXl,
        position: 'relative', overflow: 'hidden', background: B.glass,
        border: `1px solid ${color}40`, backdropFilter: 'blur(20px)',
        boxShadow: `0 0 30px ${color}33, inset 0 1px 0 ${B.highlightOverlay}`,
      }}
    >
      <div style={{ position: 'absolute', top: -16, right: -16, width: 80, height: 80, borderRadius: '50%', opacity: 0.2, background: color, filter: 'blur(20px)' }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative' }}>
        <div style={{ width: 40, height: 40, borderRadius: B.radiusMd, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}1f` }}>
          <Icon size={18} color={color} />
        </div>
        {trend && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: trendUp ? B.success : B.danger }}>
            {trendUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend}
          </div>
        )}
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ fontFamily: B.font, fontWeight: 700, fontSize: 24, color: B.fg, lineHeight: 1, letterSpacing: '-0.025em' }}>
          <CountUp value={value} format={format} />
        </div>
        <div style={{ fontSize: 13, color: B.mutedFg, marginTop: 4 }}>{label}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 20, position: 'relative' }}>
        {bars.map((h, i) => (
          <div key={i} style={{ flex: 1, borderRadius: 2, height: `${h}%`, background: i === bars.length - 1 ? color : `${color}1f`, opacity: i === bars.length - 1 ? 1 : 0.6 }} />
        ))}
      </div>
    </motion.div>
  );
}

// ── Badge ────────────────────────────────────────────────────────────────
export function Badge({ children, color, size = 'sm' }: { children: ReactNode; color: string; size?: 'sm' | 'xs' }) {
  return (
    <span style={{
      fontSize: size === 'xs' ? 9 : 11, fontWeight: 700, padding: size === 'xs' ? '2px 6px' : '2px 8px',
      borderRadius: 999, background: `${color}26`, color,
    }}>
      {children}
    </span>
  );
}

// ── Approval card — real action buttons, matches Banani's ApprovalCenter.
// Two variants confirmed from the actual prototype export: 'compact' is the
// tight pill-button card used in CEO's small Approval Center widget list;
// 'full' is the bigger card with a description line, divider, and full-width
// buttons used on Management's dedicated Approvals & Pricing page. ────────
interface ApprovalCardProps {
  title: string;
  priority: 'HIGH' | 'CRITICAL' | 'NORMAL';
  who: string;
  amount: number;
  ago: string;
  refId: string;
  description?: string;
  variant?: 'compact' | 'full';
  index?: number;
  onApprove: () => void | Promise<void>;
  onReject: () => void | Promise<void>;
  busy?: boolean;
}

export function ApprovalCard({ title, priority, who, amount, ago, refId, description, variant = 'compact', index = 0, onApprove, onReject, busy }: ApprovalCardProps) {
  const B = useBananiTheme();
  const PRIORITY_COLOR: Record<string, string> = { HIGH: B.warning, CRITICAL: B.danger, NORMAL: B.primary };
  const color = PRIORITY_COLOR[priority] || B.primary;
  const [acting, setActing] = useState<'approve' | 'reject' | null>(null);

  const run = async (kind: 'approve' | 'reject', fn: () => void | Promise<void>) => {
    if (busy || acting) return;
    setActing(kind);
    try { await fn(); } finally { setActing(null); }
  };

  if (variant === 'full') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index, 8) * 0.05, duration: 0.3 }}
        style={{
          display: 'flex', flexDirection: 'column', gap: 16, padding: 20, borderRadius: B.radiusXl,
          background: priority === 'CRITICAL' ? `${color}12` : `${B.card}`,
          border: `1px solid ${color}${priority === 'CRITICAL' ? '5c' : '2e'}`,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: B.fg }}>{title}</span>
            <Badge color={color}>{priority}</Badge>
          </div>
          <div style={{ fontSize: 13, color: B.mutedFg, marginBottom: description ? 8 : 0 }}>{who}</div>
          {description && <div style={{ fontSize: 13, color: B.mutedFg }}>{description}</div>}
        </div>
        <div style={{ borderTop: `1px solid ${B.border}` }} />
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: B.secondaryFg }}><CountUp value={amount} format={fmtMoney} /></div>
            <div style={{ fontSize: 12, color: B.mutedFg, marginTop: 4 }}>Request ID: {refId}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: B.mutedFg }}>Submitted</div>
            <div style={{ fontSize: 13, color: B.fg, fontWeight: 500 }}>{ago}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            disabled={busy || !!acting}
            onClick={() => run('reject', onReject)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 14, padding: '12px', borderRadius: B.radiusMd, fontWeight: 600, background: `${B.danger}14`, color: B.danger, border: `1px solid ${B.danger}40`, cursor: 'pointer', opacity: busy || !!acting ? 0.6 : 1 }}
          >
            {acting === 'reject' ? <Loader2 size={14} className="animate-spin" /> : '✕'} Reject
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            disabled={busy || !!acting}
            onClick={() => run('approve', onApprove)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 14, padding: '12px', borderRadius: B.radiusMd, fontWeight: 600, background: B.primary, color: '#fff', border: 'none', cursor: 'pointer', opacity: busy || !!acting ? 0.6 : 1 }}
          >
            {acting === 'approve' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve
          </motion.button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.05, duration: 0.3 }}
      style={{
        display: 'flex', flexDirection: 'column', gap: 12, padding: 14, borderRadius: B.radiusXl,
        background: priority === 'CRITICAL' ? `${color}14` : priority === 'HIGH' ? `${color}14` : `${color}0f`,
        border: `1px solid ${color}${priority === 'CRITICAL' ? '66' : '4d'}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: B.fg }}>{title}</span>
            <Badge color={color} size="xs">{priority}</Badge>
          </div>
          <div style={{ fontSize: 11, color: B.mutedFg }}>{who}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: B.fg }}>{fmtMoney(amount)}</div>
          <div style={{ fontSize: 11, color: B.mutedFg }}>{ago}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: B.mutedFg }}>{refId}</span>
        <div style={{ flex: 1 }} />
        <motion.button
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
          disabled={busy || !!acting}
          onClick={() => run('reject', onReject)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '6px 10px', borderRadius: B.radiusMd, fontWeight: 500, background: `${B.danger}26`, color: B.danger, border: `1px solid ${B.danger}4d`, cursor: 'pointer', opacity: busy || !!acting ? 0.6 : 1 }}
        >
          {acting === 'reject' ? <Loader2 size={11} className="animate-spin" /> : '✕'} Reject
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
          disabled={busy || !!acting}
          onClick={() => run('approve', onApprove)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '6px 10px', borderRadius: B.radiusMd, fontWeight: 500, background: `${B.success}26`, color: B.success, border: `1px solid ${B.success}4d`, cursor: 'pointer', opacity: busy || !!acting ? 0.6 : 1 }}
        >
          {acting === 'approve' ? <Loader2 size={11} className="animate-spin" /> : '✓'} Approve
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── Profile card — avatar, rating badge, stats, gradient action button ──
interface ProfileCardProps {
  name: string;
  sub: string;
  photo?: string | null;
  rating?: string;
  ratingColor?: string;
  stats: { label: string; value: string; accent?: boolean }[];
  actionLabel: string;
  onAction: () => void;
  index?: number;
}

export function ProfileCard({ name, sub, photo, rating, ratingColor, stats, actionLabel, onAction, index = 0 }: ProfileCardProps) {
  const B = useBananiTheme();
  const resolvedRatingColor = ratingColor || B.success;
  const initials = name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.05, duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16, borderRadius: B.radiusXl, background: B.glass, border: `1px solid ${B.glassBorder}` }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          {photo ? (
            <img src={photo} alt={name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${B.primary}26`, color: B.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{initials}</div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: B.fg, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
            <div style={{ fontSize: 11, color: B.mutedFg }}>{sub}</div>
          </div>
        </div>
        {rating && (
          <span style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: `${resolvedRatingColor}26`, color: resolvedRatingColor }}>{rating}</span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 12, paddingTop: 12, borderTop: `1px solid ${B.border}` }}>
        {stats.map(s => (
          <div key={s.label}>
            <div style={{ fontSize: 11, color: B.mutedFg, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: s.accent ? B.primary : B.fg }}>{s.value}</div>
          </div>
        ))}
      </div>
      <motion.button
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
        onClick={onAction}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, padding: '8px 12px', borderRadius: B.radiusMd, fontWeight: 500, color: '#fff', border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${B.primary}, #1e5fd8)` }}
      >
        <Eye size={13} /> {actionLabel}
      </motion.button>
    </motion.div>
  );
}

// ── Section card wrapper (matches ApprovalCenter/RevenueChart panel look) ─
export function BanCard({ title, icon: Icon, badge, badgeColor, action, index = 0, children, noPad }: {
  title?: string; icon?: any; badge?: string | number; badgeColor?: string; action?: ReactNode; index?: number; children: ReactNode; noPad?: boolean;
}) {
  const B = useBananiTheme();
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.06, duration: 0.35, ease: 'easeOut' }}
      style={{ display: 'flex', flexDirection: 'column', borderRadius: B.radiusXl, overflow: 'hidden', background: B.glass, border: `1px solid ${B.glassBorder}` }}
    >
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${B.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {Icon && <Icon size={16} color={B.primary} />}
            <span style={{ fontFamily: B.font, fontWeight: 600, fontSize: 15, color: B.fg }}>{title}</span>
            {badge !== undefined && (
              <span style={{ width: 20, height: 20, borderRadius: '50%', background: badgeColor || B.warning, color: badgeColor ? '#fff' : '#9fa2c9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{badge}</span>
            )}
          </div>
          {action}
        </div>
      )}
      <div style={{ padding: noPad ? 0 : 20 }}>{children}</div>
    </motion.div>
  );
}

// ── Approval workflow stepper ────────────────────────────────────────────
export interface StepDef { label: string; time?: string; state: 'done' | 'active' | 'pending'; }

export function Stepper({ steps }: { steps: StepDef[] }) {
  const B = useBananiTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', padding: '8px 4px' }}>
      {steps.map((s, i) => {
        const color = s.state === 'done' ? B.success : s.state === 'active' ? B.primary : B.border;
        const iconColor = s.state === 'pending' ? B.mutedFg : color;
        return (
          <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.1, type: 'spring', stiffness: 200 }}
              style={{ width: 48, height: 48, borderRadius: '50%', border: `2px solid ${color}`, background: s.state === 'pending' ? B.glass : `${color}26`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor, marginBottom: 8, zIndex: 1 }}
            >
              {s.state === 'done' ? <Check size={20} /> : s.state === 'active' ? <Clock size={18} /> : <Lock size={16} />}
            </motion.div>
            <span style={{ fontSize: 12, fontWeight: 600, color: s.state === 'pending' ? B.mutedFg : B.fg, textAlign: 'center' }}>{s.label}</span>
            <span style={{ fontSize: 10, color: B.mutedFg, textAlign: 'center' }}>{s.time || (s.state === 'pending' ? 'Awaiting' : s.state === 'active' ? 'In progress...' : '')}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Progress bar row (Quick Stats pattern) ──────────────────────────────
export function ProgressRow({ label, value, display, color, index = 0 }: { label: string; value: number; display: string; color: string; index?: number }) {
  const B = useBananiTheme();
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.05 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 20px', borderBottom: `1px solid ${B.border}` }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span style={{ color: B.mutedFg }}>{label}</span>
        <span style={{ fontWeight: 500, color: B.fg }}>{display}</span>
      </div>
      <div style={{ width: '100%', height: 4, borderRadius: 999, background: B.muted }}>
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${Math.min(100, value)}%` }} transition={{ duration: 0.8, delay: index * 0.05, ease: 'easeOut' }}
          style={{ height: '100%', borderRadius: 999, background: color, boxShadow: `0 0 6px ${color}99` }}
        />
      </div>
    </motion.div>
  );
}

// ── Table primitives (exact Banani classes as inline styles) ───────────
// Functions rather than static objects so callers pass the resolved theme:
// style={thStyle(B)} — needed because table cells sit inside BananiShell's
// own JSX, not inside a component that can call useBananiTheme() itself.
export const thStyle = (B: BananiTheme): React.CSSProperties => ({ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 600, color: B.mutedFg, borderBottom: `1px solid ${B.border}` });
export const tdStyle = (B: BananiTheme): React.CSSProperties => ({ padding: '12px 20px', fontSize: 13, color: B.fg, borderBottom: `1px solid ${B.border}` });

export function IconActionButton({ icon: Icon, color, onClick, disabled }: { icon: any; color: string; onClick: () => void; disabled?: boolean }) {
  const B = useBananiTheme();
  return (
    <motion.button
      whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
      onClick={onClick} disabled={disabled}
      style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: B.radiusMd, background: `${color}26`, color, border: 'none', cursor: 'pointer', opacity: disabled ? 0.5 : 1 }}
    >
      <Icon size={13} />
    </motion.button>
  );
}
