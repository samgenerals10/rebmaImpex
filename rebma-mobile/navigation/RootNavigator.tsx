import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import LoginScreen from '../screens/LoginScreen';
import DepartmentHomeScreen from './DepartmentHomeScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { initializing, profile, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a1f33' }}>
        <ActivityIndicator color="#ffffff" size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!profile ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <Stack.Screen name="Home" component={DepartmentHomeScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
