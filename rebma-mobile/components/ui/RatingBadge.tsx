// rebma-mobile/components/ui/RatingBadge.tsx
// Ports: rebma-web/src/components/RatingBadge.tsx — a pill showing a
// customer's letter grade, background tinted from the grade's own color.
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import type { CustomerRating } from '../../utils/customerRating';

interface Props {
  rating: CustomerRating;
  size?: 'xs' | 'sm';
}

export default function RatingBadge({ rating, size = 'sm' }: Props) {
  const t = useTheme();
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: `${rating.color}26`,
        borderRadius: t.radius.pill,
        paddingVertical: size === 'xs' ? 2 : 3,
        paddingHorizontal: size === 'xs' ? 8 : 10,
      }}
    >
      <Text style={{ fontFamily: t.font.bold, fontSize: size === 'xs' ? t.type.meta10.size : t.type.meta11.size, color: rating.color }}>
        {rating.grade}
      </Text>
    </View>
  );
}
