import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel';
import { dispatch as dispatchApi } from '../../services/apiClient';
import {
  Truck, CheckCircle, XCircle, Search, Eye, Clock,
  Download, MoreVertical, ChevronLeft, MapPin, Camera, AlertCircle,
  Calendar, User, Package, UserCheck, Edit, Trash2, MessageCircle
} from 'lucide-react';
import { exportToCSV, exportToPDF, downloadRowPDF } from '../../utils/export';
import { uploadFile } from '../../utils/uploadFile';
import type { DeliveryRecord, Driver } from '../../types/erp';
import DispatchMap from '../../components/dispatch/DispatchMap';
import { useFullscreenToggle, FullscreenButton } from '../../components/global/FullscreenToggle';
import CountUp from '../../components/CountUp';
import { useCeoSettings } from '../../contexts/CeoSettingsContext';
import SidePanel from '../../components/ui/SidePanel';
import SearchableDropdown from '../../components/ui/SearchableDropdown';


// ── types ─────────────────────────────────────────────────────────────────────
type StatusFilter = 'ALL' | 'PENDING_ASSIGNMENT' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED';

const STATUS_META: Record<string, { bg: string; color: string; label: string }> = {
  PENDING_ASSIGNMENT: { bg: 'bg-gray-100',   color: 'text-gray-600',   label: 'Pending Assignment' },
  ASSIGNED:           { bg: 'bg-yellow-100', color: 'text-yellow-700', label: 'Assigned' },
  IN_TRANSIT:         { bg: 'bg-blue-100',   color: 'text-blue-700',   label: 'In Transit' },
  DELIVERED:          { bg: 'bg-green-100',  color: 'text-green-700',  label: 'Delivered' },
  FAILED:             { bg: 'bg-red-100',    color: 'text-red-700',    label: 'Failed' },
};

const fmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

function initials(name: string) {
  return (name || '').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
}

// drivers rows come back from Supabase in snake_case — map to the camelCase
// Driver type before use, same mapping DriversView.tsx applies.
const mapDriverToUI = (db: any): Driver => ({
  id: db.id,
  driverId: db.driver_id || db.id || '',
  fullName: db.full_name || db.fullName || '',
  phone: db.phone || '',
  ghanaCard: db.ghana_card_id || db.ghanaCard || '',
  licenseNumber: db.license_number || db.licenseNumber || '',
  truckId: db.vehicle_id || db.truckId || '',
  status: db.status || 'OFFLINE',
  totalDeliveries: Number(db.total_deliveries || 0),
  joinedAt: db.created_at || db.joinedAt || '',
  userId: db.user_id || undefined,
});

interface Props {
  addNotification: (msg: string) => void;
  currentUser?: { fullName: string; department: string } | null;
  setActiveSubTab?: (tab: string) => void;
}

