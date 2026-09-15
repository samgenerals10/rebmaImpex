// rebma-mobile/components/ui/Input.tsx
// Ports: rebma-web/src/index.css .erp-input / .erp-label / .erp-form-group.
// Web's focus ring (0 0 0 3px accentSoft) has no RN equivalent — border
// color change on focus only. Documented, accepted.
import { useState, type ReactNode } from 'react';
import { View, Text, TextInput, type TextInputProps } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

interface FieldProps {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
}

export function Field({ label, children, hint, error }: FieldProps) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: t.spacing.lg }}>
      <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, letterSpacing: 0.5, textTransform: 'uppercase', color: t.colors.textSecondary, marginBottom: t.spacing.xs }}>
        {label}
      </Text>
      {children}
      {hint && !error ? <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: t.spacing.xxs }}>{hint}</Text> : null}
      {error ? <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.status.danger.text, marginTop: t.spacing.xxs }}>{error}</Text> : null}
    </View>
  );
}

export default function Input(props: TextInputProps) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={t.colors.textMuted}
      {...props}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
      style={[
        {
          backgroundColor: t.colors.bgInput,
          borderWidth: focused ? 1.5 : 1,
          borderColor: focused ? t.colors.borderFocus : t.colors.border,
          borderRadius: t.radius.md,
          paddingHorizontal: t.spacing.lg,
          paddingVertical: t.spacing.md,
          fontFamily: t.font.regular,
          fontSize: t.type.body14.size,
          color: t.colors.textPrimary,
        },
        props.style,
      ]}
    />
  );
}
