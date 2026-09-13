// rebma-mobile/components/ui/Badge.tsx
// Ports: rebma-web/src/index.css .erp-badge-success/-warning/-danger/-info/-muted/-purple
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import type { StatusTone } from '../../theme/tokens';

interface Props {
  tone: StatusTone;
  label: string;
  size?: 'xs' | 'sm';
}

export default function Badge({ tone, label, size = 'sm' }: Props) {
  const t = useTheme();
  const c = t.colors.status[tone];
  const fontSize = size === 'xs' ? t.type.meta10.size : t.type.meta11.size;

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: c.bg, borderRadius: t.radius.pill, paddingVertical: size === 'xs' ? 2 : 3, paddingHorizontal: size === 'xs' ? 8 : 10 },
      ]}
    >
      <Text style={{ fontFamily: t.font.semibold, fontSize, color: c.text }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignSelf: 'flex-start' },
});

// Maps the app's real status literals (used across orders/cargo/customers/
// deliveries/approvals) to a tone, so screens never hand-map this again.
const STATUS_TONE_MAP: Record<string, StatusTone> = {
  APPROVED: 'success',
  ACTIVE: 'success',
  DELIVERED: 'success',
  COMPLETED: 'success',
  PAID: 'success',

  PENDING: 'warning',
  PENDING_RISK: 'warning',
  PENDING_RISK_APPROVAL: 'warning',
  PENDING_RISK_REVIEW: 'warning',
  PENDING_FINANCE: 'warning',
  PENDING_MANAGEMENT: 'warning',
  PENDING_APPROVAL: 'warning',
  PENDING_ASSIGNMENT: 'warning',
  ASSIGNED: 'warning',
  PROCESSING: 'warning',
  ON_HOLD: 'warning',
  'PART PAID': 'warning',

  REJECTED: 'danger',
  POD_REJECTED: 'danger',
  CANCELLED: 'danger',
  UNPAID: 'danger',

  OUT_FOR_DELIVERY: 'info',
  IN_TRANSIT: 'info',

  RETURNED_FOR_CORRECTION: 'purple',
};

export function statusTone(status: string | null | undefined): StatusTone {
  if (!status) return 'muted';
  return STATUS_TONE_MAP[status.toUpperCase()] || 'muted';
}
