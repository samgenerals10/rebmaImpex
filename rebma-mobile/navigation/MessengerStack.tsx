// rebma-mobile/navigation/MessengerStack.tsx
// Phase 11.0 — messaging isn't scoped to one department, so it's a
// top-level stack (sibling of "App" in RootNavigator.tsx), reachable via
// navigationRef from anywhere — same pattern the department sub-tab
// screens already use, just one level higher.
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MessengerChannelsScreen from '../screens/MessengerChannelsScreen';
import MessengerThreadScreen from '../screens/MessengerThreadScreen';
import SubScreenHeader from '../components/chrome/SubScreenHeader';

const Stack = createNativeStackNavigator();

export default function MessengerStack() {
  const headerOptions = {
    headerShown: true,
    header: (props: any) => <SubScreenHeader {...props} />,
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
