// rebma-mobile/navigation/DriverProfileStack.tsx
//
// The driver's own Profile tab. Reuses the same real screens the main
// app's Profile stack uses (ProfileScreen, DesignSystem, Feedback,
// Payslips) — Payslips in particular is already a generic "my own
// payslips" screen with no department dependency, so it works correctly
// for a driver as-is.
//
// Settings is the one open item: the main app's "Settings" row pushes
// into a full department-style sub-navigation (Appearance, Change
// Password, etc.) that only exists inside AppShell's DepartmentStack,
// which drivers don't have. Rather than silently doing nothing when
// tapped, or duplicating that whole routing mechanism blind without a
// way to test it, this shows an honest "not built yet" message — flagged
// here and in the build report, not shipped as a quiet dead button.
import { Alert } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileScreen from '../screens/ProfileScreen';
import DesignSystemScreen from '../screens/DesignSystemScreen';
import FeedbackScreen from '../screens/FeedbackScreen';
import PayslipsScreen from '../screens/PayslipsScreen';
import SubScreenHeader from '../components/chrome/SubScreenHeader';

const Stack = createNativeStackNavigator();

export default function DriverProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome">
        {({ navigation }) => (
          <ProfileScreen
            onOpenDesignSystem={() => navigation.navigate('DesignSystem')}
            onOpenSettings={() => Alert.alert('Settings', 'Account settings for drivers are not built yet.')}
            onOpenFeedback={() => navigation.navigate('Feedback')}
            onOpenPayslips={() => navigation.navigate('Payslips')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="DesignSystem"
        component={DesignSystemScreen}
        options={{ headerShown: true, headerTitle: 'Design System', header: (props) => <SubScreenHeader {...props} /> }}
      />
      <Stack.Screen
        name="Feedback"
        component={FeedbackScreen}
        options={{ headerShown: true, headerTitle: 'Feedback', header: (props) => <SubScreenHeader {...props} /> }}
      />
      <Stack.Screen
        name="Payslips"
        component={PayslipsScreen}
        options={{ headerShown: true, headerTitle: 'My Payslips', header: (props) => <SubScreenHeader {...props} /> }}
      />
    </Stack.Navigator>
  );
}
