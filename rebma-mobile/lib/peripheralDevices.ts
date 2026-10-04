// rebma-mobile/lib/peripheralDevices.ts
//
// The device registry behind HR → Attendance → Add Device. Deliberately
// generic: devices are never hard-coded (direct instruction), and any
// device can be added whether it connects by API or by SDK:
//
//   SDK  The on-site connector program (scripts/attendance-connector/)
//        stays connected to the device on the office network and sends
//        each scan the moment it happens. The make typed in the form picks
//        the connector's driver; a make it has no driver for is reported
//        back as "no driver yet" and shown on the device.
//   API  push: the device (or its vendor cloud) posts each scan to our
//        webhook URL. No connector needed.
//        pull: the connector polls a JSON HTTP API the device exposes.
//
// fieldMap says where the employee number / time / event live in the
// device's own JSON (API devices), so a new brand doesn't need a code
// change. device_type is what lets other kinds of peripheral reuse this
// same table later.
//
// The waybill scanner has no entry here — it uses the phone's camera.
import { supabase } from './supabaseClient';

export type ConnectionType = 'sdk' | 'api';
export type ApiMode = 'push' | 'pull';
export type ConnectorStatus = 'live' | 'ok' | 'error' | 'no_driver';

export interface FieldMap {
  employeeNumber: string;
  timestamp: string;
  event: string;
  recordsPath?: string;
}

export const DEFAULT_FIELD_MAP: FieldMap = { employeeNumber: 'employeeNumber', timestamp: 'timestamp', event: 'event', recordsPath: '' };

export interface PeripheralDeviceFields {
  deviceType: string; // 'attendance' today
  deviceName: string;
  connectionType: ConnectionType;
  make: string; // typed in, never picked from a list; stored in the `protocol` column
  model?: string;
  serialNumber?: string;
  apiMode?: ApiMode;
  ipAddress?: string;
  port?: number;
  apiUrl?: string;
  authUsername?: string;
  authPassword?: string;
  apiToken?: string;
  fieldMap?: FieldMap;
  webhookSecret: string;
  department?: string;
  notes?: string;
}

export interface PeripheralDeviceRow extends PeripheralDeviceFields {
  id: string;
  isActive: boolean;
  createdAt: string;
  lastSeenAt?: string;
  connectorStatus?: ConnectorStatus;
  connectorMessage?: string;
  connectorCheckedAt?: string;
}

function mapRow(r: any): PeripheralDeviceRow {
  return {
    id: r.id, deviceType: r.device_type, deviceName: r.device_name,
    connectionType: (r.connection_type || 'sdk') as ConnectionType,
    make: r.protocol || '', model: r.model || undefined, serialNumber: r.serial_number || undefined,
    apiMode: r.api_mode || undefined,
    ipAddress: r.ip_address || undefined, port: r.port ?? undefined,
    apiUrl: r.api_url || undefined, authUsername: r.auth_username || undefined,
    authPassword: r.auth_password || undefined, apiToken: r.api_token || undefined,
    fieldMap: { ...DEFAULT_FIELD_MAP, ...(r.field_map || {}) },
    webhookSecret: r.webhook_secret,
    department: r.department || undefined, notes: r.notes || undefined,
    isActive: !!r.is_active, createdAt: r.created_at, lastSeenAt: r.last_seen_at || undefined,
    connectorStatus: r.connector_status || undefined, connectorMessage: r.connector_message || undefined,
    connectorCheckedAt: r.connector_checked_at || undefined,
  };
}

