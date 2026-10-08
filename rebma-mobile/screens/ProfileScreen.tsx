// rebma-mobile/screens/ProfileScreen.tsx
// Shows the MobileUser fields a phone screen actually needs (§5.5 of the
// Phase 7.0 plan). Full Settings sub-screens (Change Password, 2FA, Delete
// Account, Appearance, Control Center) are Phase 7.11's job.
//
// "My Payslips" (Gap-Closure Backlog, Item 4, D114): a global, department-
// agnostic row here rather than a department subTab — payroll self-service
// is relevant to every employee regardless of department, and mobile has
// no generic "Payroll" route reachable by most departments today (only
// Finance/HR/Management/CEO have one). Same precedent as Settings/Feedback.
import { useCallback, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabaseClient';
import { LogOut, Mail, Building2, Hash, Briefcase, Sparkles, ChevronRight, ChevronLeft, Settings, MessageSquarePlus, Banknote, StickyNote, CheckSquare, HelpCircle, MessageCircleQuestion } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../store/authStore';
import { getDepartmentEntry } from '../navigation/departmentRegistry';
import Screen from '../components/ui/Screen';
import Card from '../components/ui/Card';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import PageTitle from '../components/ui/PageTitle';

interface Props {
  onOpenDesignSystem: () => void;
  onOpenSettings: () => void;
  onOpenFeedback: () => void;
  onOpenPayslips: () => void;
  onOpenNotes: () => void;
  onOpenTasks: () => void;
  onOpenEmails: () => void;
  onOpenHelp: () => void;
  // Any staff member can send HR a question (same as the laptop).
  onOpenHrQueries?: () => void;
}

export default function ProfileScreen({ onOpenDesignSystem, onOpenSettings, onOpenFeedback, onOpenPayslips, onOpenNotes, onOpenTasks, onOpenEmails, onOpenHelp, onOpenHrQueries }: Props) {
  const t = useTheme();
  const navigation = useNavigation<any>();
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);

  // Unread internal emails, shown on the Emails row (web shows the same
  // count in its sidebar).
  const [unreadEmails, setUnreadEmails] = useState(0);
  useFocusEffect(useCallback(() => {
    if (!profile?.id) return;
    supabase.from('internal_emails').select('id', { count: 'exact', head: true })
      .eq('to_user_id', profile.id).eq('read', false).eq('recipient_deleted', false)
      .then(({ count }) => setUnreadEmails(count || 0), () => {});
  }, [profile?.id]));

  if (!profile) return null;

  // Notes, Tasks, Emails and Help & News: the same tools web has in its
  // sidebar, for every department.
  const toolRows = [
    { icon: StickyNote, label: 'Notes', onPress: onOpenNotes, badge: 0 },
    { icon: CheckSquare, label: 'Tasks', onPress: onOpenTasks, badge: 0 },
    { icon: Mail, label: 'Emails', onPress: onOpenEmails, badge: unreadEmails },
    { icon: HelpCircle, label: 'Help & News', onPress: onOpenHelp, badge: 0 },
  ];
  const dept = getDepartmentEntry(profile.department);

  const rows = [
    { icon: Mail, label: 'Email', value: profile.email },
    { icon: Building2, label: 'Department', value: dept.label },
    profile.employeeNumber ? { icon: Hash, label: 'Employee Number', value: profile.employeeNumber } : null,
    profile.staffCategory ? { icon: Briefcase, label: 'Category', value: profile.staffCategory } : null,
  ].filter(Boolean) as { icon: any; label: string; value: string }[];

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.md }}>
        {/* Profile is a bottom-tab root too — same fallback as
            NotificationsScreen's back button. */}
        <Pressable
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('HomeTab'))}
          hitSlop={8}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronLeft size={19} color={t.colors.accent} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <PageTitle title="Profile" />
        </View>
      </View>
      <Card>
        <View style={{ alignItems: 'center', marginBottom: t.spacing.lg }}>
          <Avatar name={profile.fullName} photo={profile.photo} size={72} />
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.title18.size, color: t.colors.textPrimary, marginTop: t.spacing.sm }}>{profile.fullName}</Text>
        </View>
        <View style={{ gap: t.spacing.md }}>
          {rows.map((r) => (
            <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
              <r.icon size={15} color={t.colors.textMuted} />
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, width: 110 }}>{r.label}</Text>
              <Text style={{ flex: 1, fontFamily: t.font.medium, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{r.value}</Text>
            </View>
          ))}
        </View>
      </Card>

      <View style={{ marginTop: t.spacing.xl, gap: t.spacing.sm }}>
        {toolRows.map((row) => (
          <Pressable
            key={row.label}
            onPress={row.onPress}
            style={[{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, padding: t.spacing.md, borderRadius: 20, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.bgCard }, t.shadow('card')]}
          >
            <row.icon size={16} color={t.colors.textSecondary} />
            <Text style={{ flex: 1, fontFamily: t.font.medium, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{row.label}</Text>
            {row.badge > 0 && (
              <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: t.font.bold, fontSize: 10, color: t.colors.onAccent }}>{row.badge}</Text>
              </View>
            )}
            <ChevronRight size={16} color={t.colors.textMuted} />
          </Pressable>
        ))}
        <Pressable
          onPress={onOpenSettings}
          style={[{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, padding: t.spacing.md, borderRadius: 20, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.bgCard }, t.shadow('card')]}
        >
          <Settings size={16} color={t.colors.textSecondary} />
          <Text style={{ flex: 1, fontFamily: t.font.medium, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>Settings</Text>
          <ChevronRight size={16} color={t.colors.textMuted} />
        </Pressable>
        <Pressable
          onPress={onOpenFeedback}
          style={[{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, padding: t.spacing.md, borderRadius: 20, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.bgCard }, t.shadow('card')]}
        >
          <MessageSquarePlus size={16} color={t.colors.textSecondary} />
          <Text style={{ flex: 1, fontFamily: t.font.medium, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>Feedback</Text>
          <ChevronRight size={16} color={t.colors.textMuted} />
        </Pressable>
        {onOpenHrQueries && (
          <Pressable
            onPress={onOpenHrQueries}
            style={[{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, padding: t.spacing.md, borderRadius: 20, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.bgCard }, t.shadow('card')]}
          >
            <MessageCircleQuestion size={16} color={t.colors.textSecondary} />
            <Text style={{ flex: 1, fontFamily: t.font.medium, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>HR Queries</Text>
            <ChevronRight size={16} color={t.colors.textMuted} />
          </Pressable>
        )}
        <Pressable
          onPress={onOpenPayslips}
          style={[{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, padding: t.spacing.md, borderRadius: 20, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.bgCard }, t.shadow('card')]}
        >
          <Banknote size={16} color={t.colors.textSecondary} />
          <Text style={{ flex: 1, fontFamily: t.font.medium, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>My Payslips</Text>
          <ChevronRight size={16} color={t.colors.textMuted} />
        </Pressable>
      </View>

      <View style={{ marginTop: t.spacing.lg }}>
        <Button label="Sign Out" onPress={signOut} variant="danger" fullWidth icon={<LogOut size={16} color="#fff" />} />
      </View>

      {__DEV__ ? (
        <Pressable
          onPress={onOpenDesignSystem}
          style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginTop: t.spacing.xxl, padding: t.spacing.md, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border, borderStyle: 'dashed' }}
        >
          <Sparkles size={16} color={t.colors.accent} />
          <Text style={{ flex: 1, fontFamily: t.font.semibold, fontSize: t.type.body14.size, color: t.colors.textSecondary }}>Design System (dev only)</Text>
          <ChevronRight size={16} color={t.colors.textMuted} />
        </Pressable>
      ) : null}
    </Screen>
  );
}
