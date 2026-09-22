// rebma-mobile/components/auth/AuthBackButton.tsx
//
// A real back button — always visible, never disappears. Goes back
// when there's a screen to return to; otherwise falls back to Welcome
// so it's never a dead control with nowhere to send the user.
import { Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { FOREST } from './AuthGradientButton';

export default function AuthBackButton() {
  const navigation = useNavigation<any>();

  const handlePress = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
    }
  };

  return (
    <Pressable onPress={handlePress} hitSlop={10} style={styles.button}>
      <ChevronLeft size={20} color={FOREST} strokeWidth={2.4} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
});
