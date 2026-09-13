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
import { View, Text, Pressable } from 'react-native';
import { LogOut, Mail, Building2, Hash, Briefcase, Sparkles, ChevronRight, Settings, MessageSquarePlus, Banknote } from 'lucide-react-native';
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
}

export default function ProfileScreen({ onOpenDesignSystem, onOpenSettings, onOpenFeedback, onOpenPayslips }: Props) {
  const t = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);

  if (!profile) return null;
  const dept = getDepartmentEntry(profile.department);

  const rows = [
    { icon: Mail, label: 'Email', value: profile.email },
    { icon: Building2, label: 'Department', value: dept.label },
    profile.employeeNumber ? { icon: Hash, label: 'Employee Number', value: profile.employeeNumber } : null,
    profile.staffCategory ? { icon: Briefcase, label: 'Category', value: profile.staffCategory } : null,
  ].filter(Boolean) as { icon: any; label: string; value: string }[];

  return (
    <Screen>
      <PageTitle title="Profile" />
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
        <Pressable
          onPress={onOpenSettings}
          style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, padding: t.spacing.md, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.bgCard }}
        >
          <Settings size={16} color={t.colors.textSecondary} />
          <Text style={{ flex: 1, fontFamily: t.font.medium, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>Settings</Text>
          <ChevronRight size={16} color={t.colors.textMuted} />
        </Pressable>
        <Pressable
          onPress={onOpenFeedback}
          style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, padding: t.spacing.md, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.bgCard }}
        >
          <MessageSquarePlus size={16} color={t.colors.textSecondary} />
          <Text style={{ flex: 1, fontFamily: t.font.medium, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>Feedback</Text>
          <ChevronRight size={16} color={t.colors.textMuted} />
        </Pressable>
        <Pressable
          onPress={onOpenPayslips}
          style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, padding: t.spacing.md, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.bgCard }}
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
