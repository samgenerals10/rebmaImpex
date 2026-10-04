// rebma-web/src/views/hr/BirthdaysView.tsx
// Web twin of rebma-mobile/screens/hr/BirthdaysScreen.tsx.
//
// HR → Birthdays (approved Part B). HR only, for staff and customers.
//  * Auto-send on/off and the sending time (default on, 08:00).
//  * Calendar with birthday days marked; browse back through past months.
//  * Click a day: everyone with a birthday then, what was sent, and "Send
//    wish": pick a template, edit for this person, tick Email / SMS /
//    WhatsApp. Email and SMS go via the server; WhatsApp opens in a new tab
//    with the message ready.
import { useEffect, useMemo, useState } from 'react';
import { Cake, Send } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import SidePanel from '../../components/ui/SidePanel';
import CalendarPicker, { toKey, type CalendarValue } from '../../components/ui/CalendarPicker';
import { useCeoSettings } from '../../contexts/CeoSettingsContext';
import { fillTemplate, type BirthdayTemplate } from './BirthdayTemplatesView';
import type { CurrentUser } from '../../types/erp';

interface Person { type: 'staff' | 'customer'; id: string; name: string; email: string | null; phone: string | null; photo: string | null; dob: string }
interface LogRow { person_type: string; person_id: string; email_sent: boolean; sms_sent: boolean; whatsapp_sent: boolean; message: string | null; sent_by: string | null; email_note: string | null; sms_note: string | null }

function birthdayKeyIn(dob: string, year: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob);
  if (!m) return null;
  const month = Number(m[2]);
  let day = Number(m[3]);
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  if (month === 2 && day === 29 && !leap) day = 28;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function whatsappDigits(phone: string): string {
  const s = phone.replace(/[^\d+]/g, '');
  if (s.startsWith('+')) return s.slice(1);
  if (s.startsWith('00')) return s.slice(2);
  if (s.startsWith('0')) return `233${s.slice(1)}`;
  return s;
}

const initials = (n: string) => n.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

interface Props { currentUser: CurrentUser | null; addNotification: (msg: string) => void }

