// rebma-mobile/screens/hr/HrQueriesScreen.tsx
// Ports: rebma-web/src/components/global/HrQueriesPanel.tsx (208 lines,
// read in full) — D58. Web routes this as a cross-department global
// panel, but mobile's departmentRegistry.ts already committed HrQueries
// as one of HR's own subTabs back in Phase 7.0, so it's built as HR's
// own screen against the registry as it stands. Any staff member submits
// a query and sees HR's response; HR/admin see and respond to every
// query — RLS already scopes non-HR viewers to their own rows (per
// supabase_hr_additions.sql's employee_queries_select policy), so this
// is an unfiltered select either way, same as web.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Plus, MessageCircleQuestion, CheckCircle, Clock } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Input, { Field } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Sheet, { SheetSection } from '../../components/ui/Sheet';

interface QueryItem {
  id: string; staff_id: string; staff_name: string; department: string; subject: string; body: string;
  status: 'OPEN' | 'RESOLVED'; response: string | null; responded_by: string | null; responded_at: string | null; created_at: string;
}

export default function HrQueriesScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const [items, setItems] = useState<QueryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [selected, setSelected] = useState<QueryItem | null>(null);
  const [respondDraft, setRespondDraft] = useState('');
  const [responding, setResponding] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const isHrOrAdmin = profile?.isAdmin || profile?.department === 'HR';

  const load = useCallback(async () => {
    const { data } = await supabase.from('employee_queries').select('*').order('created_at', { ascending: false });
    setItems((data as any) || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = items.filter((i) => filter === 'all' || (filter === 'open' ? i.status === 'OPEN' : i.status === 'RESOLVED'));

  const submit = async () => {
    if (!profile || !subject.trim() || !body.trim()) return;
    setSaving(true);
    try {
      await supabase.from('employee_queries').insert({
        staff_id: profile.id, staff_name: profile.fullName, department: profile.department,
        subject: subject.trim(), body: body.trim(), status: 'OPEN',
      });
      setSubject(''); setBody(''); setShowNew(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const respond = async () => {
    if (!selected || !respondDraft.trim()) return;
    setResponding(true);
    try {
      await supabase.from('employee_queries').update({
        response: respondDraft.trim(), responded_by: profile?.fullName || 'HR', responded_at: new Date().toISOString(), status: 'RESOLVED',
      }).eq('id', selected.id);
      setRespondDraft('');
      setSelected(null);
      load();
    } finally {
      setResponding(false);
    }
  };

  const columns: DataColumn<QueryItem>[] = [
    { key: 'subject', label: 'Subject', primary: true },
    { key: 'status', label: 'Status', status: true, render: (i) => <Badge tone={i.status === 'RESOLVED' ? 'success' : 'warning'} label={i.status === 'RESOLVED' ? 'Resolved' : 'Open'} size="xs" /> },
    { key: 'staff_name', label: 'From', render: (i) => (isHrOrAdmin ? `${i.staff_name || 'Unknown'} · ${i.department}` : i.department) },
  ];

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); load(); }}
      footer={<View style={{ padding: t.spacing.lg }}><Button label="New Query" icon={<Plus size={14} color="#fff" />} onPress={() => setShowNew(true)} fullWidth /></View>}
    >
      <View style={{ gap: t.spacing.lg }}>
        <View>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{isHrOrAdmin ? 'Employee Queries' : 'HR Queries'}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: t.spacing.xs }}>
          {(['all', 'open', 'resolved'] as const).map((v) => (
            <Pressable key={v} onPress={() => setFilter(v)} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: t.radius.pill, backgroundColor: filter === v ? t.colors.accent : t.colors.bgCard, borderWidth: 1, borderColor: filter === v ? t.colors.accent : t.colors.border }}>
              <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: filter === v ? t.colors.onAccent : t.colors.textSecondary, textTransform: 'capitalize' }}>{v}</Text>
            </Pressable>
          ))}
        </View>
        <DataList columns={columns} data={visible} rowKey={(i) => i.id} loading={loading}
          emptyTitle={isHrOrAdmin ? 'No employee queries yet' : "You haven't asked HR anything yet"}
          emptyIcon={<MessageCircleQuestion size={20} color={t.colors.textMuted} />}
          onRowPress={(i) => { setSelected(i); setRespondDraft(''); }}
        />
      </View>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected?.subject} subtitle={selected ? (isHrOrAdmin ? `${selected.staff_name} · ${selected.department}` : selected.department) : undefined} side="bottom" maxHeight={560}>
        {selected && (
          <View style={{ gap: t.spacing.lg }}>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>{selected.body}</Text>
            {selected.response && (
              <Card tone="inset">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs, marginBottom: 4 }}>
                  <CheckCircle size={12} color={t.colors.status.success.text} />
                  <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: t.colors.textMuted, textTransform: 'uppercase' }}>
                    HR Response{selected.responded_by ? ` — ${selected.responded_by}` : ''}
                  </Text>
                </View>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{selected.response}</Text>
              </Card>
            )}
            {isHrOrAdmin && selected.status === 'OPEN' && (
              <SheetSection label="Respond">
                <Input value={respondDraft} onChangeText={setRespondDraft} multiline numberOfLines={4} style={{ minHeight: 96, textAlignVertical: 'top' }} placeholder="Write a response…" />
                <View style={{ marginTop: t.spacing.sm }}>
                  <Button label={responding ? 'Sending…' : 'Send Response & Resolve'} onPress={respond} loading={responding} disabled={responding || !respondDraft.trim()} />
                </View>
              </SheetSection>
            )}
          </View>
        )}
      </Sheet>

      <Sheet open={showNew} onClose={() => setShowNew(false)} title="Ask HR" side="bottom" maxHeight={480}
        footer={<Button label={saving ? 'Submitting…' : 'Submit'} onPress={submit} loading={saving} disabled={saving || !subject.trim() || !body.trim()} fullWidth />}>
        <Field label="Subject"><Input value={subject} onChangeText={setSubject} /></Field>
        <Field label="Details"><Input value={body} onChangeText={setBody} multiline numberOfLines={5} style={{ minHeight: 120, textAlignVertical: 'top' }} placeholder="Describe your question…" /></Field>
      </Sheet>
    </Screen>
  );
}
