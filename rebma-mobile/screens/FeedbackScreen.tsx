// rebma-mobile/screens/FeedbackScreen.tsx
// Ports: rebma-web/src/components/global/FeedbackPanel.tsx (258 lines) —
// D93. Real `feedback` table. Read-scoping matches source exactly:
// management/CEO/admin (`isAdmin || department==='MANAGEMENT' ||
// department==='CEO'`) see everything; everyone else sees only their own
// submissions plus non-anonymous same-department ones. Resolved/Open
// toggle visible to management or the item's own author — no threaded
// reply exists on web either, only this boolean. Reached from a new row
// on ProfileScreen.tsx (mobile has no desktop-style Support sidebar
// section to nest this under).
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { MessageSquarePlus, Check } from 'lucide-react-native';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme/ThemeProvider';
import Screen from '../components/ui/Screen';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Input, { Field } from '../components/ui/Input';
import SearchablePicker from '../components/ui/SearchablePicker';
import Sheet, { SheetSection } from '../components/ui/Sheet';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonList } from '../components/ui/Skeleton';

interface FeedbackRow {
  id: string; user_id: string; department: string; type: string; category: string | null;
  subject: string; body: string; sentiment: string | null; rating: number | null;
  anonymous: boolean; resolved: boolean; created_at: string; submitterName?: string;
}

const SENTIMENTS = [{ value: 'positive', label: 'Positive' }, { value: 'neutral', label: 'Neutral' }, { value: 'negative', label: 'Negative' }];

export default function FeedbackScreen() {
  const t = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const isManagement = !!profile && (profile.isAdmin || profile.department === 'MANAGEMENT' || profile.department === 'CEO');

  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState('General');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sentiment, setSentiment] = useState('neutral');
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    let query = supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(200);
    if (!isManagement) {
      query = query.or(`user_id.eq.${profile.id},and(anonymous.eq.false,department.eq.${profile.department})`);
    }
    const { data } = await query;
    const rows = (data as any as FeedbackRow[]) || [];
    const userIds = Array.from(new Set(rows.filter((r) => !r.anonymous).map((r) => r.user_id)));
    let names: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles_directory').select('id, full_name').in('id', userIds);
      (profiles || []).forEach((p: any) => { names[p.id] = p.full_name; });
    }
    setItems(rows.map((r) => ({ ...r, submitterName: r.anonymous ? 'Anonymous' : names[r.user_id] || 'Staff Member' })));
    setLoading(false);
    setRefreshing(false);
  }, [profile?.id, isManagement]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!subject.trim() || !body.trim()) {
      Alert.alert('Subject and details are required.');
      return;
    }
    if (submitting || !profile) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('feedback').insert({
        user_id: profile.id, department: profile.department, type: 'internal',
        category, subject: subject.trim(), body: body.trim(), sentiment, rating: null,
        anonymous, resolved: false,
      });
      if (error) throw error;
      setShowForm(false);
      setSubject(''); setBody(''); setSentiment('neutral'); setAnonymous(false); setCategory('General');
      await load();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Could not submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleResolved = async (item: FeedbackRow) => {
    await supabase.from('feedback').update({ resolved: !item.resolved }).eq('id', item.id);
    await load();
  };

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}
      footer={<View style={{ padding: t.spacing.lg }}><Button label="Submit Feedback" icon={<MessageSquarePlus size={14} color="#fff" />} onPress={() => setShowForm(true)} fullWidth /></View>}
    >
      {loading ? (
        <SkeletonList rows={4} />
      ) : items.length === 0 ? (
        <EmptyState icon={<MessageSquarePlus size={22} color={t.colors.textMuted} />} title="No feedback yet" description="Submissions from you and your department will show up here." />
      ) : (
        <View style={{ gap: t.spacing.sm }}>
          {items.map((item) => {
            const isOwn = item.user_id === profile?.id;
            return (
              <Card key={item.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.xs }}>
                  <Badge tone={item.resolved ? 'success' : 'warning'} label={item.resolved ? 'Resolved' : 'Open'} size="xs" />
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{item.category || 'General'} · {item.submitterName} · {item.department}</Text>
                </View>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary, marginBottom: 2 }}>{item.subject}</Text>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>{item.body}</Text>
                {(isManagement || isOwn) && (
                  <View style={{ marginTop: t.spacing.sm }}>
                    <Button label={item.resolved ? 'Mark Open' : 'Mark Resolved'} size="sm" variant="ghost" icon={<Check size={12} color={t.colors.textSecondary} />} onPress={() => toggleResolved(item)} />
                  </View>
                )}
              </Card>
            );
          })}
        </View>
      )}

      <Sheet
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Submit Feedback"
        side="bottom"
        maxHeight={680}
        footer={<Button label={submitting ? 'Submitting…' : 'Submit'} onPress={submit} loading={submitting} disabled={submitting} fullWidth />}
      >
        <Field label="Category"><Input value={category} onChangeText={setCategory} placeholder="e.g. Process, Tools, Culture" /></Field>
        <Field label="Subject"><Input value={subject} onChangeText={setSubject} placeholder="Short summary" /></Field>
        <Field label="Details"><Input value={body} onChangeText={setBody} multiline numberOfLines={4} placeholder="Tell us more…" style={{ minHeight: 96, textAlignVertical: 'top' }} /></Field>
        <Field label="Sentiment"><SearchablePicker value={sentiment} onChange={setSentiment} options={SENTIMENTS} /></Field>
        <SheetSection label="Privacy">
          <Button label={anonymous ? 'Submitting Anonymously' : 'Submitting With My Name'} variant={anonymous ? 'primary' : 'ghost'} onPress={() => setAnonymous((v) => !v)} />
        </SheetSection>
      </Sheet>
    </Screen>
  );
}
