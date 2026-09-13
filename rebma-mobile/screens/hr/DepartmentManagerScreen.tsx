// rebma-mobile/screens/hr/DepartmentManagerScreen.tsx
// Ports: rebma-web/src/views/DepartmentManager.tsx (301 lines, read in
// full) — D56. NOT rebma-web/src/views/hr/DeptManagerView.tsx, which is
// dead code (App.tsx routes activeSubTab==='DepartmentManager' to this
// component before HR's own department-scoped block ever runs).
//
// Ported faithfully, including the source's own honest create-vs-update
// field asymmetry: only `name`+`status` are actually written on create
// (per the file's own code comment — most of the fields its own modal
// exposes, code/description/nav_items/workflows/head_user_id, don't
// exist on the live `departments` table), while update writes the full
// field set web's form models. This is the app's own accurate
// self-documentation of a real schema gap — not "fixed" into writing
// fields that don't exist.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { Plus, Building2, X } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { getCeoSetting } from '../../lib/ceoSetting';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Input, { Field } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Sheet, { SheetSection } from '../../components/ui/Sheet';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonList } from '../../components/ui/Skeleton';

interface DeptRecord {
  id: string; name: string; code: string; description: string; active: boolean;
  nav_items: string[]; workflows: string[]; status?: string;
}
const blank = { name: '', code: '', description: '', active: true, nav_items: [] as string[], workflows: [] as string[] };

