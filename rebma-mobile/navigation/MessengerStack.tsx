// rebma-mobile/navigation/MessengerStack.tsx
// Phase 11.0 — messaging isn't scoped to one department, so it's a
// top-level stack (sibling of "App" in RootNavigator.tsx), reachable via
// navigationRef from anywhere — same pattern the department sub-tab
// screens already use, just one level higher.
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MessengerChannelsScreen from '../screens/MessengerChannelsScreen';
import MessengerThreadScreen from '../screens/MessengerThreadScreen';
import { useTheme } from '../theme/ThemeProvider';

const Stack = createNativeStackNavigator();

export default function MessengerStack() {
  const t = useTheme();
  const headerOptions = {
    headerShown: true,
    headerStyle: { backgroundColor: t.colors.bgHeader },
    headerTitleStyle: { fontFamily: t.font.bold, color: t.colors.textPrimary, fontSize: t.type.base16.size },
    headerTintColor: t.colors.accent,
    headerShadowVisible: false,
  };
  return (
    <Stack.Navigator>
      <Stack.Screen name="MessengerChannels" component={MessengerChannelsScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="MessengerThread"
        component={MessengerThreadScreen}
        options={({ route }: any) => ({ ...headerOptions, headerTitle: route.params?.title || 'Message' })}
      />
    </Stack.Navigator>
  );
}
