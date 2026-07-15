import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, RefreshControl, Alert } from 'react-native';
import { LogOut, PackageCheck, Clock } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';

interface FulfillmentTicket {
  id: string;
  order_id: string | null;
  type: string;
  details: any;
  status: string;
  created_at: string;
  order?: { client_name: string; total_amount: number } | null;
}

function fmtAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ago`;
}

export default function OperationsHomeScreen() {
  const { profile, signOut } = useAuthStore();
  const [tickets, setTickets] = useState<FulfillmentTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('fulfillment_tickets')
      .select('id, order_id, type, details, status, created_at, order:orders(client_name, total_amount)')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true });
    if (!error && data) setTickets(data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markPicked = async (ticket: FulfillmentTicket) => {
    setBusyId(ticket.id);
    const { error } = await supabase
      .from('fulfillment_tickets')
      .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
      .eq('id', ticket.id);
    setBusyId(null);
    if (error) {
      Alert.alert('Failed to Update', error.message);
      return;
    }
    setTickets(prev => prev.filter(t => t.id !== ticket.id));
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.userTitle}>{profile?.fullName}</Text>
          <Text style={styles.roleSub}>Operations Dashboard</Text>
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
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Warehouse Pick Queue</Text>
          <Text style={styles.subText}>Orders Finance has confirmed — pick and load, then mark ready.</Text>

          {loading ? (
            <Text style={styles.emptyText}>Loading...</Text>
          ) : tickets.length === 0 ? (
            <View style={styles.emptyContainer}>
              <PackageCheck size={28} color="#94a3b8" />
              <Text style={styles.emptyText}>Queue is empty. Nothing waiting to be picked.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {tickets.map(ticket => {
                const d = ticket.details || {};
                const items = Array.isArray(d.items) ? d.items : [];
                return (
                  <View key={ticket.id} style={styles.ticketCard}>
                    <View style={styles.ticketHeader}>
                      <Text style={styles.ticketClient}>{d.clientName || ticket.order?.client_name || 'Warehouse Release'}</Text>
                      <View style={styles.timeBadge}>
                        <Clock size={10} color="#64748b" />
                        <Text style={styles.timeBadgeText}>{fmtAgo(ticket.created_at)}</Text>
                      </View>
                    </View>
                    {items.length > 0 ? (
                      items.map((item: any, idx: number) => (
                        <Text key={idx} style={styles.itemLine}>
                          • {item.productName || item.product_name || item.name || 'Item'} × {item.quantity || 1}
                        </Text>
                      ))
                    ) : (
                      <Text style={styles.itemLine}>• {d.productName || 'Items pending detail'} × {d.quantity || 1}</Text>
                    )}
                    <TouchableOpacity
                      style={[styles.pickBtn, busyId === ticket.id && styles.pickBtnDisabled]}
                      onPress={() => markPicked(ticket)}
                      disabled={busyId === ticket.id}
                    >
                      <Text style={styles.pickBtnText}>{busyId === ticket.id ? 'Updating...' : 'Mark Picked & Ready'}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
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
  card: {
    backgroundColor: '#ffffff', borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8,
    elevation: 3, borderWidth: 1, borderColor: '#e2e8f0',
  },
  cardHeader: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  subText: { fontSize: 12, color: '#64748b', marginBottom: 16 },
  emptyContainer: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 12, color: '#64748b', textAlign: 'center' },
  list: { gap: 14 },
  ticketCard: { backgroundColor: '#f8fafc', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  ticketClient: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
  timeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  timeBadgeText: { fontSize: 10, color: '#64748b' },
  itemLine: { fontSize: 12, color: '#475569', marginBottom: 2 },
  pickBtn: { height: 40, backgroundColor: '#10b981', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  pickBtnDisabled: { opacity: 0.6 },
  pickBtnText: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },
});