function toColumns(f: PeripheralDeviceFields) {
  const isApi = f.connectionType === 'api';
  return {
    device_type: f.deviceType, device_name: f.deviceName, connection_type: f.connectionType, protocol: f.make,
    model: f.model || null, serial_number: f.serialNumber || null,
    api_mode: isApi ? (f.apiMode || 'push') : null,
    // SDK devices are reached by IP/port; API devices by URL. Clearing the
    // other side's fields keeps a switched device from carrying stale config.
    ip_address: isApi ? null : (f.ipAddress || null), port: isApi ? null : (f.port ?? null),
    api_url: isApi ? (f.apiUrl || null) : null,
    auth_username: f.authUsername || null, auth_password: f.authPassword || null,
    api_token: isApi ? (f.apiToken || null) : null,
    // SDK records are built by the connector itself in the default shape,
    // so a custom map only makes sense for API devices. Resetting it here
    // stops a device switched from API to SDK from breaking.
    field_map: isApi ? { ...DEFAULT_FIELD_MAP, ...(f.fieldMap || {}) } : DEFAULT_FIELD_MAP,
    webhook_secret: f.webhookSecret, department: f.department || null, notes: f.notes || null,
  };
}

// The secret that proves a scan really came from this device. Made by the
// database (new_device_secret(), cryptographically random), never on the
// phone: the old Math.random() version could be guessed.
export async function newDeviceSecret(): Promise<string> {
  const { data, error } = await supabase.rpc('new_device_secret' as any);
  if (error || typeof data !== 'string' || data.length < 32) {
    throw new Error('Could not create a device secret. Make sure the database update for devices has been run.');
  }
  return data;
}

// One line HR can read at a glance: is this device working right now?
export function deviceHealth(d: PeripheralDeviceRow): { tone: 'success' | 'warning' | 'danger' | 'muted'; label: string; detail: string } {
  if (!d.isActive) return { tone: 'muted', label: 'Off', detail: 'Deactivated in the app.' };
  if (d.connectionType === 'api' && d.apiMode !== 'pull') {
    return d.lastSeenAt
      ? { tone: 'success', label: 'Receiving', detail: `Last scan ${new Date(d.lastSeenAt).toLocaleString()}.` }
      : { tone: 'warning', label: 'Waiting', detail: 'No scan has arrived yet. Check the push address is saved in the device.' };
  }
  if (!d.connectorCheckedAt) {
    return { tone: 'warning', label: 'Waiting', detail: 'The office connector program has not reported this device yet.' };
  }
  const ageMs = Date.now() - new Date(d.connectorCheckedAt).getTime();
  if (ageMs > 3 * 60_000) {
    return { tone: 'danger', label: 'Connector offline', detail: `The office connector program last reported ${new Date(d.connectorCheckedAt).toLocaleString()}. Check the office computer is on and the program is running.` };
  }
  switch (d.connectorStatus) {
    case 'live': return { tone: 'success', label: 'Live', detail: d.connectorMessage || 'Connected.' };
    case 'ok': return { tone: 'success', label: 'Reading', detail: d.connectorMessage || 'Read on a timer.' };
    case 'no_driver': return { tone: 'danger', label: 'No driver', detail: d.connectorMessage || 'The connector has no driver for this make yet.' };
    default: return { tone: 'danger', label: 'Problem', detail: d.connectorMessage || 'The connector could not reach the device.' };
  }
}

export async function listPeripheralDevices(deviceType: string): Promise<PeripheralDeviceRow[]> {
  const { data, error } = await supabase.from('peripheral_devices').select('*').eq('device_type', deviceType).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(mapRow);
}

function friendlyError(message: string): string {
  return /duplicate key|unique/i.test(message) ? 'A device with that name already exists. Each device needs its own name.' : message;
}

export async function createPeripheralDevice(fields: PeripheralDeviceFields, createdBy: string | null): Promise<PeripheralDeviceRow> {
  const { data, error } = await supabase.from('peripheral_devices').insert({ ...toColumns(fields), created_by: createdBy }).select().single();
  if (error) throw new Error(friendlyError(error.message));
  return mapRow(data);
}

export async function updatePeripheralDevice(id: string, fields: PeripheralDeviceFields): Promise<PeripheralDeviceRow> {
  const { data, error } = await supabase.from('peripheral_devices').update(toColumns(fields)).eq('id', id).select().single();
  if (error) throw new Error(friendlyError(error.message));
  return mapRow(data);
}

export async function setPeripheralDeviceActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('peripheral_devices').update({ is_active: isActive }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deletePeripheralDevice(id: string): Promise<void> {
  const { error } = await supabase.from('peripheral_devices').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
