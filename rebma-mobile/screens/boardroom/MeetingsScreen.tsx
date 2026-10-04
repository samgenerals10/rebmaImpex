// rebma-mobile/screens/boardroom/MeetingsScreen.tsx
// Ports: rebma-web/src/views/BoardroomView.tsx's Meetings branch — D81.
// Mirrors meetingsApi's exact write shapes (apiClient.ts:2434-2506):
// scheduleMeeting (meetings insert, meeting_attendees bulk insert with
// organizer auto-ACCEPTED, a notifications row per invitee), updateRsvp,
// markJoined (joined_at + meetings.status -> IN_PROGRESS).
//
// Restyled to the reference the user gave (a "New meeting" / "Join
// meeting" action-card pair, a Today/Scheduled list of meeting cards
// each with a time range and a pill Join/Start button) — the layout and
// component shapes match that reference; the actual visual design
// (colors, type, radius) stays this app's own theme, not the
// reference's own branding, matching what was asked: use it to
// understand the shape, not to copy its skin.
//
// Join opens GroupCallSheet — real device-camera/mic mesh calling, no
// Jitsi. "New Meeting" is a genuine instant meeting (Meet Now): creates
// the meeting record and opens the call immediately, no scheduling step.
// "Join Meeting" looks a meeting up by its id/room code and joins it
// directly, without needing it in your own list first.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Alert } from '../../lib/appAlert';
import { Calendar, Clock, Check, X as XIcon, Video, Plus, LogIn } from 'lucide-react-native';
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
import Tabs from '../../components/ui/Tabs';
import GroupCallSheet from '../../components/shared/GroupCallSheet';
import CalendarPicker, { toKey, type CalendarValue } from '../../components/ui/CalendarPicker';

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

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export default function MeetingsScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const myId = profile?.id || '';
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [attendeeProfiles, setAttendeeProfiles] = useState<AttendeeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCall, setActiveCall] = useState<{ room: string; title: string; meetingId: string } | null>(null);
  // A calendar instead of Today / Scheduled tabs (Part C): days with a
  // meeting are marked; tap one to see its meetings, past or upcoming.
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<CalendarValue>(() => ({ start: toKey(new Date()), end: toKey(new Date()) }));

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('30');
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [showJoinByCode, setShowJoinByCode] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joiningByCode, setJoiningByCode] = useState(false);

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

  const notifyInvitees = async (meetingId: string, meetingTitle: string, scheduledAt: string, invitees: string[]) => {
    if (invitees.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('notifications').insert(invitees.map((uid) => ({
      recipient_id: uid, sender_id: user?.id ?? null, sender_name: user?.email ?? null,
      title: `${profile?.fullName || 'Organizer'} invited you to "${meetingTitle}"`,
      message: `Scheduled ${new Date(scheduledAt).toLocaleString()}`,
      type: 'meeting_invite', action_url: meetingId, read: false, created_at: new Date().toISOString(),
    })));
  };

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
      await notifyInvitees(meeting.id, title.trim(), scheduledAt, selectedAttendeeIds.filter((id) => id !== myId));
      setShowForm(false);
      setTitle(''); setDate(''); setTime(''); setDuration('30'); setSelectedAttendeeIds([]);
      await loadMeetings();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Could not schedule meeting.');
    } finally {
      setSubmitting(false);
    }
  };

  // "New meeting" (Meet Now) — the reference's primary action card:
  // starts a real meeting immediately, no scheduling step, no attendee
  // picker. Room + a live meetings row are still created for real (so
  // Join History / attendance / in-call chat all work the same as a
  // scheduled meeting) — it just skips straight to IN_PROGRESS.
  const startInstantMeeting = async () => {
    const room = slugRoom('Now');
    const { data: created, error } = await supabase.from('meetings').insert({
      title: 'Quick Meeting', description: '', scheduled_at: new Date().toISOString(), duration_minutes: 30,
      organizer_id: myId, jitsi_room: room, status: 'IN_PROGRESS',
    }).select();
    if (error || !created) { Alert.alert('Failed', error?.message || 'Could not start the meeting.'); return; }
    const meeting = created[0];
    await supabase.from('meeting_attendees').insert({ meeting_id: meeting.id, user_id: myId, rsvp_status: 'ACCEPTED', joined_at: new Date().toISOString() });
    setActiveCall({ room, title: meeting.title, meetingId: meeting.id });
    loadMeetings();
  };

  // "Join meeting" (the reference's second action card) — join a
  // meeting by its id or room code directly, without it needing to
  // already be in your own attendee list (mirrors how a Teams meeting
  // link/code works — the code itself is the invite).
  const joinByCode = async () => {
    const code = joinCode.trim();
    if (!code) return;
    setJoiningByCode(true);
    try {
      const { data } = await supabase.from('meetings').select('*').or(`id.eq.${code},jitsi_room.eq.${code}`).maybeSingle();
      if (!data) { Alert.alert('Not found', "No meeting matches that code — check it and try again."); return; }
      const { data: existing } = await supabase.from('meeting_attendees').select('user_id').eq('meeting_id', data.id).eq('user_id', myId).maybeSingle();
      if (!existing) await supabase.from('meeting_attendees').insert({ meeting_id: data.id, user_id: myId, rsvp_status: 'ACCEPTED', joined_at: new Date().toISOString() });
      else await supabase.from('meeting_attendees').update({ joined_at: new Date().toISOString() }).eq('meeting_id', data.id).eq('user_id', myId);
      await supabase.from('meetings').update({ status: 'IN_PROGRESS' }).eq('id', data.id).eq('status', 'SCHEDULED');
      setShowJoinByCode(false);
      setJoinCode('');
      setActiveCall({ room: data.jitsi_room, title: data.title, meetingId: data.id });
      loadMeetings();
    } finally {
      setJoiningByCode(false);
    }
  };

  const handleRsvp = async (meetingId: string, status: 'ACCEPTED' | 'DECLINED') => {
    await supabase.from('meeting_attendees').update({ rsvp_status: status }).eq('meeting_id', meetingId).eq('user_id', myId);
    await loadMeetings();
  };

  const handleJoin = async (mtg: Meeting) => {
    await supabase.from('meeting_attendees').update({ joined_at: new Date().toISOString() }).eq('meeting_id', mtg.id).eq('user_id', myId);
    await supabase.from('meetings').update({ status: 'IN_PROGRESS' }).eq('id', mtg.id).eq('status', 'SCHEDULED');
    setActiveCall({ room: mtg.jitsi_room, title: mtg.title, meetingId: mtg.id });
    await loadMeetings();
  };

  const meetingDay = (iso: string) => (iso ? toKey(new Date(iso)) : '');
  const visibleMeetings = meetings.filter((m) => meetingDay(m.scheduled_at) === selectedDay.start);
  const meetingMarks = Object.fromEntries(meetings.filter((m) => m.scheduled_at).map((m) => [meetingDay(m.scheduled_at), { color: t.colors.accent }]));

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
          <Pressable
            onPress={startInstantMeeting}
            style={{ flex: 1, backgroundColor: t.colors.accent, borderRadius: t.radius.lg, padding: t.spacing.lg, gap: t.spacing.sm, alignItems: 'flex-start', ...t.shadow('card') }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
              <Video size={17} color="#fff" />
            </View>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: '#fff' }}>New Meeting</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowJoinByCode(true)}
            style={{ flex: 1, backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: t.spacing.lg, gap: t.spacing.sm, alignItems: 'flex-start', borderWidth: 1, borderColor: t.colors.border }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={17} color={t.colors.accent} />
            </View>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>Join Meeting</Text>
          </Pressable>
        </View>

        <Button label="Schedule a Meeting" variant="ghost" icon={<Calendar size={14} color={t.colors.accent} />} onPress={() => setShowForm(true)} />

        <Card>
          <CalendarPicker month={calMonth} onMonthChange={setCalMonth} value={selectedDay} onChange={setSelectedDay} marks={meetingMarks} />
        </Card>

        <View>
          {!loading && visibleMeetings.length === 0 ? (
            <EmptyState icon={<Calendar size={20} color={t.colors.textMuted} />} title="No meetings on this day" description="Days with a dot on the calendar have meetings." />
          ) : (
            <View style={{ gap: t.spacing.sm }}>
              {visibleMeetings.map((mtg) => (
                <Card key={mtg.id}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: 4 }}>
                        <Badge tone={STATUS_TONE[mtg.status] || 'muted'} label={mtg.status.replace(/_/g, ' ')} size="xs" />
                      </View>
                      <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }} numberOfLines={1}>{mtg.title}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Clock size={12} color={t.colors.textMuted} />
                        <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>
                          {new Date(mtg.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {mtg.duration_minutes} min
                        </Text>
                      </View>
                      {mtg.myRsvp && mtg.myRsvp !== 'ACCEPTED' && (
                        <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 4 }}>
                          Your RSVP: <Text style={{ fontFamily: t.font.bold, color: t.colors.textPrimary }}>{mtg.myRsvp}</Text>
                        </Text>
                      )}
                    </View>
                    <View style={{ gap: t.spacing.xs, alignItems: 'flex-end' }}>
                      {mtg.myRsvp === 'INVITED' ? (
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <Pressable onPress={() => handleRsvp(mtg.id, 'ACCEPTED')} style={{ padding: 6, borderRadius: t.radius.pill, backgroundColor: t.colors.accentSoft }}>
                            <Check size={14} color={t.colors.accent} />
                          </Pressable>
                          <Pressable onPress={() => handleRsvp(mtg.id, 'DECLINED')} style={{ padding: 6, borderRadius: t.radius.pill, backgroundColor: t.colors.bgInput }}>
                            <XIcon size={14} color={t.colors.textMuted} />
                          </Pressable>
                        </View>
                      ) : mtg.status !== 'CANCELLED' && mtg.status !== 'COMPLETED' ? (
                        <Pressable
                          onPress={() => handleJoin(mtg)}
                          style={{ paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.sm, borderRadius: t.radius.pill, backgroundColor: mtg.status === 'IN_PROGRESS' ? t.colors.accentSoft : t.colors.accent }}
                        >
                          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: mtg.status === 'IN_PROGRESS' ? t.colors.accent : t.colors.onAccent }}>
                            {mtg.status === 'IN_PROGRESS' ? 'Join' : 'Start'}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                  {mtg.recap_notes && (
                    <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textSecondary, marginTop: t.spacing.sm }} numberOfLines={2}>Recap: {mtg.recap_notes}</Text>
                  )}
                </Card>
              ))}
            </View>
          )}
        </View>
      </View>

      <Sheet open={showJoinByCode} onClose={() => setShowJoinByCode(false)} title="Join Meeting" side="bottom"
        footer={<Button label={joiningByCode ? 'Joining…' : 'Join'} icon={<LogIn size={14} color="#fff" />} onPress={joinByCode} loading={joiningByCode} disabled={joiningByCode || !joinCode.trim()} fullWidth />}
      >
        <Field label="Meeting ID or Code"><Input value={joinCode} onChangeText={setJoinCode} placeholder="Paste or type the meeting code" autoCapitalize="none" /></Field>
      </Sheet>

      <Sheet
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Schedule a Meeting"
        side="bottom"
        maxHeight={720}
        footer={<Button label={submitting ? 'Scheduling…' : 'Schedule Meeting & Notify Attendees'} onPress={scheduleMeeting} loading={submitting} disabled={submitting} fullWidth />}
      >
        <Field label="Meeting Title / Topic *"><Input value={title} onChangeText={setTitle} placeholder="E.g., Logistics & Fleet Align" /></Field>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}><Field label="Date *"><Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" /></Field></View>
          <View style={{ flex: 1 }}><Field label="Time *"><Input value={time} onChangeText={setTime} placeholder="HH:MM" /></Field></View>
        </View>
        <Field label="Duration (minutes)"><Input value={duration} onChangeText={setDuration} keyboardType="numeric" placeholder="30" /></Field>

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

      {activeCall && (
        <GroupCallSheet
          room={activeCall.room}
          title={activeCall.title}
          meetingId={activeCall.meetingId}
          isHost={meetings.find((m) => m.id === activeCall.meetingId)?.organizer_id === myId}
          onClose={() => setActiveCall(null)}
        />
      )}
    </Screen>
  );
}
