import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator } from 'react-native';
import { Truck } from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';

export default function LoginScreen() {
  const { signIn, loading, error } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <View style={styles.loginContainer}>
      <StatusBar barStyle="light-content" />
      <View style={styles.logoCircle}>
        <Truck size={42} color="#0f55ff" />
      </View>
      <Text style={styles.appName}>REBMA MOBILE</Text>
      <Text style={styles.subHeader}>Enterprise Field Operations</Text>

      <View style={styles.formCard}>
        <Text style={styles.label}>Work Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="name@rembaimpex.com"
          placeholderTextColor="#888"
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor="#888"
          secureTextEntry
          style={styles.input}
        />

        {error ? <Text style={styles.authErrorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
          onPress={() => signIn(email, password)}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.btnText}>Access Workspace</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loginContainer: {
    flex: 1,
    backgroundColor: '#0a1f33',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 2,
  },
  subHeader: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 4,
    marginBottom: 32,
  },
  formCard: {
    width: '100%',
    backgroundColor: '#0f2942',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e3a5f',
  },
  label: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    height: 48,
    backgroundColor: '#0c2035',
    borderRadius: 12,
    paddingHorizontal: 16,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e3a5f',
  },
  loginBtn: {
    height: 48,
    backgroundColor: '#0f55ff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  authErrorText: {
    color: '#f87171',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 12,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