export default function DepartmentManagerScreen() {
  const t = useTheme();
  const [depts, setDepts] = useState<DeptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<DeptRecord | null>(null);
  const [showForm, setShowForm] = useState<'add' | 'edit' | null>(null);
  const [form, setForm] = useState(blank);
  const [newNav, setNewNav] = useState('');
  const [newWorkflow, setNewWorkflow] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await supabase.from('departments').select('*').order('name');
      if (data) setDepts(data as any);
    } catch {
      // table may not exist yet
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm(blank); setShowForm('add'); };
  const openEdit = (d: DeptRecord) => {
    setForm({ name: d.name, code: d.code, description: d.description, active: d.active, nav_items: d.nav_items || [], workflows: d.workflows || [] });
    setSelected(d);
    setShowForm('edit');
  };

  const save = async () => {
    if (!form.name.trim() || (showForm === 'edit' && !form.code.trim())) return;
    setSaving(true);
    try {
      if (showForm === 'edit' && selected) {
        await supabase.from('departments').update({
          name: form.name, code: form.code.toUpperCase(), description: form.description,
          active: form.active, nav_items: form.nav_items, workflows: form.workflows,
          updated_at: new Date().toISOString(),
        }).eq('id', selected.id);
      } else {
        const ceoMustApprove = await getCeoSetting('ceo_must_approve_departments', false);
        const { error } = await supabase.from('departments').insert({
          name: form.name, status: ceoMustApprove ? 'pending' : 'active',
        });
        if (error) throw error;
      }
      setShowForm(null);
      setSelected(null);
      load();
    } catch (e: any) {
      Alert.alert('Save Failed', 'Could not save department. Ensure the departments table exists with correct RLS.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (d: DeptRecord) => {
    Alert.alert('Delete Department', `Remove "${d.name}"? Staff in this department will not be automatically reassigned.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('departments').delete().eq('id', d.id);
        setDepts((prev) => prev.filter((x) => x.id !== d.id));
        setSelected(null);
      } },
    ]);
  };

  const addNavItem = () => { if (!newNav.trim()) return; setForm((f) => ({ ...f, nav_items: [...f.nav_items, newNav.trim()] })); setNewNav(''); };
  const addWorkflow = () => { if (!newWorkflow.trim()) return; setForm((f) => ({ ...f, workflows: [...f.workflows, newWorkflow.trim()] })); setNewWorkflow(''); };

  const columns: DataColumn<DeptRecord>[] = [
    { key: 'name', label: 'Department', primary: true },
    { key: 'code', label: 'Code', status: true, render: (d) => (d.active === false ? <Badge tone="danger" label="Inactive" size="xs" /> : <Badge tone="muted" label={d.code || '—'} size="xs" />) },
    { key: 'description', label: 'Description', render: (d) => d.description || 'No description' },
  ];

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); load(); }}
      footer={<View style={{ padding: t.spacing.lg }}><Button label="New Department" icon={<Plus size={14} color="#fff" />} onPress={openAdd} fullWidth /></View>}
    >
      <View style={{ gap: t.spacing.lg }}>
        <View>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>Department Manager</Text>
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted, marginTop: 2 }}>Create and configure company departments</Text>
        </View>
        {loading ? (
          <SkeletonList rows={3} />
        ) : depts.length === 0 ? (
          <EmptyState icon={<Building2 size={20} color={t.colors.textMuted} />} title="No departments yet" description='Tap "New Department" to create the first one.' />
        ) : (
          <DataList columns={columns} data={depts} rowKey={(d) => d.id} onRowPress={setSelected} />
        )}

        <Card tone="inset">
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: t.colors.status.warning.text }}>Supabase Table Required</Text>
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 4 }}>
            The `departments` table needs id/name/code/description/head_user_id/active/nav_items/workflows/created_by/created_at/updated_at columns with RLS (HR & Management can insert/update; all staff can select). Only `name` and `status` are currently confirmed to exist live.
          </Text>
        </Card>
      </View>

      <Sheet open={!!selected && !showForm} onClose={() => setSelected(null)} title={selected?.name} subtitle={selected?.code} side="bottom" maxHeight={520}>
        {selected && (
          <View style={{ gap: t.spacing.lg }}>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>{selected.description || 'No description'}</Text>
            <SheetSection label={`Nav Items (${selected.nav_items?.length || 0})`}>
              {selected.nav_items?.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs }}>
                  {selected.nav_items.map((n, i) => <Badge key={i} tone="info" label={n} size="xs" />)}
                </View>
              ) : <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted, fontStyle: 'italic' }}>No nav items configured</Text>}
            </SheetSection>
            <SheetSection label={`Workflows (${selected.workflows?.length || 0})`}>
              {selected.workflows?.length ? (
                selected.workflows.map((w, i) => <Text key={i} style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>• {w}</Text>)
              ) : <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted, fontStyle: 'italic' }}>No workflows configured</Text>}
            </SheetSection>
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <Button label="Edit" size="sm" variant="ghost" onPress={() => openEdit(selected)} />
              <Button label="Delete" size="sm" variant="danger" onPress={() => confirmDelete(selected)} />
            </View>
          </View>
        )}
      </Sheet>

      <Sheet open={!!showForm} onClose={() => setShowForm(null)} title={showForm === 'edit' ? 'Edit Department' : 'New Department'} side="bottom" maxHeight={680}
        footer={<Button label={saving ? 'Saving…' : 'Save Department'} onPress={save} loading={saving} disabled={saving || !form.name.trim() || (showForm === 'edit' && !form.code.trim())} fullWidth />}>
        <Field label="Department Name *"><Input value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g. Finance" /></Field>
        {showForm === 'edit' && (
          <>
            <Field label="Code *"><Input value={form.code} onChangeText={(v) => setForm((f) => ({ ...f, code: v.toUpperCase() }))} placeholder="e.g. FIN" autoCapitalize="characters" /></Field>
            <Field label="Description"><Input value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} multiline numberOfLines={2} style={{ minHeight: 56, textAlignVertical: 'top' }} /></Field>
            <SheetSection label="Navigation Items">
              <View style={{ flexDirection: 'row', gap: t.spacing.sm, marginBottom: t.spacing.sm }}>
                <View style={{ flex: 1 }}><Input value={newNav} onChangeText={setNewNav} placeholder="Add nav item…" /></View>
                <Button label="Add" size="sm" onPress={addNavItem} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs }}>
                {form.nav_items.map((n, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: t.radius.pill, backgroundColor: t.colors.accentSoft }}>
                    <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta10.size, color: t.colors.accent }}>{n}</Text>
                    <Pressable onPress={() => setForm((f) => ({ ...f, nav_items: f.nav_items.filter((_, idx) => idx !== i) }))} hitSlop={6}><X size={10} color={t.colors.accent} /></Pressable>
                  </View>
                ))}
              </View>
            </SheetSection>
            <SheetSection label="Workflows">
              <View style={{ flexDirection: 'row', gap: t.spacing.sm, marginBottom: t.spacing.sm }}>
                <View style={{ flex: 1 }}><Input value={newWorkflow} onChangeText={setNewWorkflow} placeholder="Add workflow…" /></View>
                <Button label="Add" size="sm" onPress={addWorkflow} />
              </View>
              {form.workflows.map((w, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: t.radius.sm, backgroundColor: t.colors.bgInput, marginBottom: 4 }}>
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>{w}</Text>
                  <Pressable onPress={() => setForm((f) => ({ ...f, workflows: f.workflows.filter((_, idx) => idx !== i) }))} hitSlop={6}><X size={12} color={t.colors.status.danger.text} /></Pressable>
                </View>
              ))}
            </SheetSection>
          </>
        )}
      </Sheet>
    </Screen>
  );
}
