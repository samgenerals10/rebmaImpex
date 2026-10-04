// rebma-mobile/screens/TasksScreen.tsx
//
// Tasks on the phone. Ports rebma-web/src/components/global/TasksPanel.tsx
// against the same `tasks` table. Web shows three columns side by side;
// on a phone the same three stages (To Do, In Progress, Done) are tabs.
// Everything else matches web: Mine / Assigned to me / Department / All,
// priority, due date (overdue in red), assign to a colleague in your
// department, share with your department, move forward (Start, Done),
// escalate to Management or the CEO with a reason (they're notified),
// edit and delete (the
// task's creator only). Reached from the Profile tab.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Alert } from '../lib/appAlert';
import { CheckSquare, Calendar, AlertCircle, ChevronRight, ArrowUpCircle, Pencil, Trash2, Plus, X } from 'lucide-react-native';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme/ThemeProvider';
import Screen from '../components/ui/Screen';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Input, { Field } from '../components/ui/Input';
import Sheet from '../components/ui/Sheet';
import Tabs from '../components/ui/Tabs';
import Toggle from '../components/ui/Toggle';
import SearchablePicker from '../components/ui/SearchablePicker';
import CalendarPicker from '../components/ui/CalendarPicker';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonList } from '../components/ui/Skeleton';

type Status = 'todo' | 'in_progress' | 'done';
type Priority = 'low' | 'medium' | 'high';

interface Task {
  id: string; user_id: string; department: string; assigned_to: string | null;
  title: string; description: string; status: Status; priority: Priority;
  due_date: string | null; shared: boolean; escalated: boolean;
  escalated_to: string | null; created_at: string;
}

const STATUS_TABS: { value: Status; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];
const PRIORITY_TONE: Record<Priority, 'danger' | 'warning' | 'success'> = { high: 'danger', medium: 'warning', low: 'success' };
const PRIORITY_LABEL: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' };

const blankForm = { id: '', title: '', description: '', priority: 'medium' as Priority, due_date: '', shared: false, assigned_to: '' };