export default function BirthdaysView({ currentUser, addNotification }: Props) {
  const { getSetting } = useCeoSettings();
  const masterOn = getSetting('birthday_wishes_enabled', true) !== false;
  const [people, setPeople] = useState<Person[]>([]);
  const [templates, setTemplates] = useState<BirthdayTemplate[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [autoSend, setAutoSend] = useState(true);
  const [sendTime, setSendTime] = useState('08:00');
  const [timeDraft, setTimeDraft] = useState('08:00');
  const [month, setMonth] = useState(new Date());
  const [selection, setSelection] = useState<CalendarValue>({ start: toKey(new Date()), end: toKey(new Date()) });

  const [composeFor, setComposeFor] = useState<Person | null>(null);
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [channels, setChannels] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const year = month.getFullYear();

  useEffect(() => {
    (async () => {
      const db = supabase as any;
      const [{ data: staff }, { data: customers }, { data: tpl }, { data: settings }] = await Promise.all([
        db.from('profiles').select('id, full_name, email, phone, photo, date_of_birth, status').not('date_of_birth', 'is', null),
        db.from('customers').select('*').not('date_of_birth', 'is', null),
        db.from('birthday_templates').select('*').order('created_at', { ascending: true }),
        db.from('birthday_settings').select('auto_send, send_time').eq('id', 'default').maybeSingle(),
      ]);
      // Staff without the app get birthday wishes too (their record is
      // non_app_staff; they are 'staff' with their own id).
      const { data: otherStaff } = await db.from('non_app_staff').select('id, full_name, phone, photo, date_of_birth, status').not('date_of_birth', 'is', null);
      setPeople([
        ...[...(staff || []), ...((otherStaff as any[]) || [])].filter((p: any) => String(p.status || '').toUpperCase() === 'ACTIVE')
          .map((p: any) => ({ type: 'staff' as const, id: String(p.id), name: p.full_name || '', email: p.email || null, phone: p.phone || null, photo: p.photo || null, dob: p.date_of_birth })),
        ...(customers || []).map((c: any) => ({ type: 'customer' as const, id: String(c.id), name: c.name || '', email: c.email || null, phone: c.phone || null, photo: c.customer_photo || c.photo || null, dob: c.date_of_birth })),
      ]);
      setTemplates((tpl as BirthdayTemplate[]) || []);
      if (settings) {
        setAutoSend(settings.auto_send !== false);
        setSendTime(settings.send_time || '08:00');
        setTimeDraft(settings.send_time || '08:00');
      }
    })();
  }, []);

  const loadLogs = async () => {
    const { data } = await supabase.from('birthday_wishes_log').select('*').eq('wish_year', year);
    setLogs((data as LogRow[]) || []);
  };
  useEffect(() => { loadLogs(); }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  const byDay = useMemo(() => {
    const map: Record<string, Person[]> = {};
    for (const p of people) {
      const key = birthdayKeyIn(p.dob, year);
      if (key) (map[key] = map[key] || []).push(p);
    }
    return map;
  }, [people, year]);
  const marks = useMemo(() => Object.fromEntries(Object.keys(byDay).map(k => [k, { color: '#f43f5e' }])), [byDay]);

  const selectedKey = selection.start || toKey(new Date());
  const dayPeople = byDay[selectedKey] || [];
  const logFor = (p: Person) => logs.find(l => l.person_type === p.type && l.person_id === p.id);

  const saveSettings = async (next: { auto_send?: boolean; send_time?: string }) => {
    const { error } = await supabase.from('birthday_settings').upsert({
      id: 'default', auto_send: next.auto_send ?? autoSend, send_time: next.send_time ?? sendTime,
      updated_by: currentUser?.fullName || 'HR', updated_at: new Date().toISOString(),
    });
    if (error) { addNotification(`Could not save: ${error.message}`); return false; }
    return true;
  };

  const openCompose = (p: Person) => {
    const usable = templates.filter(t => t.audience === p.type || t.audience === 'both');
    const def = usable.find(t => t.is_default && t.audience === p.type) || usable.find(t => t.is_default) || usable[0];
    setComposeFor(p);
    setTemplateId(def?.id || '');
    setSubject(def ? fillTemplate(def.email_subject, p.name) : 'Happy birthday from Rebma Impex');
    setMessage(def ? fillTemplate(def.body, p.name) : '');
    setChannels((def?.channels || ['email', 'sms']).filter(c => (c === 'email' ? !!p.email : !!p.phone)));
  };

  const pickTemplate = (id: string) => {
    const tpl = templates.find(x => x.id === id);
    setTemplateId(id);
    if (tpl && composeFor) {
      setSubject(fillTemplate(tpl.email_subject, composeFor.name));
      setMessage(fillTemplate(tpl.body, composeFor.name));
      setChannels(tpl.channels.filter(c => (c === 'email' ? !!composeFor.email : !!composeFor.phone)));
    }
  };

  const send = async () => {
    const p = composeFor;
    if (!p) return;
    if (!message.trim()) { addNotification('Write the message first.'); return; }
    if (!channels.length) { addNotification('Tick at least one way to send it.'); return; }
    setSending(true);
    try {
      const notes: string[] = [];
      const serverChannels = channels.filter(c => c !== 'whatsapp');
      if (serverChannels.length) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('Not authenticated.');
        const res = await fetch('/api/birthday-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ personType: p.type, personId: p.id, templateId: templateId || null, subject, message: message.trim(), channels: serverChannels, year }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Could not send.');
        notes.push(body.message || '');
      }
      if (channels.includes('whatsapp') && p.phone) {
        window.open(`https://wa.me/${whatsappDigits(p.phone)}?text=${encodeURIComponent(message.trim())}`, '_blank', 'noopener');
        await supabase.from('birthday_wishes_log').upsert(
          { person_type: p.type, person_id: p.id, person_name: p.name, wish_year: year, whatsapp_sent: true, message: message.trim(), template_id: templateId || null, sent_by: currentUser?.fullName || 'HR', sent_at: new Date().toISOString() },
          { onConflict: 'person_type,person_id,wish_year' },
        );
        notes.push('WhatsApp opened with the message ready.');
      }
      setComposeFor(null);
      addNotification(notes.filter(Boolean).join(' ') || 'Sent.');
      loadLogs();
    } catch (e: any) {
      addNotification(`Could not send: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  const chip = (ok: boolean | undefined, label: string) => (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ok ? 'bg-emerald-500/10 text-emerald-600' : 'bg-[var(--bg-input)] text-[var(--text-muted)]'}`}>{label} {ok ? 'sent' : 'not yet'}</span>
  );
  const inputCls = 'w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]';
  const dayLabel = new Date(`${selectedKey}T12:00:00`).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="p-4 lg:p-6 max-w-screen-lg mx-auto space-y-5">
      <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2"><Cake className="w-5 h-5 text-rose-500" /> Birthdays</h1>

      {!masterOn && (
        <div className="p-3 rounded-2xl bg-rose-500/10 text-sm text-rose-600">Birthday wishes are switched off by the CEO in Control Center, so nothing can be sent right now.</div>
      )}

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={autoSend} className="mt-1"
            onChange={async e => { const v = e.target.checked; setAutoSend(v); if (!(await saveSettings({ auto_send: v }))) setAutoSend(!v); }} />
          <span>
            <span className="block text-sm font-bold text-[var(--text-primary)]">Send automatically</span>
            <span className="block text-xs text-[var(--text-muted)]">Each birthday person gets the default template by email and SMS at the time below. Untick to send by hand.</span>
          </span>
        </label>
        {autoSend && (
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Sending time</label>
              <input type="time" value={timeDraft} onChange={e => setTimeDraft(e.target.value)} className="px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)]" />
            </div>
            <button disabled={timeDraft === sendTime} onClick={async () => {
              if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeDraft)) { addNotification('Pick a valid time.'); return; }
              if (await saveSettings({ send_time: timeDraft })) { setSendTime(timeDraft); addNotification(`Wishes go out at ${timeDraft}.`); }
            }} className="px-3 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40 cursor-pointer" style={{ background: 'var(--accent)' }}>Save</button>
          </div>
        )}
        {!templates.some(t => t.is_default) && (
          <p className="text-xs text-amber-600">No default template yet, so nothing can go out automatically. Set one in Birthday Templates.</p>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-[minmax(0,340px)_1fr]">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 self-start">
          <CalendarPicker month={month} onMonthChange={setMonth} value={selection} onChange={setSelection} marks={marks} />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-bold text-[var(--text-primary)]">{dayLabel}</p>
          {dayPeople.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">No birthdays on this day. Days with a dot on the calendar have birthdays.</p>
          ) : dayPeople.map(p => {
            const log = logFor(p);
            return (
              <div key={`${p.type}-${p.id}`} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  {p.photo
                    ? <img src={p.photo} alt={p.name} className="w-11 h-11 rounded-full object-cover" />
                    : <div className="w-11 h-11 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center text-sm font-bold">{initials(p.name)}</div>}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[var(--text-primary)]">{p.name}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{p.type === 'staff' ? 'Staff' : 'Customer'} · {p.phone || 'no phone'} · {p.email || 'no email'}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">{chip(log?.email_sent, 'Email')}{chip(log?.sms_sent, 'SMS')}{chip(log?.whatsapp_sent, 'WhatsApp')}</div>
                {log?.message && <p className="text-xs text-[var(--text-muted)] mt-2">Sent by {log.sent_by || 'HR'}: "{log.message}"</p>}
                {(log?.email_note || log?.sms_note) && <p className="text-xs text-rose-600 mt-1">{[log.email_note, log.sms_note].filter(Boolean).join(' ')}</p>}
                <button onClick={() => openCompose(p)} disabled={!masterOn}
                  className="mt-3 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white disabled:opacity-40 cursor-pointer" style={{ background: 'var(--accent)' }}>
                  <Send className="w-3.5 h-3.5" /> {log ? 'Send again' : 'Send wish'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <SidePanel open={!!composeFor} onClose={() => setComposeFor(null)} title="Send Birthday Wish" subtitle={composeFor?.name} width="lg"
        footer={<button onClick={send} disabled={sending} className="erp-btn erp-btn-primary w-full disabled:opacity-50">{sending ? 'Sending…' : 'Send'}</button>}>
        {composeFor && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Template</label>
              <select value={templateId} onChange={e => pickTemplate(e.target.value)} className={inputCls}>
                <option value="">{templates.length ? 'Pick a template' : 'No templates yet'}</option>
                {templates.filter(t => t.audience === composeFor.type || t.audience === 'both').map(t => (
                  <option key={t.id} value={t.id}>{t.is_default ? `${t.name} (default)` : t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Email subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Happy birthday from Rebma Impex" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Message for {composeFor.name.split(' ')[0] || 'them'}</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} placeholder="Write the birthday message" className={inputCls} />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">Send by</p>
              {[
                { key: 'email', label: 'Email', ok: !!composeFor.email, why: 'no email on file' },
                { key: 'sms', label: 'SMS', ok: !!composeFor.phone, why: 'no phone on file' },
                { key: 'whatsapp', label: 'WhatsApp (opens in a new tab)', ok: !!composeFor.phone, why: 'no phone on file' },
              ].map(c => (
                <label key={c.key} className={`flex items-center gap-2 text-sm ${c.ok ? 'text-[var(--text-primary)] cursor-pointer' : 'text-[var(--text-muted)]'}`}>
                  <input type="checkbox" disabled={!c.ok} checked={channels.includes(c.key)}
                    onChange={() => setChannels(prev => prev.includes(c.key) ? prev.filter(x => x !== c.key) : [...prev, c.key])} />
                  {c.label}{c.ok ? '' : ` (${c.why})`}
                </label>
              ))}
            </div>
          </div>
        )}
      </SidePanel>
    </div>
  );
}
