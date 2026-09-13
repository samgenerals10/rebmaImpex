// rebma-mobile/lib/offlineQueue.ts
//
// Phase 7.12, D122: a generic AsyncStorage-backed pending-write queue,
// extending store/deliveryStore.ts's own buffer-then-flush shape (already
// proven in production for GPS coordinates) into a reusable utility
// rather than inventing a new pattern. Each screen that adopts this gets
// its own `queueKey` so one screen's backlog can never block another's.
//
// Not a Zustand store on purpose — this is plain AsyncStorage + a tiny
// pub/sub so any screen can subscribe to its own queue's pending count
// without every consumer needing to be a store subscriber.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabaseClient';

export interface QueuedWrite {
  id: string;
  table: string;
  op: 'insert' | 'update';
  payload: Record<string, unknown>;
  /** update only — the row(s) to match, e.g. { id: 'DEL-xxxxx' }. */
  match?: Record<string, unknown>;
  queuedAt: number;
}

const STORAGE_PREFIX = 'offline_queue_';

// Phase 7.12, D123/D125: the queueKeys the 4 candidate screens use — kept
// in one place so ConnectivityBanner can sum a total pending count without
// each screen having to separately register itself.
export const QUEUE_KEYS = {
  receptionAttendance: 'reception_attendance',
  receptionVisitors: 'reception_visitors',
  portIngestion: 'admin_warehouse_port_ingestion',
  proofOfDelivery: 'admin_warehouse_proof_of_delivery',
} as const;
export const ALL_QUEUE_KEYS = Object.values(QUEUE_KEYS);

type Listener = (count: number) => void;
const listeners = new Map<string, Set<Listener>>();

function notify(queueKey: string, count: number) {
  listeners.get(queueKey)?.forEach((fn) => fn(count));
}

export function subscribeQueue(queueKey: string, fn: Listener): () => void {
  if (!listeners.has(queueKey)) listeners.set(queueKey, new Set());
  listeners.get(queueKey)!.add(fn);
  return () => listeners.get(queueKey)?.delete(fn);
}

async function readQueue(queueKey: string): Promise<QueuedWrite[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_PREFIX + queueKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queueKey: string, items: QueuedWrite[]) {
  await AsyncStorage.setItem(STORAGE_PREFIX + queueKey, JSON.stringify(items));
  notify(queueKey, items.length);
}

/** Queue a failed insert for later retry. Returns the queued item's id. */
export async function enqueue(queueKey: string, table: string, payload: Record<string, unknown>): Promise<string> {
  return enqueueWrite(queueKey, { table, op: 'insert', payload });
}

/** Queue a failed update for later retry (e.g. a status flip). */
export async function enqueueUpdate(queueKey: string, table: string, payload: Record<string, unknown>, match: Record<string, unknown>): Promise<string> {
  return enqueueWrite(queueKey, { table, op: 'update', payload, match });
}

async function enqueueWrite(queueKey: string, write: Omit<QueuedWrite, 'id' | 'queuedAt'>): Promise<string> {
  const items = await readQueue(queueKey);
  const item: QueuedWrite = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, queuedAt: Date.now(), ...write };
  items.push(item);
  await writeQueue(queueKey, items);
  return item.id;
}

export async function getPendingCount(queueKey: string): Promise<number> {
  return (await readQueue(queueKey)).length;
}

export async function getPending(queueKey: string): Promise<QueuedWrite[]> {
  return readQueue(queueKey);
}

/**
 * Retries each queued row's insert, in order. A row is dropped from the
 * queue only on success — a row that fails again (still offline, or a
 * genuine server-side rejection) stays queued for the next flush.
 * Returns how many rows were successfully flushed.
 */
export async function flush(queueKey: string): Promise<number> {
  const items = await readQueue(queueKey);
  if (items.length === 0) return 0;

  const remaining: QueuedWrite[] = [];
  let flushed = 0;
  for (const item of items) {
    let error: { message: string } | null = null;
    if (item.op === 'update' && item.match) {
      let q = supabase.from(item.table).update(item.payload);
      for (const [col, val] of Object.entries(item.match)) q = q.eq(col, val as any);
      ({ error } = await q);
    } else {
      ({ error } = await supabase.from(item.table).insert(item.payload));
    }
    if (error) {
      remaining.push(item);
    } else {
      flushed++;
    }
  }
  await writeQueue(queueKey, remaining);
  return flushed;
}

/** Sum of pending items across every registered queue — powers ConnectivityBanner's badge count. */
export async function getTotalPendingCount(queueKeys: string[] = ALL_QUEUE_KEYS): Promise<number> {
  const counts = await Promise.all(queueKeys.map(getPendingCount));
  return counts.reduce((a, b) => a + b, 0);
}

/** Flushes every registered queue in turn. Returns the total rows successfully flushed. */
export async function flushAll(queueKeys: string[] = ALL_QUEUE_KEYS): Promise<number> {
  const results = await Promise.all(queueKeys.map(flush));
  return results.reduce((a, b) => a + b, 0);
}
