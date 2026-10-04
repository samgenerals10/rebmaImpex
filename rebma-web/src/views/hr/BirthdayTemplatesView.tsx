// rebma-web/src/views/hr/BirthdayTemplatesView.tsx
// Web twin of rebma-mobile/screens/hr/BirthdayTemplatesScreen.tsx.
//
// HR → Birthday Templates (approved Part B): HR writes the birthday
// messages, like Document Templates. Who it's for, which channels, subject
// and message with {name} / {first_name}. One default per group: the
// automatic sender uses it, and the Birthdays page starts from it.
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Star, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import SidePanel from '../../components/ui/SidePanel';
import type { CurrentUser } from '../../types/erp';

export interface BirthdayTemplate {
  id: string; name: string; audience: 'staff' | 'customer' | 'both'; channels: string[];
  email_subject: string; body: string; is_default: boolean;
}

export const AUDIENCE_LABEL: Record<BirthdayTemplate['audience'], string> = { staff: 'Staff', customer: 'Customers', both: 'Staff and customers' };
const CHANNELS = [{ key: 'email', label: 'Email' }, { key: 'sms', label: 'SMS' }, { key: 'whatsapp', label: 'WhatsApp' }];

export function fillTemplate(text: string, fullName: string): string {
  const first = (fullName || '').trim().split(/\s+/)[0] || 'there';
  return text.replace(/\{first_name\}/g, first).replace(/\{name\}/g, (fullName || '').trim() || first);
}

const blank = { name: '', audience: 'both' as BirthdayTemplate['audience'], channels: ['email', 'sms'], email_subject: 'Happy birthday from Rebma Impex', body: '', is_default: false };

interface Props { currentUser: CurrentUser | null; addNotification: (msg: string) => void }

export default function BirthdayTemplatesView({ currentUser, addNotification }: Props) {
  const [templates, setTemplates] = useState<BirthdayTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BirthdayTemplate | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('birthday_templates').select('*').order('created_at', { ascending: true });
    setTemplates((data as BirthdayTemplate[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(blank); setOpen(true); };
  const openEdit = (tpl: BirthdayTemplate) => {
    setEditing(tpl);
    setForm({ name: tpl.name, audience: tpl.audience, channels: tpl.channels, email_subject: tpl.email_subject, body: tpl.body, is_default: tpl.is_default });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { addNotification('Give the template a name.'); return; }
    if (!form.body.trim()) { addNotification('Write the message.'); return; }
    if (!form.channels.length) { addNotification('Pick at least one way to send it.'); return; }
    setSaving(true);
    try {
      if (form.is_default) {
        let q = supabase.from('birthday_templates').update({ is_default: false }).eq('audience', form.audience).eq('is_default', true);
        if (editing) q = q.neq('id', editing.id);
        const { error } = await q;
        if (error) throw new Error(error.message);
      }
      const row = {
        name: form.name.trim(), audience: form.audience, channels: form.channels,
        email_subject: form.email_subject.trim() || 'Happy birthday from Rebma Impex', body: form.body.trim(),
        is_default: form.is_default, updated_at: new Date().toISOString(),
      };
      const { error } = editing
        ? await supabase.from('birthday_templates').update(row).eq('id', editing.id)
        : await supabase.from('birthday_templates').insert({ ...row, created_by: currentUser?.fullName || 'HR' });
      if (error) throw new Error(error.message);
      setOpen(false);
      addNotification('Template saved.');
      load();
    } catch (e: any) {
      addNotification(`Could not save: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (tpl: BirthdayTemplate) => {
    if (!window.confirm(`Delete "${tpl.name}"?${tpl.is_default ? ' It is a default, so automatic wishes stop until another default is set.' : ''}`)) return;
    const { error } = await supabase.from('birthday_templates').delete().eq('id', tpl.id);
    if (error) addNotification(`Could not delete: ${error.message}`);
    else load();
  };

  const inputCls = 'w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]';

  return (
    <div className="p-4 lg:p-6 max-w-screen-lg mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2"><FileText className="w-5 h-5 text-[var(--accent)]" /> Birthday Templates</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Write the birthday messages. Use {'{name}'} or {'{first_name}'} where the person's name goes.</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-white cursor-pointer" style={{ background: 'var(--accent)' }}>
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      {!loading && templates.length === 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-8 text-center">
          <p className="text-sm font-semibold text-[var(--text-primary)]">No templates yet</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Create one and mark it as default so birthday wishes can go out.</p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {templates.map(tpl => (
          <div key={tpl.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 flex flex-col">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-[var(--text-primary)] flex-1">{tpl.name}</p>
              {tpl.is_default && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">DEFAULT</span>}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">For: {AUDIENCE_LABEL[tpl.audience]} · Sent by: {tpl.channels.map(c => CHANNELS.find(x => x.key === c)?.label || c).join(', ')}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-3 p-3 rounded-xl bg-[var(--bg-input)] flex-1 whitespace-pre-wrap">{fillTemplate(tpl.body, 'Ama Mensah')}</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => openEdit(tpl)} className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)] cursor-pointer"><Pencil className="w-3.5 h-3.5" /> Edit</button>
              <button onClick={() => remove(tpl)} className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border)] text-rose-600 hover:bg-rose-500/10 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
            </div>
          </div>
        ))}
      </div>

      <SidePanel open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Template' : 'New Template'} width="lg"
        footer={<button onClick={save} disabled={saving} className="erp-btn erp-btn-primary w-full disabled:opacity-50">{saving ? 'Saving…' : 'Save Template'}</button>}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Template name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Warm staff wish" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Who it's for</label>
            <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-input)]">
              {(['staff', 'customer', 'both'] as const).map(a => (
                <button key={a} type="button" onClick={() => setForm(f => ({ ...f, audience: a }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${form.audience === a ? 'bg-[var(--bg-card)] text-[var(--accent)] shadow-sm' : 'text-[var(--text-secondary)]'}`}>
                  {a === 'staff' ? 'Staff' : a === 'customer' ? 'Customers' : 'Both'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Send by</label>
            <div className="flex flex-wrap gap-3">
              {CHANNELS.map(c => (
                <label key={c.key} className="flex items-center gap-2 text-sm text-[var(--text-primary)] cursor-pointer">
                  <input type="checkbox" checked={form.channels.includes(c.key)}
                    onChange={() => setForm(f => ({ ...f, channels: f.channels.includes(c.key) ? f.channels.filter(x => x !== c.key) : [...f.channels, c.key] }))} />
                  {c.label}
                </label>
              ))}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">WhatsApp is never automatic: HR sends it with one click from the Birthdays page.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Email subject</label>
            <input value={form.email_subject} onChange={e => setForm(f => ({ ...f, email_subject: e.target.value }))} placeholder="Happy birthday from Rebma Impex" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Message</label>
            <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={5}
              placeholder="e.g. Happy birthday, {first_name}! Everyone at Rebma Impex wishes you a wonderful day." className={inputCls} />
            <p className="text-[11px] text-[var(--text-muted)] mt-1">Use {'{name}'} for their full name or {'{first_name}'} for their first name.</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)] cursor-pointer">
            <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} />
            <Star className="w-4 h-4 text-amber-500" /> Default for {AUDIENCE_LABEL[form.audience].toLowerCase()}
          </label>
          {form.body.trim() && (
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Preview</label>
              <p className="text-sm text-[var(--text-secondary)] p-3 rounded-xl bg-[var(--bg-input)] whitespace-pre-wrap">{fillTemplate(form.body, 'Ama Mensah')}</p>
            </div>
          )}
        </div>
      </SidePanel>
    </div>
  );
}
