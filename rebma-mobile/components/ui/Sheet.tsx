// rebma-mobile/components/ui/Sheet.tsx
// Ports: rebma-web/src/components/ui/SidePanel.tsx + src/components/mobile/BottomSheet.tsx,
// unified into one component — SidePanel's own code comment notes it goes
// full-width below the `sm` breakpoint anyway, so on a phone 'right' and
// 'full' converge. 'left' doubles as the department-switcher drawer (D5).
import { useEffect, useRef, type ReactNode } from 'react';
import { Modal, View, Text, Pressable, Animated, Dimensions, BackHandler, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  badge?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  side?: 'bottom' | 'right' | 'left' | 'full';
  maxHeight?: number;
}

export default function Sheet({ open, onClose, title, subtitle, badge, children, footer, side = 'bottom', maxHeight }: Props) {
  const t = useTheme();
  const translate = useRef(new Animated.Value(1)).current; // 1 = offscreen, 0 = onscreen

  useEffect(() => {
    Animated.timing(translate, {
      toValue: open ? 0 : 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [open, onClose]);

  if (!open) return null;

  const isBottom = side === 'bottom';
  const isLeft = side === 'left';
  const isFull = side === 'full';

  const panelStyle = isBottom
    ? {
        position: 'absolute' as const, left: 0, right: 0, bottom: 0,
        maxHeight: maxHeight ?? SCREEN_H * 0.85,
        borderTopLeftRadius: t.radius.card, borderTopRightRadius: t.radius.card,
      }
    : isLeft
    ? {
        position: 'absolute' as const, top: 0, bottom: 0, left: 0,
        width: Math.min(SCREEN_W * 0.8, 320),
        borderTopRightRadius: t.radius.card, borderBottomRightRadius: t.radius.card,
      }
    : {
        position: 'absolute' as const, top: 0, bottom: 0, left: 0, right: 0,
      };

  const translateStyle = isBottom
    ? { transform: [{ translateY: translate.interpolate({ inputRange: [0, 1], outputRange: [0, SCREEN_H] }) }] }
    : isLeft
    ? { transform: [{ translateX: translate.interpolate({ inputRange: [0, 1], outputRange: [0, -SCREEN_W] }) }] }
    : { transform: [{ translateX: translate.interpolate({ inputRange: [0, 1], outputRange: [0, SCREEN_W] }) }] };

  return (
    <Modal visible={open} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={onClose} />
        <Animated.View
          style={[
            { backgroundColor: t.colors.bgCard, overflow: 'hidden' },
            panelStyle,
            translateStyle,
            isFull ? {} : t.shadow(isBottom ? 'sheet' : 'dropdown'),
          ]}
        >
          <SafeAreaView edges={isBottom ? ['bottom'] : ['top', 'bottom']} style={{ maxHeight: maxHeight ?? SCREEN_H * 0.88, flexShrink: 1, flexDirection: 'column' }}>
            {isBottom && (
              <View style={{ alignItems: 'center', paddingTop: t.spacing.sm, paddingBottom: 4 }}>
                <View style={{ width: 40, height: 5, borderRadius: t.radius.pill, backgroundColor: t.darkMode ? '#334155' : '#E2E8F0' }} />
              </View>
            )}
            {(title || subtitle) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.spacing.md, paddingHorizontal: t.spacing.xl, paddingVertical: t.spacing.md, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, flexWrap: 'wrap' }}>
                    {title ? <Text style={{ fontFamily: t.font.bold, fontSize: t.type.title18.size, color: t.colors.textPrimary }}>{title}</Text> : null}
                    {badge}
                  </View>
                  {subtitle ? <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, marginTop: 2 }}>{subtitle}</Text> : null}
                </View>
                <Pressable onPress={onClose} hitSlop={10} style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: t.darkMode ? '#334155' : '#F1F5F9' }}>
                  <X size={16} color={t.colors.textSecondary} />
                </Pressable>
              </View>
            )}
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flexShrink: 1, flexGrow: 1, flexDirection: 'column' }}
              keyboardVerticalOffset={isBottom ? 0 : undefined}
            >
              <ScrollView
                style={{ flexShrink: 1 }}
                contentContainerStyle={{ paddingHorizontal: t.spacing.xl, paddingVertical: t.spacing.lg, paddingBottom: t.spacing.xxl }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
              >
                {children}
              </ScrollView>
              {footer ? (
                <View style={{
                  borderTopWidth: 1,
                  borderTopColor: t.colors.border,
                  paddingHorizontal: t.spacing.xl,
                  paddingVertical: t.spacing.md,
                  backgroundColor: t.colors.bgCard,
                  ...t.shadow('raised'),
                }}>
                  {footer}
                </View>
              ) : null}
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

export function SheetSection({ label, children }: { label: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: t.spacing.lg }}>
      <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, letterSpacing: t.type.meta11.letterSpacing, textTransform: 'uppercase', color: t.colors.textMuted, paddingBottom: t.spacing.sm, borderBottomWidth: 1, borderBottomColor: t.colors.border, marginBottom: t.spacing.md }}>
        {label}
      </Text>
      <View style={{ gap: t.spacing.lg }}>{children}</View>
    </View>
  );
}
