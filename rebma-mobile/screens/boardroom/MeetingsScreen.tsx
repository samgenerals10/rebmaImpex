// rebma-mobile/screens/boardroom/MeetingsScreen.tsx
// Ports: rebma-web/src/views/BoardroomView.tsx's Meetings branch (lines
// 528-661) — D81, the heaviest screen this phase. Mirrors meetingsApi's
// exact write shapes (apiClient.ts:2434-2506), not a re-derivation:
// scheduleMeeting (meetings insert, meeting_attendees bulk insert with
// organizer auto-ACCEPTED, a notifications row per invitee matching
// messenger.notifyUsers' shape exactly), updateRsvp, markJoined (joined_at
// + meetings.status -> IN_PROGRESS). Join opens the meeting's own dynamic
// Jitsi room via JitsiCallSheet (D76/D82). The separate meetingsList mock
// (App.tsx:758) is not ported (D78/D81) — reads live meetings/
// meeting_attendees exclusively, matching the real desktop Meetings tab.
// No realtime (D80) — polls every 8s while mounted.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { Calendar, Clock, Check, X as XIcon, Phone, Plus } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import type { StatusTone } from '../../theme/tokens';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input, { Field } from '../../components/ui/Input';
import Sheet, { SheetSection } from '../../components/ui/Sheet';
import EmptyState from '../../components/ui/EmptyState';
import JitsiCallSheet from '../../components/shared/JitsiCallSheet';

