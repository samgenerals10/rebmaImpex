// rebma-mobile/components/chrome/DriverQuickActionsSheet.tsx
//
// The driver's own Quick Actions — a separate sheet from
// QuickActionsSheet.tsx, since that one is driven entirely by a
// department's registry entry (subTab navigation), and a driver has no
// department. Same visual language (icon tiles), driver-specific content.
//
// Only 4 of the 5 originally proposed actions are wired here — "Call
// Dispatch" is left out on purpose: there's no real dispatch phone
// number configured anywhere in this app to call, and building a fake
// tel: link with an invented number would be worse than not having the
// button. Flagged, not silently dropped.
//
// "Mark Delivered" just takes the driver to Home rather than
// re-implementing delivery-completion logic here — that logic already
// exists in DispatchHomeScreen (handleDeliver) and carries real business
// rules (delivery always goes to PENDING_RISK_REVIEW, never straight to
// DELIVERED, plus a Risk notification insert) that shouldn't be
// duplicated a second time.
//
// "View Current Route" and "Navigate to Base" both hand off to the
// phone's own Maps app (Linking.openURL) — confirmed directly with the
// user: drivers don't need an in-app navigation engine, one tap into
// their real Maps app is the whole requirement. "Navigate to Base" uses
// the same coordinates reception/AttendanceScreen.tsx's WORKPLACE
// constant already uses for GPS-gated check-in, duplicated here rather
// than importing across an unrelated department for one constant.
import { Linking, View, Text, Pressable, Alert } from 'react-native';
import { CircleCheckBig, Radio, TriangleAlert, Navigation, Building2 } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabaseClient';
import Sheet from '../ui/Sheet';
import { colors } from '../../theme/tokens';

const COMPANY_HQ = { lat: 5.6037, lng: -0.187, name: 'REBMA IMPEX HQ' };

interface Props {
  onGoHome: () => void;
  onReportIssue: () => void;
}

export default function DriverQuickActionsSheet({ onGoHome, onReportIssue }: Props) {
  const t = useTheme();
  const open = useUIStore((s) => s.quickActionsOpen);
  const close = useUIStore((s) => s.closeQuickActions);
  const { driver } = useAuthStore();

  const openInMaps = async (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could Not Open Maps', 'No maps app is available to open this location.');
    }
  };

  const navigateToCurrentRoute = async () => {
    close();
    if (!driver) return;
    const { data } = await supabase
      .from('delivery_logs')
      .select('destination_lat, destination_lng')
      .eq('driver_id', driver.driver_id)
      .neq('status', 'DELIVERED')
      .not('destination_lat', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) {
      Alert.alert('No Active Route', "You don't have an active delivery with a destination set right now.");
      return;
    }
    openInMaps(data.destination_lat, data.destination_lng);
  };

  const navigateToBase = () => {
    close();
    openInMaps(COMPANY_HQ.lat, COMPANY_HQ.lng);
  };

  const updateStatus = (status: string) => {
    if (!driver) return;
    supabase.from('drivers').update({ status }).eq('id', driver.id);
  };

  const promptStatus = () => {
    close();
    Alert.alert('Update My Status', 'What is your current status?', [
      { text: 'Available', onPress: () => updateStatus('AVAILABLE') },
      { text: 'On Trip', onPress: () => updateStatus('ON_TRIP') },
      { text: 'Offline', onPress: () => updateStatus('OFFLINE') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const actions = [
    { label: 'Mark Delivered', actionColor: 'emerald', icon: CircleCheckBig, onPress: () => { close(); onGoHome(); } },
    { label: 'Update My Status', actionColor: 'sky', icon: Radio, onPress: promptStatus },
    { label: 'Report an Issue', actionColor: 'rose', icon: TriangleAlert, onPress: () => { close(); onReportIssue(); } },
    { label: 'View Current Route', actionColor: 'indigo', icon: Navigation, onPress: navigateToCurrentRoute },
    { label: 'Navigate to Base', actionColor: 'violet', icon: Building2, onPress: navigateToBase },
  ];

  return (
    <Sheet open={open} onClose={close} title="Quick Actions" side="bottom">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
        {actions.map((a) => {
          const Icon = a.icon;
          const circleColor = (colors.action as any)[a.actionColor] || t.colors.accent;
          return (
            <Pressable
              key={a.label}
              onPress={a.onPress}
              style={{
                width: '47%',
                alignItems: 'center',
                gap: t.spacing.sm,
                padding: t.spacing.lg,
                borderRadius: t.radius.lg,
                borderWidth: 1,
                borderColor: t.colors.border,
                backgroundColor: t.colors.bgPage,
              }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: circleColor, alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} color="#ffffff" />
              </View>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: t.colors.textPrimary, textAlign: 'center' }}>{a.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}
