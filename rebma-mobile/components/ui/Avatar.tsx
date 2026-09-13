// rebma-mobile/components/ui/Avatar.tsx
// Ports: rebma-web/src/components/CustomerAvatar.tsx
import { View, Text, Image } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

interface Props {
  name: string;
  photo?: string | null;
  isSpecial?: boolean;
  size?: number;
  rounded?: 'xl' | '2xl' | 'full';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({ name, photo, isSpecial, size = 44, rounded = 'full' }: Props) {
  const t = useTheme();
  const borderRadius = rounded === 'full' ? size / 2 : rounded === '2xl' ? 16 : 12;
  const ringWidth = isSpecial ? 2 : 0;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius,
        borderWidth: ringWidth,
        borderColor: isSpecial ? t.colors.accent : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: photo ? t.colors.bgInput : t.colors.accentSoft,
      }}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <Text style={{ fontFamily: t.font.bold, fontSize: size * 0.36, color: t.colors.accent }}>{initials(name)}</Text>
      )}
    </View>
  );
}