function slugRoom(prefix: string) {
  return `Rebma-${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

interface Meeting {
  id: string; title: string; description: string | null; scheduled_at: string;
  duration_minutes: number; organizer_id: string | null; jitsi_room: string;
  recap_notes: string | null; status: string; myRsvp?: string;
}
interface AttendeeProfile { id: string; fullName: string; department: string }

const STATUS_TONE: Record<string, StatusTone> = {
  SCHEDULED: 'info', IN_PROGRESS: 'success', COMPLETED: 'muted', CANCELLED: 'danger',
};

export default function MeetingsScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const myId = profile?.id || '';
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [attendeeProfiles, setAttendeeProfiles] = useState<AttendeeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCall, setActiveCall] = useState<{ room: string; title: string } | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('30');
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadMeetings = useCallback(async () => {
    if (!myId) return;
    const { data: memberships } = await supabase.from('meeting_attendees').select('meeting_id, rsvp_status').eq('user_id', myId);
    const ids = (memberships || []).map((m: any) => m.meeting_id);
    if (ids.length === 0) { setMeetings([]); return; }
    const { data: rows } = await supabase.from('meetings').select('*').in('id', ids).order('scheduled_at', { ascending: false });
    const rsvpById: Record<string, string> = {};
    (memberships || []).forEach((m: any) => { rsvpById[m.meeting_id] = m.rsvp_status; });
    setMeetings((rows || []).map((m: any) => ({ ...m, myRsvp: rsvpById[m.id] })));
  }, [myId]);

  const load = useCallback(async () => {
    await loadMeetings();
    setLoading(false);
    setRefreshing(false);
  }, [loadMeetings]);

  useEffect(() => {
    if (!myId) return;
    load();
    supabase.from('profiles_directory').select('id, full_name, role').eq('status', 'ACTIVE').order('full_name', { ascending: true }).then(({ data }) => {
      setAttendeeProfiles((data || []).map((p: any) => ({ id: p.id, fullName: p.full_name || 'Unknown', department: p.role || '' })).filter((p: any) => p.id !== myId));
    });
    const iv = setInterval(loadMeetings, 8000);
    return () => clearInterval(iv);
  }, [myId, load, loadMeetings]);

  const toggleAttendee = (id: string) => setSelectedAttendeeIds((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));

  const scheduleMeeting = async () => {
    if (!title.trim() || !date || !time) { Alert.alert('Please fill out all meeting details.'); return; }
    if (submitting) return;
    setSubmitting(true);
    try {
      const scheduledAt = new Date(`${date}T${time}`).toISOString();
      const room = slugRoom('Mtg');
      const { data: created, error } = await supabase.from('meetings').insert({
        title: title.trim(), description: '', scheduled_at: scheduledAt, duration_minutes: Number(duration) || 30,
        organizer_id: myId, jitsi_room: room, status: 'SCHEDULED',
      }).select();
      if (error || !created) throw new Error(error?.message || 'Failed to schedule meeting.');
      const meeting = created[0];
      const allAttendees = Array.from(new Set([...selectedAttendeeIds, myId]));
      await supabase.from('meeting_attendees').insert(allAttendees.map((uid) => ({
        meeting_id: meeting.id, user_id: uid, rsvp_status: uid === myId ? 'ACCEPTED' : 'INVITED',
      })));
      const invitees = selectedAttendeeIds.filter((id) => id !== myId);
      if (invitees.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('notifications').insert(invitees.map((uid) => ({
          recipient_id: uid, sender_id: user?.id ?? null, sender_name: user?.email ?? null,
          title: `${profile?.fullName || 'Organizer'} invited you to "${title.trim()}"`,
          message: `Scheduled ${new Date(scheduledAt).toLocaleString()}`,
          type: 'meeting_invite', action_url: meeting.id, read: false, created_at: new Date().toISOString(),
        })));
      }
      setShowForm(false);
      setTitle(''); setDate(''); setTime(''); setDuration('30'); setSelectedAttendeeIds([]);
      await loadMeetings();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Could not schedule meeting.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRsvp = async (meetingId: string, status: 'ACCEPTED' | 'DECLINED') => {
    await supabase.from('meeting_attendees').update({ rsvp_status: status }).eq('meeting_id', meetingId).eq('user_id', myId);
    await loadMeetings();
  };

  const handleJoin = async (mtg: Meeting) => {
    await supabase.from('meeting_attendees').update({ joined_at: new Date().toISOString() }).eq('meeting_id', mtg.id).eq('user_id', myId);
    await supabase.from('meetings').update({ status: 'IN_PROGRESS' }).eq('id', mtg.id).eq('status', 'SCHEDULED');
    setActiveCall({ room: mtg.jitsi_room, title: mtg.title });
    await loadMeetings();
  };

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.xl }}>
        <Button label="Organize Meeting" icon={<Plus size={14} color="#fff" />} onPress={() => setShowForm(true)} />

        <View>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>My Meetings</Text>
          {!loading && meetings.length === 0 ? (
            <EmptyState icon={<Calendar size={20} color={t.colors.textMuted} />} title="No meetings scheduled" description="Nothing on the board calendar yet." />
          ) : (
            <View style={{ gap: t.spacing.sm }}>
              {meetings.map((mtg) => (
                <Card key={mtg.id}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.xs }}>
                    <Badge tone={STATUS_TONE[mtg.status] || 'muted'} label={mtg.status.replace(/_/g, ' ')} size="xs" />
                    <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary, flex: 1 }} numberOfLines={1}>{mtg.title}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: t.spacing.md, marginBottom: t.spacing.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Calendar size={12} color={t.colors.textMuted} />
                      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{new Date(mtg.scheduled_at).toLocaleDateString()}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} color={t.colors.textMuted} />
                      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>
                        {new Date(mtg.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {mtg.duration_minutes}min
                      </Text>
                    </View>
                  </View>
                  {mtg.myRsvp && (
                    <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginBottom: t.spacing.sm }}>
                      Your RSVP: <Text style={{ fontFamily: t.font.bold, color: t.colors.textPrimary }}>{mtg.myRsvp}</Text>
                    </Text>
                  )}
                  {mtg.recap_notes && (
                    <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textSecondary, marginBottom: t.spacing.sm }} numberOfLines={2}>Recap: {mtg.recap_notes}</Text>
                  )}
                  <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
                    {mtg.myRsvp === 'INVITED' && (
                      <>
                        <Button label="Accept" size="sm" icon={<Check size={12} color="#fff" />} onPress={() => handleRsvp(mtg.id, 'ACCEPTED')} />
                        <Button label="Decline" size="sm" variant="danger" icon={<XIcon size={12} color="#fff" />} onPress={() => handleRsvp(mtg.id, 'DECLINED')} />
                      </>
                    )}
                    {mtg.status !== 'CANCELLED' && mtg.status !== 'COMPLETED' && (
                      <Button label="Join" size="sm" icon={<Phone size={12} color="#fff" />} onPress={() => handleJoin(mtg)} />
                    )}
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>
      </View>

      <Sheet
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Organize Meeting"
        side="bottom"
        maxHeight={720}
        footer={<Button label={submitting ? 'Scheduling…' : 'Schedule Meeting & Notify Attendees'} onPress={scheduleMeeting} loading={submitting} disabled={submitting} fullWidth />}
      >
        <Field label="Meeting Title / Topic *"><Input value={title} onChangeText={setTitle} placeholder="E.g., Logistics & Fleet Align" /></Field>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}><Field label="Date *"><Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" /></Field></View>
          <View style={{ flex: 1 }}><Field label="Time *"><Input value={time} onChangeText={setTime} placeholder="HH:MM" /></Field></View>
        </View>
        <Field label="Duration (minutes)"><Input value={duration} onChangeText={setDuration} keyboardType="numeric" /></Field>

        <SheetSection label="Invite Attendees">
          {attendeeProfiles.map((p) => {
            const selected = selectedAttendeeIds.includes(p.id);
            return (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textPrimary, flex: 1 }}>
                  {p.fullName} <Text style={{ color: t.colors.textMuted }}>({p.department})</Text>
                </Text>
                <Button label={selected ? 'Invited' : 'Invite'} size="sm" variant={selected ? 'primary' : 'ghost'} onPress={() => toggleAttendee(p.id)} />
              </View>
            );
          })}
          {attendeeProfiles.length === 0 && <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>No other staff found.</Text>}
        </SheetSection>
      </Sheet>

      {activeCall && <JitsiCallSheet room={activeCall.room} title={activeCall.title} kind="video" onClose={() => setActiveCall(null)} />}
    </Screen>
  );
}
