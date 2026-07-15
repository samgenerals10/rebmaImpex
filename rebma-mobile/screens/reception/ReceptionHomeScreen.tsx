import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, RefreshControl, Alert } from 'react-native';
import { LogOut, UserCheck } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';

interface VisitorRow {
  id: string;
  full_name: string;
  purpose: string;
  host_name: string;
  check_in_time: string;
  check_out_time: string | null;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ReceptionHomeScreen() {
  const { profile, signOut } = useAuthStore();
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [hostName, setHostName] = useState('');

  const load = useCallback(async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from('visitors')
      .select('id, full_name, purpose, host_name, check_in_time, check_out_time')
      .gte('check_in_time', startOfDay.toISOString())
      .order('check_in_time', { ascending: false });
    if (!error && data) setVisitors(data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCheckIn = async () => {
    if (!fullName.trim() || !purpose.trim() || !hostName.trim()) {
      Alert.alert('Missing Info', 'Enter the visitor name, purpose, and who they are visiting.');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('visitors').insert({
      full_name: fullName.trim(),
      purpose: purpose.trim(),
      host_name: hostName.trim(),
      checked_in_by_id: profile?.id || null,
      check_in_time: new Date().toISOString(),
    });
    setSubmitting(false);
    if (error) {
      Alert.alert('Check-In Failed', error.message);
      return;
    }
    setFullName('');
    setPurpose('');
    setHostName('');
    load();
  };

  const handleCheckOut = async (visitor: VisitorRow) => {
    setBusyId(visitor.id);
    const { error } = await supabase
      .from('visitors')
      .update({ check_out_time: new Date().toISOString() })
      .eq('id', visitor.id);
    setBusyId(null);
    if (error) {
      Alert.alert('Check-Out Failed', error.message);
      return;
    }
    load();
  };

  const stillIn = visitors.filter(v => !v.check_out_time);
  const checkedOut = visitors.filter(v => v.check_out_time);

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.userTitle}>{profile?.fullName}</Text>
          <Text style={styles.roleSub}>Reception Dashboard</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
          <LogOut size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.contentContainer}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={styles.sectionSpace}>
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Visitor Check-In</Text>
            <View style={styles.form}>
              <TextInput value={fullName} onChangeText={setFullName} placeholder="Visitor full name" placeholderTextColor="#888" style={styles.input} />
              <TextInput value={purpose} onChangeText={setPurpose} placeholder="Purpose of visit" placeholderTextColor="#888" style={styles.input} />
              <TextInput value={hostName} onChangeText={setHostName} placeholder="Who are they visiting?" placeholderTextColor="#888" style={styles.input} />
              <TouchableOpacity style={[styles.checkInBtn, submitting && styles.disabled]} onPress={handleCheckIn} disabled={submitting}>
                <Text style={styles.btnText}>{submitting ? 'Checking In...' : 'Register Visitor'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardHeader}>Currently On Site ({stillIn.length})</Text>
            {loading ? (
              <Text style={styles.emptyText}>Loading...</Text>
            ) : stillIn.length === 0 ? (
              <Text style={styles.emptyText}>No visitors currently checked in.</Text>
            ) : (
              <View style={styles.list}>
                {stillIn.map(v => (
                  <View key={v.id} style={styles.visitorRow}>
                    <View style={styles.visitorInfo}>
                      <Text style={styles.visitorName}>{v.full_name}</Text>
                      <Text style={styles.visitorMeta}>{v.purpose} · Visiting {v.host_name}</Text>
                      <Text style={styles.visitorTime}>In at {fmtTime(v.check_in_time)}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.checkOutBtn, busyId === v.id && styles.disabled]}
                      onPress={() => handleCheckOut(v)}
                      disabled={busyId === v.id}
                    >
                      <UserCheck size={13} color="#fff" />
                      <Text style={styles.checkOutBtnText}>Check Out</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {checkedOut.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardHeader}>Checked Out Today ({checkedOut.length})</Text>
              <View style={styles.list}>
                {checkedOut.map(v => (
                  <View key={v.id} style={styles.visitorRowMuted}>
                    <Text style={styles.visitorNameMuted}>{v.full_name}</Text>
                    <Text style={styles.visitorTime}>{fmtTime(v.check_in_time)} – {fmtTime(v.check_out_time!)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#ffffff',
  },
  userTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  roleSub: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginTop: 2 },
  logoutBtn: { padding: 8, backgroundColor: '#fef2f2', borderRadius: 50 },
  contentContainer: { flex: 1 },
  scrollContent: { padding: 20 },
  sectionSpace: { gap: 20 },
  card: {
    backgroundColor: '#ffffff', borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8,
    elevation: 3, borderWidth: 1, borderColor: '#e2e8f0',
  },
  cardHeader: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginBottom: 12 },
  form: { gap: 12 },
  input: {
    height: 44, backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 16,
    fontSize: 13, borderWidth: 1, borderColor: '#cbd5e1', color: '#0f172a',
  },
  checkInBtn: { height: 44, backgroundColor: '#0f55ff', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  disabled: { opacity: 0.6 },
  btnText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  emptyText: { fontSize: 12, color: '#64748b' },
  list: { gap: 10 },
  visitorRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0',
  },
  visitorInfo: { flex: 1, paddingRight: 8 },
  visitorName: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
  visitorMeta: { fontSize: 11, color: '#64748b', marginTop: 2 },
  visitorTime: { fontSize: 10, color: '#94a3b8', marginTop: 4 },
  checkOutBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#10b981', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  checkOutBtnText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  visitorRowMuted: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  visitorNameMuted: { fontSize: 12, color: '#64748b' },
});
