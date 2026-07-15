import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { Clock, LogOut } from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';

interface Props {
  department: string;
  reason?: string;
}

export default function ComingSoonScreen({ department, reason }: Props) {
  const { profile, signOut } = useAuthStore();

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.userTitle}>{profile?.fullName}</Text>
          <Text style={styles.roleSub}>{department} Dashboard</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
          <LogOut size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>
      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <Clock size={32} color="#0f55ff" />
        </View>
        <Text style={styles.title}>{department} isn't on mobile yet</Text>
        <Text style={styles.subtitle}>
          {reason || `${department}'s screens are on the roadmap — Dispatch, Operations, and Reception are live today.`}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  userTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  roleSub: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginTop: 2 },
  logoutBtn: { padding: 8, backgroundColor: '#fef2f2', borderRadius: 50 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#eef2ff',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 19 },
});