// ── Assign Driver Modal ────────────────────────────────────────────────────────
function AssignDriverModal({
  delivery, drivers, onAssign, onClose,
}: {
  delivery: DeliveryRecord;
  drivers: Driver[];
  onAssign: (driverId: string, notes: string) => void;
  onClose: () => void;
}) {
  const [driverId, setDriverId] = useState('');
  const [notes, setNotes] = useState('');
  const availableDrivers = drivers.filter(d => d.status !== 'OFFLINE');

  return (
    <SidePanel
      open
      onClose={onClose}
      title="Assign Driver"
      subtitle={`${delivery.id} · ${delivery.orderId}`}
      footer={
        <>
          <button onClick={onClose} className="erp-btn erp-btn-ghost">Cancel</button>
          <button onClick={() => driverId && onAssign(driverId, notes)} disabled={!driverId} className="erp-btn erp-btn-primary disabled:opacity-50">
            Assign Driver
          </button>
        </>
      }
    >
        <div className="p-3 bg-[var(--bg-input)] rounded-xl mb-4 space-y-1">
          <p className="text-xs font-medium text-[var(--text-primary)]">{delivery.clientName}</p>
          <p className="text-xs text-[var(--text-muted)]">{delivery.destination}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Select Driver</label>
            <SearchableDropdown
              value={driverId}
              onChange={setDriverId}
              placeholder="Choose a driver..."
              options={availableDrivers.map(d => ({ value: d.id, label: `${d.fullName}, ${d.truckId}`, sublabel: d.status === 'ACTIVE' ? 'Available' : 'On Delivery' }))}
            />
            {driverId && (
              <div className="mt-2 p-2 bg-[var(--bg-input)] rounded-lg text-xs text-[var(--text-muted)]">
                Vehicle: <strong className="text-[var(--text-primary)]">{availableDrivers.find(d => d.id === driverId)?.truckId}</strong>
                {' · '}{(availableDrivers.find(d => d.id === driverId)?.totalDeliveries || 0)} total deliveries
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any special instructions..."
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none" />
          </div>
        </div>
    </SidePanel>
  );
}

// ── Delivery Detail View ───────────────────────────────────────────────────────
function DeliveryDetail({
  delivery, drivers, onBack, onMarkDelivered, onAssign, addNotification, onUploadProof,
}: {
  delivery: DeliveryRecord;
  drivers: Driver[];
  onBack: () => void;
  onMarkDelivered: (id: string) => void;
  onAssign: (delivery: DeliveryRecord) => void;
  addNotification: (msg: string) => void;
  onUploadProof: (id: string, url: string) => void;
}) {
  const proofInputRef = useRef<HTMLInputElement>(null);
  const [uploadingProof, setUploadingProof] = useState(false);

  const handleProofFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingProof(true);
    try {
      const url = await uploadFile(file, 'delivery-proofs', delivery.id);
      if (!url) throw new Error('Upload failed.');
      const { error } = await supabase.from('delivery_logs').update({ proof_photo: url }).eq('id', delivery.id);
      if (error) throw error;
      onUploadProof(delivery.id, url);
      addNotification('Proof of delivery uploaded.');
    } catch (err: any) {
      addNotification(`Upload failed: ${err.message || 'please try again.'}`);
    } finally {
      setUploadingProof(false);
    }
  };

  const badge = STATUS_META[delivery.status];
  const driver = drivers.find(d => d.id === delivery.driverId);
  const timeline = [
    { event: 'Order Ready for Dispatch', time: delivery.dispatchedAt, done: true, color: '#3b82f6' },
    { event: 'Driver Assigned', time: delivery.status !== 'PENDING_ASSIGNMENT' ? delivery.dispatchedAt : null, done: delivery.status !== 'PENDING_ASSIGNMENT', color: '#f59e0b' },
    { event: 'In Transit', time: delivery.status === 'IN_TRANSIT' || delivery.status === 'DELIVERED' ? delivery.dispatchedAt : null, done: delivery.status === 'IN_TRANSIT' || delivery.status === 'DELIVERED', color: '#6366f1' },
    { event: 'Delivered', time: delivery.deliveredAt || null, done: delivery.status === 'DELIVERED', color: '#10b981' },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]">
          <ChevronLeft size={14} /> Back
        </button>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{delivery.id}</h1>
          <p className="text-sm text-[var(--text-muted)]">Delivery Detail · {delivery.orderId}</p>
        </div>
        <span className={`ml-auto px-3 py-1.5 rounded-full text-xs font-semibold ${badge.bg} ${badge.color}`}>{badge.label}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="space-y-4">
          {/* Order summary */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 space-y-3">
            <h3 className="font-semibold text-[var(--text-primary)]">Order Summary</h3>
            {[
              { label: 'Order ID',   val: delivery.orderId, icon: Package },
              { label: 'Customer',   val: delivery.clientName, icon: User },
              { label: 'Destination',val: delivery.destination, icon: MapPin },
              { label: 'Dispatched', val: fmt(delivery.dispatchedAt), icon: Calendar },
            ].map(({ label, val, icon: Icon }) => (
              <div key={label} className="flex items-start gap-2.5">
                <Icon size={14} className="text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-[var(--text-muted)]">{label}</p>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{val}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Driver assignment */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[var(--text-primary)]">Driver</h3>
              {delivery.status !== 'DELIVERED' && (
                <button onClick={() => onAssign(delivery)} className="text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
                  {delivery.driverId ? 'Reassign' : 'Assign'} Driver
                </button>
              )}
            </div>
            {driver ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: 'var(--accent)' }}>
                  {initials(driver.fullName)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{driver.fullName}</p>
                  <p className="text-xs text-[var(--text-muted)]">{driver.phone} · {driver.truckId}</p>
                  <p className="text-xs text-[var(--text-muted)]">{driver.totalDeliveries} total deliveries</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center py-4 text-[var(--text-muted)]">
                <AlertCircle size={20} className="opacity-40 mb-1" />
                <p className="text-xs">No driver assigned yet</p>
              </div>
            )}
            {delivery.vehicleId && (
              <div className="flex items-center gap-2 p-2 bg-[var(--bg-input)] rounded-lg">
                <Truck size={13} style={{ color: 'var(--accent)' }} />
                <span className="text-xs text-[var(--text-secondary)]">Vehicle: <strong className="text-[var(--text-primary)]">{delivery.vehicleId}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Timeline */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
            <h3 className="font-semibold text-[var(--text-primary)] mb-4">Delivery Timeline</h3>
            <div className="space-y-4">
              {timeline.map((t, i) => (
                <div key={i} className="flex gap-3">
                  <div className="relative flex-shrink-0">
                    <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center ${t.done ? 'border-transparent' : 'border-[var(--border)] bg-[var(--bg-input)]'}`}
                      style={t.done ? { background: t.color } : {}}>
                      {t.done && <CheckCircle size={10} color="white" />}
                    </div>
                    {i < timeline.length - 1 && (
                      <div className={`absolute left-1.5 top-5 bottom-0 w-px -translate-x-1/2 ${t.done ? '' : 'opacity-30'}`}
                        style={{ background: t.done ? t.color : 'var(--border)', height: '28px' }} />
                    )}
                  </div>
                  <div className="pb-1">
                    <p className={`text-sm font-medium ${t.done ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>{t.event}</p>
                    {t.time && <p className="text-xs text-[var(--text-muted)]">{fmt(t.time)}</p>}
                    {!t.done && <p className="text-xs text-[var(--text-muted)] opacity-60">Pending...</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* GPS tracking */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[var(--text-primary)]">GPS Tracking</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{delivery.status === 'IN_TRANSIT' ? 'Live' : 'Static'}</span>
            </div>
            {delivery.driverId ? (
              <DispatchMap
                deliveries={[{ id: delivery.id, driverId: delivery.driverId, driverName: delivery.driverName, vehicleId: delivery.vehicleId, status: delivery.status }]}
                focusDeliveryId={delivery.id}
                height={220}
              />
            ) : (
              <div className="h-32 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] flex flex-col items-center justify-center gap-2">
                <MapPin size={24} className="text-[var(--text-muted)] opacity-40" />
                <p className="text-xs text-[var(--text-muted)]">No driver assigned yet</p>
              </div>
            )}
          </div>

          {/* Proof of Delivery */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[var(--text-primary)]">Proof of Delivery</h3>
              {!delivery.proofUrl && delivery.status !== 'DELIVERED' && (
                <button onClick={() => proofInputRef.current?.click()} disabled={uploadingProof}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-medium disabled:opacity-60" style={{ background: 'var(--accent)' }}>
                  <Camera size={12} /> {uploadingProof ? 'Uploading...' : 'Upload Proof'}
                </button>
              )}
              <input ref={proofInputRef} type="file" accept="image/*" onChange={handleProofFileChange} style={{ display: 'none' }} />
            </div>
            {delivery.proofUrl ? (
              <img src={delivery.proofUrl} alt="Proof of delivery" className="w-full aspect-video object-cover rounded-xl border border-[var(--border)]" />
            ) : (
              <div className="flex flex-col items-center py-6 text-[var(--text-muted)] border-2 border-dashed border-[var(--border)] rounded-xl">
                <Camera size={24} className="opacity-30 mb-2" />
                <p className="text-xs">No proof uploaded yet</p>
                {delivery.status === 'DELIVERED' && <p className="text-xs mt-1 opacity-60">Proof was not captured for this delivery</p>}
              </div>
            )}
            {delivery.recipientName && (
              <div className="mt-3 p-3 bg-[var(--bg-input)] rounded-xl">
                <p className="text-xs text-[var(--text-muted)]">Signed by</p>
                <p className="text-sm font-medium text-[var(--text-primary)]">{delivery.recipientName}</p>
              </div>
            )}
            {delivery.deliveryNotes && (
              <div className="mt-3 p-3 bg-[var(--bg-input)] rounded-xl">
                <p className="text-xs text-[var(--text-muted)] mb-1">Delivery Notes</p>
                <p className="text-sm text-[var(--text-primary)]">{delivery.deliveryNotes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      {delivery.status === 'IN_TRANSIT' && (
        <div className="flex flex-wrap gap-3">
          <button onClick={() => onMarkDelivered(delivery.id)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: '#10b981' }}>
            <CheckCircle size={15} /> Mark as Delivered
          </button>
          <button onClick={() => {
              downloadRowPDF(`Delivery Note - ${delivery.id}`, {
                deliveryId: delivery.id,
                orderId: delivery.orderId,
                customer: delivery.clientName,
                destination: delivery.destination,
                driver: driver?.fullName || 'Unassigned',
                vehicle: delivery.vehicleId || '—',
                dispatched: fmt(delivery.dispatchedAt),
                status: badge.label,
              });
              addNotification(`Delivery note PDF exported for ${delivery.id}`);
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)]">
            <Download size={14} /> Export Delivery Note PDF
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function DeliveriesView({ addNotification, currentUser, setActiveSubTab }: Props) {
  const { getSetting } = useCeoSettings();
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const tableFullscreen = useFullscreenToggle();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [driverFilter, setDriverFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [detailRecord, setDetailRecord] = useState<DeliveryRecord | null>(null);
  const [assignTarget, setAssignTarget] = useState<DeliveryRecord | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [menuOpenUp, setMenuOpenUp] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Flip the action dropdown upward when there isn't room below the trigger
  // button (e.g. rows near the bottom of the table), so it's never clipped
  // off-screen.
  const openMenu = (id: string, triggerEl: HTMLElement) => {
    if (menuOpen === id) { setMenuOpen(null); return; }
    const rect = triggerEl.getBoundingClientRect();
    const estimatedMenuHeight = 360;
    const spaceBelow = window.innerHeight - rect.bottom;
    setMenuOpenUp(spaceBelow < estimatedMenuHeight && rect.top > spaceBelow);
    setMenuOpen(id);
  };

  const [showEdit, setShowEdit] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<any | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('delivery_logs').select('*').order('created_at', { ascending: false }).limit(100);
      const mapped = (data ?? []).map((row: any) => ({
        id: row.id,
        orderId: row.order_id || '',
        clientName: row.customer_name || '',
        destination: row.delivery_address || '',
        driverName: row.driver_name || '',
        driverId: row.driver_id || '',
        dispatchedAt: row.created_at || '',
        deliveredAt: row.delivered_at || undefined,
        status: row.status || 'PENDING_ASSIGNMENT',
        vehicleId: row.vehicle_id || undefined,
        proofUrl: row.proof_photo || undefined,
        recipientName: row.recipient_name || undefined,
        deliveryNotes: row.notes || undefined,
      }));
      setDeliveries(mapped);
    } catch { setDeliveries([]); }
    try {
      const { data } = await supabase.from('drivers').select('*');
      if (data && data.length > 0) setDrivers(data.map(mapDriverToUI));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  useRealtimeChannel('dispatch-deliveries-realtime', ['delivery_logs'], () => loadData());

  const handleEditSave = async () => {
    if (!editingDelivery || !editingDelivery.clientName.trim() || !editingDelivery.orderId.trim()) {
      alert('Customer Name and Order ID are required.');
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    const driver = drivers.find(d => d.id === editingDelivery.driverId);
    try {
      const { error } = await supabase.from('delivery_logs')
        .update({
          order_id: editingDelivery.orderId,
          customer_name: editingDelivery.clientName,
          delivery_address: editingDelivery.destination,
          driver_name: driver ? driver.fullName : editingDelivery.driverName || null,
          driver_id: editingDelivery.driverId || null,
          vehicle_id: driver ? driver.truckId : editingDelivery.vehicleId || null,
          status: editingDelivery.status,
          delivered_at: editingDelivery.deliveredAt || null,
          notes: editingDelivery.deliveryNotes || null,
          recipient_name: editingDelivery.recipientName || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingDelivery.id);

      if (!error) {
        addNotification(`Updated delivery log ${editingDelivery.id}`);
        await loadData();
        setShowEdit(false);
        setEditingDelivery(null);
      } else {
        alert(error.message);
      }
    } catch (e: any) {
      alert(e.message || 'Failed to update delivery log.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDelivery = async (id: string) => {
    if (submitting) return;
    if (!await window.confirm(`Are you sure you want to delete delivery log ${id}?`)) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('delivery_logs').delete().eq('id', id);
      if (!error) {
        addNotification(`Deleted delivery log ${id}`);
        await loadData();
      } else {
        alert(error.message);
      }
    } catch (e: any) {
      alert(e.message || 'Failed to delete delivery log.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const handler = () => setMenuOpen(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  const todayStr = new Date().toDateString();
  const total = deliveries.length;
  const inTransit = deliveries.filter(d => d.status === 'IN_TRANSIT').length;
  const deliveredToday = deliveries.filter(d => d.status === 'DELIVERED' && d.deliveredAt && new Date(d.deliveredAt).toDateString() === todayStr).length;
  const failed = deliveries.filter(d => d.status === 'FAILED').length;
  const pendingAssign = deliveries.filter(d => d.status === 'PENDING_ASSIGNMENT').length;

  const filtered = deliveries.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !search || d.clientName.toLowerCase().includes(q) || d.orderId.toLowerCase().includes(q) || d.id.toLowerCase().includes(q) || d.driverName?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'ALL' || d.status === statusFilter;
    const matchDriver = !driverFilter || d.driverId === driverFilter;
    const matchDate = !dateFilter || d.dispatchedAt.startsWith(dateFilter);
    return matchSearch && matchStatus && matchDriver && matchDate;
  });

  const markDelivered = async (id: string) => {
    if (submitting) return;
    if (getSetting('proof_of_delivery_required', false) && !deliveries.find(d => d.id === id)?.proofUrl) {
      addNotification('A proof-of-delivery photo is required by the CEO before this can be marked delivered.');
      return;
    }
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from('delivery_logs').update({ status: 'DELIVERED', delivered_at: now }).eq('id', id);
      if (error) throw error;

      setDeliveries(prev => prev.map(d => d.id === id ? { ...d, status: 'DELIVERED', deliveredAt: now } : d));
      
      const delivery = deliveries.find(d => d.id === id);
      if (delivery?.orderId) {
        await supabase.from('orders').update({ status: 'DELIVERED' }).eq('id', delivery.orderId);
      }
      
      await supabase.from('global_audit_history').insert({ department: 'DISPATCH', action: `Delivery ${id} marked as delivered`, performed_by: currentUser?.fullName || 'Dispatch', timestamp: now });
      
      addNotification(`Delivery ${id} marked as delivered.`);
      if (detailRecord?.id === id) setDetailRecord(prev => prev ? { ...prev, status: 'DELIVERED', deliveredAt: now } : prev);
      setMenuOpen(null);
    } catch (e: any) {
      alert(e.message || 'Failed to mark as delivered.');
    } finally {
      setSubmitting(false);
    }
  };

  const markFailed = async (id: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('delivery_logs').update({ status: 'FAILED' }).eq('id', id);
      if (error) throw error;

      setDeliveries(prev => prev.map(d => d.id === id ? { ...d, status: 'FAILED' } : d));
      addNotification(`Delivery ${id} marked as failed.`);
      setMenuOpen(null);
    } catch (e: any) {
      alert(e.message || 'Failed to mark as failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignDriver = async (delivery: DeliveryRecord, driverId: string, notes: string) => {
    if (!getSetting('deliveries_enabled', true)) { addNotification('Dispatch deliveries are currently disabled by the CEO.'); return; }
    const driver = drivers.find(d => d.id === driverId);
    if (!driver) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const { pending } = await dispatchApi.assignDriverToDelivery(delivery.id, driverId, driver.fullName, driver.truckId, notes);

      if (pending) {
        addNotification(`Assignment of ${driver.fullName} to ${delivery.id} sent to Management for approval.`);
        setAssignTarget(null);
        setSubmitting(false);
        return;
      }

      setDeliveries(prev => prev.map(d => d.id === delivery.id
        ? { ...d, driverId, driverName: driver.fullName, vehicleId: driver.truckId, status: 'ASSIGNED', deliveryNotes: notes || d.deliveryNotes }
        : d
      ));

      await supabase.from('supplier_order_notifications').insert({ message: `Driver ${driver.fullName} assigned to ${delivery.orderId}`, notified_department: 'OPERATIONS', read: false, created_at: now });
      await supabase.from('global_audit_history').insert({ department: 'DISPATCH', action: `Driver ${driver.fullName} assigned to ${delivery.id}`, performed_by: currentUser?.fullName || 'Dispatch', timestamp: now });

      addNotification(`Driver ${driver.fullName} assigned to ${delivery.id}.`);
      setAssignTarget(null);
      if (detailRecord?.id === delivery.id) setDetailRecord(prev => prev ? { ...prev, driverId, driverName: driver.fullName, vehicleId: driver.truckId, status: 'ASSIGNED' } : prev);
      try {
        await dispatchApi.sendWhatsAppDirections(driverId);
        addNotification(`WhatsApp opened with the trip link for ${driver.fullName} — tap Send to deliver it.`);
      } catch (e: any) {
        addNotification(`Assigned, but couldn't open WhatsApp: ${e.message}`);
      }
    } catch (e: any) {
      alert(e.message || 'Failed to assign driver.');
    } finally {
      setSubmitting(false);
    }
  };

  if (detailRecord) {
    return (
      <DeliveryDetail
        delivery={detailRecord}
        drivers={drivers}
        onBack={() => setDetailRecord(null)}
        onMarkDelivered={markDelivered}
        onAssign={del => { setAssignTarget(del); }}
        addNotification={addNotification}
        onUploadProof={(id, url) => {
          setDeliveries(prev => prev.map(d => d.id === id ? { ...d, proofUrl: url } : d));
          setDetailRecord(prev => prev && prev.id === id ? { ...prev, proofUrl: url } : prev);
        }}
      />
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-screen-2xl mx-auto" onClick={() => setMenuOpen(null)}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Delivery Job Board</h1>
          <p className="text-sm text-[var(--text-secondary)]">Track and manage all delivery jobs</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => exportToCSV(filtered, ['id', 'orderId', 'clientName', 'destination', 'driverName', 'vehicleId', 'dispatchedAt', 'deliveredAt', 'status'], 'deliveries')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]">
            <Download size={14} /> CSV
          </button>
          <button onClick={() => exportToPDF('Delivery Job Board', filtered, ['id', 'orderId', 'clientName', 'driverName', 'status'])}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]">
            <Download size={14} /> PDF
          </button>
        </div>
      </div>

      {/* KPI summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Deliveries',   value: total,        color: 'var(--accent)', filter: 'ALL' as StatusFilter },
          { label: 'Pending Assignment', value: pendingAssign,color: '#f59e0b',       filter: 'PENDING_ASSIGNMENT' as StatusFilter },
          { label: 'In Transit',         value: inTransit,    color: '#3b82f6',       filter: 'IN_TRANSIT' as StatusFilter },
          { label: 'Delivered Today',    value: deliveredToday,color:'#10b981',       filter: 'DELIVERED' as StatusFilter },
          { label: 'Failed',             value: failed,       color: '#ef4444',       filter: 'FAILED' as StatusFilter },
        ].map(({ label, value, color, filter }) => (
          <div key={label} onClick={() => setStatusFilter(filter)}
            className={`bg-[var(--bg-card)] border rounded-2xl p-4 cursor-pointer transition-all hover:shadow-md ${statusFilter === filter ? 'border-[var(--accent)] shadow-sm' : 'border-[var(--border)]'}`}>
            <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
            <p className="text-2xl font-bold" style={{ color }}><CountUp value={value} /></p>
          </div>
        ))}
      </div>

      {/* Filter tabs + search bar */}
      <div className="space-y-3">
        <div className="flex items-center gap-1 bg-[var(--bg-input)] rounded-xl p-1 overflow-x-auto scrollbar-none">
          {([
            { label: 'All', value: 'ALL' },
            { label: 'Pending Assignment', value: 'PENDING_ASSIGNMENT' },
            { label: 'In Transit', value: 'IN_TRANSIT' },
            { label: 'Delivered', value: 'DELIVERED' },
            { label: 'Failed', value: 'FAILED' },
          ] as { label: string; value: StatusFilter }[]).map(tab => (
            <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${statusFilter === tab.value ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search client, driver, order ID…"
              className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)] placeholder-[var(--text-muted)]" />
          </div>
          <SearchableDropdown
            value={driverFilter}
            onChange={setDriverFilter}
            options={[{ value: '', label: 'All Drivers' }, ...drivers.map(d => ({ value: d.id, label: d.fullName }))]}
            className="w-44"
          />
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-secondary)] focus:outline-none" />
        </div>
      </div>

      {/* Table */}
      <div className={`bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden ${tableFullscreen.expanded ? `${tableFullscreen.fullscreenClass} p-4` : 'rounded-2xl'}`}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
          <p className="text-sm font-medium text-[var(--text-primary)]">Deliveries <span className="text-xs text-[var(--text-muted)] ml-1">({filtered.length})</span></p>
          <FullscreenButton expanded={tableFullscreen.expanded} onClick={tableFullscreen.toggle} />
        </div>

        {loading ? (
          <div className="text-center py-16 text-[var(--text-muted)]">Loading deliveries...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {['Delivery ID', 'Order ID', 'Customer', 'Destination', 'Driver / Vehicle', 'Dispatched', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-16 text-[var(--text-muted)]">No deliveries found</td></tr>
                )}
                {filtered.map(d => {
                  const badge = STATUS_META[d.status];
                  return (
                    <tr key={d.id} className="hover:bg-[var(--bg-input)] cursor-pointer" onClick={() => setDetailRecord(d)}>
                      <td className="px-4 py-3 font-mono text-xs font-bold" style={{ color: 'var(--accent)' }}>{d.id}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">{d.orderId}</td>
                      <td className="px-4 py-3 font-semibold text-[var(--text-primary)] whitespace-nowrap">{d.clientName}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] max-w-[180px] truncate">{d.destination}</td>
                      <td className="px-4 py-3">
                        {d.driverName ? (
                          <div>
                            <p className="text-xs font-medium text-[var(--text-primary)] whitespace-nowrap">{d.driverName}</p>
                            {d.vehicleId && <p className="text-xs text-[var(--text-muted)] font-mono">{d.vehicleId}</p>}
                          </div>
                        ) : (
                          <span className="text-xs text-red-500 font-medium flex items-center gap-1"><AlertCircle size={11} /> Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)] whitespace-nowrap">{fmt(d.dispatchedAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${badge.bg} ${badge.color}`}>
                          {d.status === 'IN_TRANSIT' && <Truck size={10} />}
                          {d.status === 'DELIVERED' && <CheckCircle size={10} />}
                          {d.status === 'FAILED' && <XCircle size={10} />}
                          {d.status === 'PENDING_ASSIGNMENT' && <Clock size={10} />}
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 relative" onClick={e => e.stopPropagation()}>
                        <button onClick={e => openMenu(d.id, e.currentTarget)}
                          className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] border border-transparent hover:border-[var(--border)]">
                          <MoreVertical size={14} className="text-[var(--text-muted)]" />
                        </button>
                        {menuOpen === d.id && (
                          <div ref={menuRef} className={`absolute right-4 z-20 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl py-1 min-w-[180px] max-h-[70vh] overflow-y-auto ${menuOpenUp ? 'bottom-10' : 'top-10'}`}
                            onClick={e => e.stopPropagation()}>
                            <button onClick={() => { setDetailRecord(d); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-input)] flex items-center gap-2"><Eye size={11} /> View Details</button>
                            <button onClick={() => { setMenuOpen(null); setActiveSubTab?.('Tracking'); }} className="w-full text-left px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-input)] flex items-center gap-2"><MapPin size={11} /> Track on GPS Map</button>
                            <button onClick={() => { setAssignTarget(d); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-input)] flex items-center gap-2"><UserCheck size={11} /> {d.driverId ? 'Reassign Driver' : 'Assign Driver'}</button>
                            {d.driverId && (d.status === 'ASSIGNED' || d.status === 'IN_TRANSIT') && (
                              <button
                                onClick={async () => {
                                  setMenuOpen(null);
                                  try {
                                    await dispatchApi.sendWhatsAppDirections(d.driverId!);
                                    addNotification(`WhatsApp opened with directions for ${d.driverName || 'driver'} — tap Send to deliver them.`);
                                  } catch (e: any) {
                                    addNotification(`Failed to send WhatsApp directions: ${e.message}`);
                                  }
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-input)] flex items-center gap-2"
                              >
                                <MessageCircle size={11} /> Send WhatsApp Directions
                              </button>
                            )}
                            {d.status === 'IN_TRANSIT' && (
                              <button onClick={() => markDelivered(d.id)} className="w-full text-left px-3 py-2 text-xs text-green-600 hover:bg-[var(--bg-input)] flex items-center gap-2"><CheckCircle size={11} /> Mark as Delivered</button>
                            )}
                            <button onClick={() => { setMenuOpen(null); addNotification(`Proof of delivery camera opened for ${d.id}`); }} className="w-full text-left px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-input)] flex items-center gap-2"><Camera size={11} /> Proof of Delivery</button>
                            {d.status !== 'DELIVERED' && d.status !== 'FAILED' && (
                              <button onClick={() => markFailed(d.id)} className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-[var(--bg-input)] flex items-center gap-2"><XCircle size={11} /> Mark as Failed</button>
                            )}
                            <div className="h-px bg-[var(--border)] mx-2 my-1" />
                            <button onClick={() => { setEditingDelivery({ ...d }); setShowEdit(true); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-input)] flex items-center gap-2"><Edit size={11} /> Edit Delivery Log</button>
                            <button onClick={() => { handleDeleteDelivery(d.id); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-xs text-rose-500 hover:bg-[var(--bg-input)] flex items-center gap-2"><Trash2 size={11} /> Delete Delivery Log</button>
                            <div className="h-px bg-[var(--border)] mx-2 my-1" />
                            <button onClick={() => { exportToPDF(`Delivery Note — ${d.id}`, [d], ['id', 'orderId', 'clientName', 'destination', 'driverName', 'status']); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-input)] flex items-center gap-2"><Download size={11} /> Export Delivery Note PDF</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border)] flex items-center justify-between">
          <p className="text-xs text-[var(--text-muted)]">Showing {filtered.length} of {deliveries.length} deliveries</p>
        </div>
      </div>


      {/* Assign Driver Modal */}
      {assignTarget && (
        <AssignDriverModal
          delivery={assignTarget}
          drivers={drivers}
          onAssign={(driverId, notes) => handleAssignDriver(assignTarget, driverId, notes)}
          onClose={() => setAssignTarget(null)}
        />
      )}

      <SidePanel
        open={showEdit && !!editingDelivery}
        onClose={() => { setShowEdit(false); setEditingDelivery(null); }}
        title="Edit Delivery"
        footer={
          <>
            <button onClick={() => { setShowEdit(false); setEditingDelivery(null); }} disabled={submitting} className="erp-btn erp-btn-ghost disabled:opacity-50">Cancel</button>
            <button onClick={handleEditSave} disabled={submitting} className="erp-btn erp-btn-primary disabled:opacity-50">{submitting ? 'Saving...' : 'Save Changes'}</button>
          </>
        }
      >
        {editingDelivery && (
          <div className="flex flex-col gap-4">
              <div className="erp-form-group">
                <label className="erp-label">Customer Name</label>
                <input value={editingDelivery.clientName} onChange={e => setEditingDelivery((prev: any) => ({ ...prev, clientName: e.target.value }))} className="erp-input" />
              </div>
              <div className="erp-form-group">
                <label className="erp-label">Order ID</label>
                <input value={editingDelivery.orderId} onChange={e => setEditingDelivery((prev: any) => ({ ...prev, orderId: e.target.value }))} className="erp-input" />
              </div>
              <div className="erp-form-group">
                <label className="erp-label">Destination / Delivery Address</label>
                <input value={editingDelivery.destination} onChange={e => setEditingDelivery((prev: any) => ({ ...prev, destination: e.target.value }))} className="erp-input" />
              </div>
              <div className="erp-form-group">
                <label className="erp-label">Driver ID / Name</label>
                <SearchableDropdown
                  value={editingDelivery.driverId}
                  onChange={v => setEditingDelivery((prev: any) => ({ ...prev, driverId: v }))}
                  placeholder="Assign later (Pending Assignment)"
                  options={drivers.map(d => ({ value: d.id, label: `${d.fullName} (${d.truckId})` }))}
                />
              </div>
              <div className="erp-form-group">
                <label className="erp-label">Status</label>
                <SearchableDropdown
                  value={editingDelivery.status}
                  onChange={v => setEditingDelivery((prev: any) => ({ ...prev, status: v }))}
                  options={[
                    { value: 'PENDING_ASSIGNMENT', label: 'Pending Assignment' },
                    { value: 'ASSIGNED', label: 'Assigned' },
                    { value: 'IN_TRANSIT', label: 'In Transit' },
                    { value: 'DELIVERED', label: 'Delivered' },
                    { value: 'FAILED', label: 'Failed' },
                  ]}
                />
              </div>
              <div className="erp-form-group">
                <label className="erp-label">Notes / Special Instructions</label>
                <textarea value={editingDelivery.deliveryNotes || ''} onChange={e => setEditingDelivery((prev: any) => ({ ...prev, deliveryNotes: e.target.value }))} rows={2}
                  className="erp-input resize-none" />
              </div>
          </div>
        )}
      </SidePanel>
    </div>
  );
}

