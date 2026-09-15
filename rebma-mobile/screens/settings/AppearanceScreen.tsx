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
import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Check } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useTheme, FONT_SCALES, ACCENT_PALETTE, type FontSizePreference, type AccentKey } from '../../theme/ThemeProvider';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import SectionHeader from '../../components/ui/SectionHeader';
import ModuleLauncher from '../../components/chrome/ModuleLauncher';

const OPTIONS: { value: FontSizePreference; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium (Default)' },
  { value: 'large', label: 'Large' },
];

export default function AppearanceScreen() {
  const t = useTheme();
  const navigation = useNavigation<any>();
  const profile = useAuthStore((s) => s.profile);
  const dept = getDepartmentEntry('SETTINGS');
  const [saving, setSaving] = useState(false);

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
        <Card>
          <SectionHeader title="Font Size" subtitle="Applies across the whole app." />
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

        <Card>
          <SectionHeader title="Dark Mode" subtitle="Matches Web's real toggle: a plain on/off, not a system-match option." />
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="Light" size="sm" variant={!t.darkMode ? 'primary' : 'ghost'} onPress={() => t.darkMode && t.toggleDarkMode()} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Dark" size="sm" variant={t.darkMode ? 'primary' : 'ghost'} onPress={() => !t.darkMode && t.toggleDarkMode()} />
            </View>
          </View>
        </Card>

        <Card>
          <SectionHeader title="Accent Color" subtitle="Changes the app's highlight color everywhere, on this device only." />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
            {(Object.keys(ACCENT_PALETTE) as AccentKey[]).map((key) => {
              const swatch = ACCENT_PALETTE[key];
              const selected = t.accentKey === key;
              return (
                <Pressable key={key} onPress={() => t.setAccentKey(key)} style={{ alignItems: 'center', gap: t.spacing.xxs }}>
                  <View style={{
                    width: 44, height: 44, borderRadius: t.radius.lg, backgroundColor: swatch.accent,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: selected ? 2 : 0, borderColor: t.colors.textPrimary,
                  }}>
                    {selected ? <Check size={18} color="#ffffff" /> : null}
                  </View>
                  <Text style={{ fontFamily: selected ? t.font.bold : t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textSecondary }}>
                    {swatch.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card tone="inset">
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>
            Template switching and motion presets are not built yet. Font Size, Dark Mode, and Accent Color above are all real and apply across the whole app right now.
          </Text>
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
