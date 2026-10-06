// rebma-mobile/components/chrome/DepartmentSwitcherSheet.tsx
// Ports: rebma-web/src/components/layout/Sidebar.tsx's lg:hidden mobile
// drawer (logo header / user row / #-prefixed channel list / Settings +
// Sign Out footer) — implemented as a left-side Sheet rather than a real
// drawer navigator (Design Decision D5: avoids react-native-reanimated +
// react-native-gesture-handler for a list that's one channel + Settings for
// every non-CEO user anyway).
//
// Two-fold behavior per direct correction, matching a reference image of
// a collapsible desktop sidebar: opening the sheet lands in the ICON-ONLY
// fold first (a narrow rail of just department icons + an expand arrow at
// the bottom). Tapping that arrow expands to the FULL fold (today's rich
// content: logo header, labeled department rows, profile footer). From
// full, the same bottom arrow (now pointing the other way) collapses back
// to icon-only rather than closing outright — tapping the backdrop is
// what fully dismisses the sheet from either fold, satisfying "close it
// back [to icons], then if you close it further, everything closes."
import { useState } from 'react';
import { View, Text, Pressable, Image, LayoutAnimation } from 'react-native';
import { Settings, LogOut, X, ChevronsRight, ChevronsLeft } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { availableDepartments } from '../../navigation/departmentRegistry';
import Sheet from '../ui/Sheet';
import Avatar from '../ui/Avatar';

interface Props {
  onSelectDepartment: (code: string) => void;
  onOpenSettings: () => void;
}

const ICON_WIDTH = 64;
// Snug to the longest department label ("Production & Manufacturing")
// at meta10 size, not the old generic 68%/280px — per direct correction,
// the full fold was leaving a lot of dead space past where the text
// actually ends.
const FULL_WIDTH = 216;

export default function DepartmentSwitcherSheet({ onSelectDepartment, onOpenSettings }: Props) {
  const t = useTheme();
  const open = useUIStore((s) => s.departmentSwitcherOpen);
  const close = useUIStore((s) => s.closeDepartmentSwitcher);
  const activeDepartment = useUIStore((s) => s.activeDepartment);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const [fold, setFold] = useState<'icons' | 'full'>('icons');

  if (!profile) return null;
  const depts = availableDepartments(profile.department, profile.isAdmin);
  const ACTION_COLORS = Object.values(t.colors.action);
  const isFull = fold === 'full';

  const setFoldAnimated = (next: 'icons' | 'full') => {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.scaleXY));
    setFold(next);
  };

  const closeSheet = () => {
    close();
    // Reset back to the first fold for next time it's opened, matching
    // "it opens in two folds" — icon-only is always the starting state.
    setFold('icons');
  };

  return (
    <Sheet open={open} onClose={closeSheet} side="left" width={isFull ? FULL_WIDTH : ICON_WIDTH}>
      {isFull ? (
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.spacing.sm,
              paddingBottom: t.spacing.lg,
              marginBottom: t.spacing.lg,
              borderBottomWidth: 1,
              borderBottomColor: t.colors.border,
            }}
          >
            <Image source={require('../../assets/logo-mark.png')} style={{ height: 22, width: 22 * 398 / 237 }} resizeMode="contain" />
            <Text style={{ flex: 1, fontFamily: t.font.extrabold, fontSize: t.type.body12.size, letterSpacing: 0.3, color: t.colors.textPrimary }}>
              REBMA IMPEX
            </Text>
            <Pressable
              onPress={closeSheet}
              hitSlop={10}
              style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.bgInput }}
            >
              <X size={15} color={t.colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, letterSpacing: t.type.label9.letterSpacing, textTransform: 'uppercase', color: t.colors.textMuted, marginBottom: t.spacing.xs }}>
            Departments
          </Text>
          <View style={{ gap: 6 }}>
            {depts.map((d, i) => {
              const isSelected = d.code === activeDepartment;
              const tileColor = ACTION_COLORS[i % ACTION_COLORS.length];
              const Icon = d.icon;
              return (
                <Pressable
                  key={d.code}
                  onPress={() => { onSelectDepartment(d.code); closeSheet(); }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs,
                    paddingHorizontal: t.spacing.xs, paddingVertical: 7,
                    borderRadius: t.radius.md,
                    backgroundColor: isSelected ? t.colors.accent : t.colors.bgCard,
                    borderWidth: 1,
                    borderColor: isSelected ? t.colors.accent : t.colors.border,
                    ...(isSelected ? {} : t.shadow('card')),
                  }}
                >
                  <View style={{
                    width: 26, height: 26, borderRadius: t.radius.sm,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.22)' : `${tileColor}1f`,
                  }}>
                    <Icon size={14} color={isSelected ? t.colors.onAccent : tileColor} />
                  </View>
                  <Text style={{ flex: 1, fontFamily: isSelected ? t.font.bold : t.font.medium, fontSize: t.type.meta10.size, color: isSelected ? t.colors.onAccent : t.colors.textPrimary }} numberOfLines={1}>
                    {d.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ marginTop: t.spacing.lg, paddingTop: t.spacing.md, borderTopWidth: 1, borderTopColor: t.colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.md }}>
              <Avatar name={profile.fullName} photo={profile.photo} size={34} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }} numberOfLines={1}>{profile.fullName}</Text>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }} numberOfLines={1}>{profile.email}</Text>
              </View>
            </View>
            <View style={{ gap: 2 }}>
              <Pressable onPress={() => { closeSheet(); onOpenSettings(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs, paddingVertical: t.spacing.xs }}>
                <Settings size={14} color={t.colors.textSecondary} />
                <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta10.size, color: t.colors.textSecondary }}>Settings</Text>
              </Pressable>
              <Pressable onPress={() => { closeSheet(); signOut(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs, paddingVertical: t.spacing.xs }}>
                <LogOut size={14} color={t.colors.status.danger.text} />
                <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta10.size, color: t.colors.status.danger.text }}>Sign Out</Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={() => setFoldAnimated('icons')}
            style={{
              marginTop: t.spacing.lg,
              alignSelf: 'center',
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: t.colors.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ChevronsLeft size={17} color={t.colors.accent} strokeWidth={2.4} />
          </Pressable>
        </View>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', paddingTop: t.spacing.sm }}>
          <View style={{ marginBottom: t.spacing.lg }}>
            <Image source={require('../../assets/logo-mark.png')} style={{ height: 18, width: 18 * 398 / 237 }} resizeMode="contain" />
          </View>

          <View style={{ gap: 10, flex: 1 }}>
            {depts.map((d, i) => {
              const isSelected = d.code === activeDepartment;
              const tileColor = ACTION_COLORS[i % ACTION_COLORS.length];
              const Icon = d.icon;
              return (
                <Pressable
                  key={d.code}
                  onPress={() => { onSelectDepartment(d.code); closeSheet(); }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: t.radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSelected ? t.colors.accent : `${tileColor}1f`,
                    borderWidth: isSelected ? 0 : 1,
                    borderColor: t.colors.border,
                  }}
                >
                  <Icon size={18} color={isSelected ? t.colors.onAccent : tileColor} />
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={() => { closeSheet(); }} hitSlop={8} style={{ marginBottom: t.spacing.md }}>
            <Avatar name={profile.fullName} photo={profile.photo} size={32} />
          </Pressable>

          <Pressable
            onPress={() => setFoldAnimated('full')}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: t.colors.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: t.spacing.sm,
            }}
          >
            <ChevronsRight size={17} color={t.colors.accent} strokeWidth={2.4} />
          </Pressable>
        </View>
      )}
    </Sheet>
  );
}
