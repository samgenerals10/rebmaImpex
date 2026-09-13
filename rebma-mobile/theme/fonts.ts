// rebma-mobile/theme/fonts.ts
//
// rebma-web's --font-base is 'Inter'. Loaded at runtime via useFonts (not
// the expo-font config plugin's build-time embedding) so this keeps working
// in Expo Go with no dev build — revisit when Phase 7.12 sets up EAS.
import {
  useFonts,
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

export function useAppFonts() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  // Don't block the app forever on a font-loading failure — fall back to
  // the system font rather than an infinite splash screen.
  return fontsLoaded || !!fontError;
}
