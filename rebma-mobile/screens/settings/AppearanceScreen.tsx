// rebma-mobile/screens/settings/AppearanceScreen.tsx
// Ports: rebma-web/src/views/SettingsDashboard.tsx's Appearance branch
// (~626-1347) — D86, screens.home for SETTINGS. Font Size (Small/Medium/
// Large via ThemeProvider's fontScale) mirrors to
// profiles.metadata.appearance.fontSize, matching web's own
// localStorage-first-then-cloud-mirror pattern (no AsyncStorage needed —
// re-seeded from the already-loaded profile on next launch).
//
// Phase 7.12, D116-D120: Dark Mode is a real toggle now, backed by
// ThemeProvider's darkMode state — AsyncStorage-only persistence
// (`rebma-dark-mode`), matching a confirmed fact about web's own dark
// mode: it is localStorage-only and never mirrored to profiles.metadata
// (unlike fontSize, which does mirror) — so this control deliberately
// does NOT touch Supabase, unlike the Font Size control right above it.
// mobile-ui-fluidity redesign pass: Accent Color is also real now — a
// curated 6-swatch picker (ThemeProvider's ACCENT_PALETTE), AsyncStorage-
// only like Dark Mode above it, not a port of web's five alternate theme
// shells (those swap far more than a hue and stay explicitly out of
// scope). Template switching, font family, motion, density, and
// notification sound are still not built.
//
// Also the SETTINGS department's own "home" screen — includes the
// ModuleLauncher into the other 5 sub-tabs, with ControlCenter hidden for
// non-admins (matching web's own nav-level admin gate).
import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Check, ChevronLeft, Palette } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useTheme, FONT_SCALES, ACCENT_PALETTE, BACKGROUND_PALETTE, type FontSizePreference, type AccentKey, type BgKey } from '../../theme/ThemeProvider';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import SectionHeader from '../../components/ui/SectionHeader';
import ModuleLauncher from '../../components/chrome/ModuleLauncher';
import Sheet from '../../components/ui/Sheet';
import ColorPicker from '../../components/ui/ColorPicker';
import NotificationSoundPicker from '../../components/settings/NotificationSoundPicker';
import { getDeviceAlertsEnabled, setDeviceAlertsEnabled, registerForPushNotifications, unregisterPushNotifications } from '../../lib/pushNotifications';