export default function TasksScreen() {
  const t = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const myId = profile?.id || '';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [colleagues, setColleagues] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'mine' | 'assigned' | 'dept' | 'all'>('mine');
  const [stage, setStage] = useState<Status>('todo');
  const [form, setForm] = useState(blankForm);
  const [formOpen, setFormOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [esc, setEsc] = useState<{ task: Task; to: string; reason: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .or(`user_id.eq.${profile.id},assigned_to.eq.${profile.id},and(shared.eq.true,department.eq.${profile.department})`)
      .order('created_at', { ascending: false });
    if (data) setTasks(data as Task[]);
    const { data: profs } = await supabase
      .from('profiles_directory')
      .select('id, full_name, department')
      .eq('department', profile.department)
      .eq('status', 'ACTIVE')
      .neq('id', profile.id);
    if (profs) setColleagues(profs as any);
    setLoading(false);
    setRefreshing(false);
  }, [profile?.id, profile?.department]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => tasks.filter((x) => {
    if (filter === 'mine') return x.user_id === myId && !x.assigned_to;
    if (filter === 'assigned') return x.assigned_to === myId;
    if (filter === 'dept') return x.shared && x.department === profile?.department;
    return true;
  }), [tasks, filter, myId, profile?.department]);

  const inStage = filtered.filter((x) => x.status === stage);
  const countFor = (s: Status) => filtered.filter((x) => x.status === s).length;
  const isOverdue = (due: string | null) => !!due && new Date(due) < new Date();

  const advance = async (task: Task) => {
    const next: Status = task.status === 'todo' ? 'in_progress' : 'done';
    await supabase.from('tasks').update({ status: next, updated_at: new Date().toISOString() }).eq('id', task.id);
    load();
  };

  const openNew = () => { setForm(blankForm); setCalendarMonth(new Date()); setFormOpen(true); };
  const openEdit = (task: Task) => {
    setForm({ id: task.id, title: task.title, description: task.description || '', priority: task.priority, due_date: task.due_date || '', shared: task.shared, assigned_to: task.assigned_to || '' });
    setCalendarMonth(task.due_date ? new Date(task.due_date) : new Date());
    setFormOpen(true);
  };

  const save = async () => {
    if (!profile || !form.title.trim() || saving) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(), description: form.description, priority: form.priority,
        due_date: form.due_date || null, shared: form.shared,
        assigned_to: form.assigned_to || null, updated_at: new Date().toISOString(),
      };
      if (form.id) {
        const { error } = await supabase.from('tasks').update(payload).eq('id', form.id).eq('user_id', profile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tasks').insert({ ...payload, user_id: profile.id, department: profile.department, status: 'todo' });
        if (error) throw error;
      }
      setFormOpen(false);
      load();
    } catch (e: any) {
      Alert.alert('Could not save task', e?.message || 'Unknown error.');
    } finally {
      setSaving(false);
    }
  };

  const remove = (task: Task) => {
    Alert.alert('Delete task?', `"${task.title}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('tasks').delete().eq('id', task.id).eq('user_id', myId);
        load();
      } },
    ]);
  };

  const escalate = async () => {
    if (!profile || !esc || !esc.reason.trim() || saving) return;
    setSaving(true);
    const { error } = await supabase.from('tasks').update({
      escalated: true, escalated_to: esc.to, escalated_by: profile.id,
      escalation_reason: esc.reason.trim(), escalated_at: new Date().toISOString(),
    }).eq('id', esc.task.id);
    if (error) { setSaving(false); Alert.alert('Could not escalate', error.message); return; }
    // Tell Management or the CEO (same as web).
    await supabase.from('notifications').insert({
      recipient_id: null, recipient_department: esc.to, sender_id: profile.id, sender_name: profile.fullName,
      title: 'Task escalated to you',
      message: `${profile.fullName} (${profile.department}) escalated "${esc.task.title}". Reason: ${esc.reason.trim()}`,
      type: 'task_escalated', read: false, created_at: new Date().toISOString(),
    }).then(() => {}, () => {});
    setSaving(false);
    setEsc(null);
    load();
  };

  const colleagueName = (id: string | null) => colleagues.find((c) => c.id === id)?.full_name;

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); load(); }}
      footer={<View style={{ padding: t.spacing.lg }}><Button label="New Task" icon={<Plus size={14} color="#fff" />} onPress={openNew} fullWidth /></View>}
    >
      <View style={{ gap: t.spacing.md, marginBottom: t.spacing.md }}>
        <Tabs
          variant="chips"
          value={filter}
          onChange={(v) => setFilter(v as typeof filter)}
          options={[{ value: 'mine', label: 'Mine' }, { value: 'assigned', label: 'Assigned' }, { value: 'dept', label: 'Dept' }, { value: 'all', label: 'All' }]}
        />
        <Tabs
          variant="segmented"
          value={stage}
          onChange={(v) => setStage(v as Status)}
          options={STATUS_TABS.map((s) => ({ value: s.value, label: s.label, badge: countFor(s.value) }))}
        />
      </View>

      {loading ? (
        <SkeletonList rows={4} />
      ) : inStage.length === 0 ? (
        <EmptyState icon={<CheckSquare size={22} color={t.colors.textMuted} />} title="No tasks here" description="Tasks in this stage will show up here." />
      ) : (
        <View style={{ gap: t.spacing.sm }}>
          {inStage.map((task) => {
            const overdue = isOverdue(task.due_date) && task.status !== 'done';
            const isOwn = task.user_id === myId;
            const assignee = colleagueName(task.assigned_to);
            return (
              <Card key={task.id}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                  <Badge tone={PRIORITY_TONE[task.priority]} label={PRIORITY_LABEL[task.priority]} size="xs" />
                  {task.escalated && <Badge tone="warning" label={`Escalated${task.escalated_to ? ` to ${task.escalated_to === 'CEO' ? 'CEO' : 'Management'}` : ''}`} size="xs" />}
                  {task.shared && <Badge tone="info" label="Shared" size="xs" />}
                </View>
                <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{task.title}</Text>
                {!!task.description && <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, marginTop: 2 }} numberOfLines={3}>{task.description}</Text>}
                {(task.due_date || assignee) && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, marginTop: 6 }}>
                    {task.due_date && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        {overdue ? <AlertCircle size={12} color={t.colors.status.danger.text} /> : <Calendar size={12} color={t.colors.textMuted} />}
                        <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta11.size, color: overdue ? t.colors.status.danger.text : t.colors.textMuted }}>
                          {new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{overdue ? ', overdue' : ''}
                        </Text>
                      </View>
                    )}
                    {assignee && <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>For {assignee}</Text>}
                  </View>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: t.spacing.sm }}>
                  {task.status !== 'done' ? (
                    <Pressable onPress={() => advance(task)} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }} hitSlop={6}>
                      <ChevronRight size={15} color={t.colors.accent} />
                      <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.accent }}>{task.status === 'todo' ? 'Start' : 'Done'}</Text>
                    </Pressable>
                  ) : <View />}
                  {isOwn && (
                    <View style={{ flexDirection: 'row', gap: 14 }}>
                      <Pressable onPress={() => setEsc({ task, to: 'MANAGEMENT', reason: '' })} hitSlop={8} accessibilityLabel="Escalate"><ArrowUpCircle size={17} color={t.colors.action.amber} /></Pressable>
                      <Pressable onPress={() => openEdit(task)} hitSlop={8} accessibilityLabel="Edit"><Pencil size={16} color={t.colors.textSecondary} /></Pressable>
                      <Pressable onPress={() => remove(task)} hitSlop={8} accessibilityLabel="Delete"><Trash2 size={16} color={t.colors.status.danger.text} /></Pressable>
                    </View>
                  )}
                </View>
              </Card>
            );
          })}
        </View>
      )}

      <Sheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.id ? 'Edit Task' : 'New Task'}
        side="bottom"
        maxHeight={760}
        footer={<Button label={saving ? 'Saving…' : 'Save'} onPress={save} loading={saving} disabled={saving || !form.title.trim()} fullWidth />}
      >
        <Field label="Title"><Input value={form.title} onChangeText={(v) => setForm((f) => ({ ...f, title: v }))} placeholder="Task title" /></Field>
        <Field label="Description">
          <Input value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} multiline numberOfLines={3} placeholder="Description" style={{ minHeight: 80, textAlignVertical: 'top' }} />
        </Field>
        <Field label="Priority">
          <SearchablePicker value={form.priority} onChange={(v) => setForm((f) => ({ ...f, priority: v as Priority }))} options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} />
        </Field>
        <Field label="Assign to (optional)">
          <SearchablePicker
            value={form.assigned_to}
            onChange={(v) => setForm((f) => ({ ...f, assigned_to: v }))}
            placeholder="Nobody"
            options={[{ value: '', label: 'Nobody' }, ...colleagues.map((c) => ({ value: c.id, label: c.full_name }))]}
          />
        </Field>
        <Field label={form.due_date ? `Due date: ${new Date(form.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Due date (optional)'}>
          <CalendarPicker
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            mode="single"
            value={{ start: form.due_date || null, end: null }}
            onChange={(v) => setForm((f) => ({ ...f, due_date: v.start || '' }))}
          />
          {!!form.due_date && (
            <Pressable onPress={() => setForm((f) => ({ ...f, due_date: '' }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, alignSelf: 'flex-start' }}>
              <X size={12} color={t.colors.textMuted} />
              <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>Clear due date</Text>
            </Pressable>
          )}
        </Field>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: t.spacing.sm }}>
          <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>Share with my department</Text>
          <Toggle value={form.shared} onChange={(v) => setForm((f) => ({ ...f, shared: v }))} />
        </View>
      </Sheet>

      <Sheet
        open={!!esc}
        onClose={() => setEsc(null)}
        title="Escalate Task"
        subtitle={esc?.task.title}
        side="bottom"
        footer={<Button label={saving ? 'Escalating…' : 'Escalate'} onPress={escalate} loading={saving} disabled={saving || !esc?.reason.trim()} fullWidth />}
      >
        <Field label="Escalate to">
          <SearchablePicker value={esc?.to || 'MANAGEMENT'} onChange={(v) => setEsc((e) => (e ? { ...e, to: v } : e))} options={[{ value: 'MANAGEMENT', label: 'Management' }, { value: 'CEO', label: 'CEO' }]} />
        </Field>
        <Field label="Reason">
          <Input value={esc?.reason || ''} onChangeText={(v) => setEsc((e) => (e ? { ...e, reason: v } : e))} multiline numberOfLines={3} placeholder="Why does this need escalating? (required)" style={{ minHeight: 80, textAlignVertical: 'top' }} />
        </Field>
      </Sheet>
    </Screen>
  );
}
