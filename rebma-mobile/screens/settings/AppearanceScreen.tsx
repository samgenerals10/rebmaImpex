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
import { useTheme, FONT_SCALES, ACCENT_PALETTE, BACKGROUND_PALETTE, type FontSizePreference, type AccentKey, type BgKey } from '../../theme/ThemeProvider';
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
        {/* Background Theme Selector */}
        <Card>
          <SectionHeader
            title="Background Theme"
            subtitle="Choose your preferred surface and page background tone."
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
            {(Object.keys(BACKGROUND_PALETTE) as BgKey[]).map((key) => {
              const item = BACKGROUND_PALETTE[key];
              const selected = t.bgKey === key;
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
                  <View style={{ gap: 2 }}>
                    <Text style={{ fontFamily: selected ? t.font.bold : t.font.medium, fontSize: t.type.body12.size, color: item.textPrimary }}>
                      {item.label}
                    </Text>
                  </View>
                  {selected && (
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={14} color="#ffffff" strokeWidth={2.5} />
                    </View>
                  )}
                </Pressable>
              );
            })}
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
              const selected = t.accentKey === key;
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
          </View>
        </Card>

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

        <ModuleLauncher
          dept={dept}
          exclude={['Appearance', ...(profile?.isAdmin ? [] : ['ControlCenter'])]}
          onSelect={(id) => navigation.navigate(id)}
        />
      </View>
    </Screen>
  );
}
