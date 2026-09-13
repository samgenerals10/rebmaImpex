// rebma-mobile/components/chrome/ConnectivityBanner.tsx
//
// Phase 7.12, D125: a new root-level connectivity banner. Research
// confirmed zero global network awareness exists anywhere in this app
// before this phase — App.tsx had no network provider/context/banner at
// all, the only place connectivity was ever surfaced to a user was
// Dispatch's own scoped Switch (DispatchHomeScreen.tsx). Shown from
// AppShell.tsx whenever the real, netinfo-driven `networkOnline` (D121)
// reports offline, with a combined pending-sync count across every
// screen's offline queue (D122/D123). Also owns the "auto-flush on
// reconnect" behavior — the moment `networkOnline` flips back to true,
// every registered queue is flushed automatically, with no manual tap
// needed (a "Sync Now" button is still offered for a partial-failure
// retry, mirroring DispatchHomeScreen's existing "Sync Queue" button).
import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { WifiOff, RefreshCw } from 'lucide-react-native';
import { useDeliveryStore } from '../../store/deliveryStore';
import { getTotalPendingCount, flushAll } from '../../lib/offlineQueue';
import { useTheme } from '../../theme/ThemeProvider';

export default function ConnectivityBanner() {
  const t = useTheme();
  const networkOnline = useDeliveryStore((s) => s.networkOnline);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const wasOffline = useRef(false);

  const refreshCount = async () => {
    setPending(await getTotalPendingCount());
  };

  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (networkOnline && wasOffline.current) {
      // Reconnected — auto-flush every registered queue with no tap needed.
      (async () => {
        setSyncing(true);
        await flushAll();
        await refreshCount();
        setSyncing(false);
      })();
    }
    wasOffline.current = !networkOnline;
  }, [networkOnline]);

  const syncNow = async () => {
    setSyncing(true);
    await flushAll();
    await refreshCount();
    setSyncing(false);
  };

  if (networkOnline && pending === 0) return null;

  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.sm,
        backgroundColor: networkOnline ? t.colors.status.info.bg : t.colors.status.danger.bg,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs, flex: 1 }}>
        {!networkOnline && <WifiOff size={13} color={t.colors.status.danger.text} />}
        <Text
          style={{
            fontFamily: t.font.bold, fontSize: t.type.meta10.size,
            color: networkOnline ? t.colors.status.info.text : t.colors.status.danger.text,
          }}
        >
          {networkOnline
            ? syncing ? 'Syncing…' : `${pending} item${pending === 1 ? '' : 's'} waiting to sync`
            : pending > 0 ? `Offline — ${pending} item${pending === 1 ? '' : 's'} will sync when back online` : 'Offline — some actions may not save'}
        </Text>
      </View>
      {networkOnline && pending > 0 && !syncing && (
        <Pressable onPress={syncNow} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <RefreshCw size={12} color={t.colors.status.info.text} />
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: t.colors.status.info.text }}>Sync Now</Text>
        </Pressable>
      )}
    </View>
  );
}