const OPTIONS: { value: FontSizePreference; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

export default function AppearanceScreen() {
  const t = useTheme();
  const navigation = useNavigation<any>();
  const profile = useAuthStore((s) => s.profile);
  const dept = getDepartmentEntry('SETTINGS');
  const [saving, setSaving] = useState(false);
  const [accentPickerOpen, setAccentPickerOpen] = useState(false);
  const [bgPickerOpen, setBgPickerOpen] = useState(false);
  const [draftAccent, setDraftAccent] = useState(t.colors.accent);
  const [draftBg, setDraftBg] = useState(t.colors.bgPage);
  const [alertsOn, setAlertsOn] = useState(true);
  const [alertsBusy, setAlertsBusy] = useState(false);
  const [alertsNote, setAlertsNote] = useState('');

  useEffect(() => {
    getDeviceAlertsEnabled().then(setAlertsOn);
  }, []);

  // Per phone. Off removes this phone's alert address, so nothing buzzes
  // here; the bell still keeps every alert.
  const setAlerts = async (on: boolean) => {
    if (!profile || alertsBusy || on === alertsOn) return;
    setAlertsBusy(true);
    setAlertsNote('');
    await setDeviceAlertsEnabled(on);
    setAlertsOn(on);
    if (on) {
      const res = await registerForPushNotifications(profile.id);
      if (!res.token) setAlertsNote('Alerts are on, but this phone cannot receive them yet. Allow notifications for Rebma in the phone settings, and use the installed app rather than a test app.');
    } else {
      await unregisterPushNotifications(profile.id);
    }
    setAlertsBusy(false);
  };

  // Settings is reached by a one-way `setActiveDepartment('SETTINGS')` call
  // (the department switcher's Settings row, or the header menu) — that
  // remounts the whole DepartmentStack with no native "back" of its own,
  // which is exactly the "can't come back" bug reported live. This is the
  // fix: jump straight back to whatever department was active before.
  const previousDepartment = useUIStore((s) => s.previousDepartment);
  const setActiveDepartment = useUIStore((s) => s.setActiveDepartment);
  const canGoBack = !!previousDepartment && previousDepartment !== 'SETTINGS';
  const previousDept = canGoBack ? getDepartmentEntry(previousDepartment) : null;

  const choose = async (pref: FontSizePreference) => {
    t.setFontSizePreference(pref);
    if (!profile) return;
    setSaving(true);
    try {
      const existingMetadata = (profile.raw as any)?.metadata || {};
      await supabase.from('profiles').update({
        metadata: { ...existingMetadata, appearance: { ...(existingMetadata.appearance || {}), fontSize: pref } },
      }).eq('id', profile.id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: t.spacing.xl }}>
        {canGoBack && previousDept && (
          <Pressable
            onPress={() => setActiveDepartment(previousDepartment)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              alignSelf: 'flex-start',
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: t.radius.pill,
              backgroundColor: t.colors.accentSoft,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <ChevronLeft size={16} color={t.colors.accent} strokeWidth={2.4} />
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: t.colors.accent }}>
              Back to {previousDept.label}
            </Text>
          </Pressable>
        )}

        {/* Background Theme Selector */}
        <Card>
          <SectionHeader
            title="Background Theme"
            subtitle="Choose your preferred surface and page background tone."
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
            {(Object.keys(BACKGROUND_PALETTE) as BgKey[]).map((key) => {
              const item = BACKGROUND_PALETTE[key];
              const selected = t.bgKey === key && !t.customBgHex;
              return (
                <Pressable
                  key={key}
                  onPress={() => t.setBgKey(key)}
                  style={{
                    flexBasis: '47%',
                    flexGrow: 1,
                    padding: t.spacing.md,
                    borderRadius: t.radius.lg,
                    backgroundColor: item.bgPage,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? t.colors.accent : t.colors.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ gap: 2, flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontFamily: selected ? t.font.bold : t.font.medium, fontSize: t.type.body12.size, color: item.textPrimary }}>
                      {item.label}
                    </Text>
                  </View>
                  {selected && (
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={14} color={t.colors.onAccent} strokeWidth={2.5} />
                    </View>
                  )}
                </Pressable>
              );
            })}
            {/* Custom Color tile — opens the real HSL color picker (direct
                correction: the app only offered fixed preset swatches). */}
            <Pressable
              onPress={() => { setDraftBg(t.customBgHex || t.colors.bgPage); setBgPickerOpen(true); }}
              style={{
                flexBasis: '47%',
                flexGrow: 1,
                padding: t.spacing.md,
                borderRadius: t.radius.lg,
                backgroundColor: t.customBgHex || t.colors.bgCard,
                borderWidth: t.customBgHex ? 2 : 1,
                borderColor: t.customBgHex ? t.colors.accent : t.colors.border,
                borderStyle: t.customBgHex ? 'solid' : 'dashed',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs, flex: 1 }}>
                <Palette size={16} color={t.customBgHex ? t.colors.textPrimary : t.colors.textSecondary} />
                <Text numberOfLines={1} style={{ fontFamily: t.customBgHex ? t.font.bold : t.font.medium, fontSize: t.type.body12.size, color: t.customBgHex ? t.colors.textPrimary : t.colors.textSecondary }}>
                  Custom
                </Text>
              </View>
              {t.customBgHex && (
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={14} color={t.colors.onAccent} strokeWidth={2.5} />
                </View>
              )}
            </Pressable>
          </View>
        </Card>

        {/* Button & Accent Color Selector */}
        <Card>
          <SectionHeader
            title="Button & Accent Color"
            subtitle="Customizes primary buttons, active tabs, and key highlights."
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
            {(Object.keys(ACCENT_PALETTE) as AccentKey[]).map((key) => {
              const swatch = ACCENT_PALETTE[key];
              const selected = t.accentKey === key && !t.customAccentHex;
              return (
                <Pressable
                  key={key}
                  onPress={() => t.setAccentKey(key)}
                  style={{ alignItems: 'center', gap: t.spacing.xxs, minWidth: 64 }}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: t.radius.lg,
                      backgroundColor: swatch.accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: selected ? 3 : 0,
                      borderColor: '#ffffff',
                      ...t.shadow('raised'),
                    }}
                  >
                    {selected ? <Check size={20} color="#ffffff" strokeWidth={3} /> : null}
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: selected ? t.font.bold : t.font.regular,
                      fontSize: t.type.meta10.size,
                      color: t.colors.textSecondary,
                      textAlign: 'center',
                    }}
                  >
                    {swatch.label.split(' ')[0]}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => { setDraftAccent(t.customAccentHex || t.colors.accent); setAccentPickerOpen(true); }}
              style={{ alignItems: 'center', gap: t.spacing.xxs, minWidth: 64 }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: t.radius.lg,
                  backgroundColor: t.customAccentHex || t.colors.bgInput,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: t.customAccentHex ? 3 : 1,
                  borderColor: t.customAccentHex ? '#ffffff' : t.colors.border,
                  borderStyle: t.customAccentHex ? 'solid' : 'dashed',
                  ...t.shadow('raised'),
                }}
              >
                {t.customAccentHex ? <Check size={20} color="#ffffff" strokeWidth={3} /> : <Palette size={18} color={t.colors.textMuted} />}
              </View>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: t.customAccentHex ? t.font.bold : t.font.regular,
                  fontSize: t.type.meta10.size,
                  color: t.colors.textSecondary,
                  textAlign: 'center',
                }}
              >
                Custom
              </Text>
            </Pressable>
          </View>
        </Card>

        <Sheet open={accentPickerOpen} onClose={() => setAccentPickerOpen(false)} title="Custom Accent Color" subtitle="Pick any color for buttons and highlights." side="bottom">
          <View style={{ paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.lg }}>
            <ColorPicker initialHex={t.customAccentHex || t.colors.accent} onChange={setDraftAccent} />
            <View style={{ flexDirection: 'row', gap: t.spacing.sm, marginTop: t.spacing.xl }}>
              <View style={{ flex: 1 }}>
                <Button label="Cancel" variant="ghost" onPress={() => setAccentPickerOpen(false)} fullWidth />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Apply" onPress={() => { t.setCustomAccent(draftAccent); setAccentPickerOpen(false); }} fullWidth />
              </View>
            </View>
          </View>
        </Sheet>

        <Sheet open={bgPickerOpen} onClose={() => setBgPickerOpen(false)} title="Custom Background" subtitle="Pick any base color for page background and surfaces." side="bottom">
          <View style={{ paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.lg }}>
            <ColorPicker initialHex={t.customBgHex || t.colors.bgPage} onChange={setDraftBg} />
            <View style={{ flexDirection: 'row', gap: t.spacing.sm, marginTop: t.spacing.xl }}>
              <View style={{ flex: 1 }}>
                <Button label="Cancel" variant="ghost" onPress={() => setBgPickerOpen(false)} fullWidth />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Apply" onPress={() => { t.setCustomBg(draftBg); setBgPickerOpen(false); }} fullWidth />
              </View>
            </View>
          </View>
        </Sheet>

        {/* Font Size Selector */}
        <Card>
          <SectionHeader title="Font Size" subtitle="Applies scaled typography across the whole app." />
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            {OPTIONS.map((o) => (
              <View key={o.value} style={{ flex: 1 }}>
                <Button
                  label={o.label}
                  size="sm"
                  variant={t.fontSizePreference === o.value ? 'primary' : 'ghost'}
                  onPress={() => choose(o.value)}
                  disabled={saving}
                />
              </View>
            ))}
          </View>
        </Card>

        {/* Dark Mode Switch */}
        <Card>
          <SectionHeader title="Dark Mode" subtitle="Switch instantly between high-contrast light and dark velvet modes." />
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="Light Mode" size="sm" variant={!t.darkMode ? 'primary' : 'ghost'} onPress={() => t.darkMode && t.toggleDarkMode()} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Dark Mode" size="sm" variant={t.darkMode ? 'primary' : 'ghost'} onPress={() => !t.darkMode && t.toggleDarkMode()} />
            </View>
          </View>
        </Card>

        {/* Alerts on this device */}
        <Card>
          <SectionHeader title="Alerts on this device" subtitle="Show alerts on this phone's lock screen. Turning this off only affects this phone, and the bell still keeps every alert." />
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="On" size="sm" variant={alertsOn ? 'primary' : 'ghost'} onPress={() => setAlerts(true)} disabled={alertsBusy} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Off" size="sm" variant={!alertsOn ? 'primary' : 'ghost'} onPress={() => setAlerts(false)} disabled={alertsBusy} />
            </View>
          </View>
          {alertsNote ? (
            <Text style={{ marginTop: t.spacing.sm, fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>{alertsNote}</Text>
          ) : null}
        </Card>

        {/* Notification Sound Picker */}
        <Card>
          <SectionHeader title="Notification Sound" subtitle="Choose the tone that plays for new alerts and messages." />
          <NotificationSoundPicker />
        </Card>

        <ModuleLauncher
          dept={dept}
          exclude={['Appearance', ...(profile?.isAdmin ? [] : ['ControlCenter'])]}
          onSelect={(id) => navigation.navigate(id)}
        />
      </View>
    </Screen>
  );
}
