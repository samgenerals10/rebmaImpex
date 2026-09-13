import { useState, useEffect, useRef } from 'react';
import { Plus, Search, ArrowLeft, Pencil, Trash2, Download, Star, Camera, Upload, FileText, RefreshCw, AlertTriangle, ExternalLink, History } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Customer, Order } from '../../types/erp';
import CustomerAvatar from '../../components/CustomerAvatar';
import RatingBadge from '../../components/RatingBadge';
import { computeCustomerRating, ordersForCustomer, ordersForCustomerRow, outstandingCreditFor } from '../../utils/customerRating';
import CountUp from '../../components/CountUp';
import { uploadFile, uploadPrivateFile, getSignedFileUrl } from '../../utils/uploadFile';
import SidePanel from '../../components/ui/SidePanel';
import SearchableDropdown from '../../components/ui/SearchableDropdown';
import ResponsiveDataView, { type DataColumn } from '../../components/mobile/ResponsiveDataView';
import DestinationLocator, { type Coords } from '../../components/dispatch/DestinationLocator';
import RequestTimelinePanel from '../../components/global/RequestTimelinePanel';

const VERIFICATION_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
  RETURNED_FOR_CORRECTION: 'bg-orange-100 text-orange-700',
};
const VERIFICATION_LABELS: Record<string, string> = {
  PENDING: 'Pending Risk Review',
  APPROVED: 'Verified',
  REJECTED: 'Rejected',
  RETURNED_FOR_CORRECTION: 'Returned for Correction',
};

interface Props {
  customersList: Customer[];
  onRegisterCustomer: (data: Partial<Customer>) => void;
  addNotification: (msg: string) => void;
}

export default function CustomersView({ customersList, onRegisterCustomer, addNotification }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerTimeline, setShowCustomerTimeline] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: '', companyName: '', phone: '', location: '', email: '', ghanaCard: '', isSpecialCustomer: false,
    houseAddress: '', companyAddress: '', ghanaCard2: '', partnerName: '', notes: '',
  });

  // GPS location (reuses the same picker order-creation uses for delivery destinations)
  const [gpsAddressText, setGpsAddressText] = useState('');
  const [gpsCoords, setGpsCoords] = useState<Coords | null>(null);

  // Business certificate upload — file picker or live camera capture, same
  // pattern as dispatch/ProofOfDeliveryView.tsx's proof-of-delivery capture.
  const [businessCertUrl, setBusinessCertUrl] = useState<string | null>(null);
  const [uploadingCert, setUploadingCert] = useState(false);
  const certFileInputRef = useRef<HTMLInputElement>(null);
  const [isCertCameraActive, setIsCertCameraActive] = useState(false);
  const [certCameraStream, setCertCameraStream] = useState<MediaStream | null>(null);
  const [certCameraError, setCertCameraError] = useState<string | null>(null);
  const certVideoRef = useRef<HTMLVideoElement>(null);
  const [hasGetUserMedia] = useState(() => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [{ data: cData }, { data: oData }] = await Promise.all([
          supabase.from('customers').select('*').order('registered_at', { ascending: false }).limit(200),
          supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(300),
        ]);
        const mappedCustomers = (cData || []).map((r: any) => ({
          id: r.id,
          name: r.name || '',
          companyName: r.company_name || r.companyName || '',
          phone: r.phone || '',
          email: r.email || '',
          location: r.location || '',
          ghanaCard: r.ghana_card_id || r.ghanaCard || '',
          photo: r.customer_photo || r.photo || undefined,
          registeredAt: r.registered_at || r.registeredAt || new Date().toISOString(),
          orderHistory: [],
          creditHistory: [],
          isSpecialCustomer: r.is_special_customer ?? false,
          discountPercent: Number(r.discount_percent) || 0,
          houseAddress: r.house_address || undefined,
          companyAddress: r.company_address || undefined,
          gpsLat: r.gps_lat != null ? Number(r.gps_lat) : undefined,
          gpsLng: r.gps_lng != null ? Number(r.gps_lng) : undefined,
          ghanaCard2: r.ghana_card_id_2 || undefined,
          partnerName: r.partner_name || undefined,
          businessCertificateUrl: r.business_certificate_url || undefined,
          notes: r.notes || undefined,
          status: r.status || 'PENDING',
          verifiedBy: r.verified_by || undefined,
          verifiedAt: r.verified_at || undefined,
          rejectionReason: r.rejection_reason || undefined,
          creditLimit: r.credit_limit != null ? Number(r.credit_limit) : null,
          creditStatus: r.credit_status || 'ACTIVE',
          creditTermsSetBy: r.credit_terms_set_by || undefined,
          creditTermsSetAt: r.credit_terms_set_at || undefined,
        }));
        const mappedOrders = (oData || []).map((r: any) => ({
          id: r.id,
          ticketNumber: r.ticket_number || r.ticketNumber || r.id,
          clientName: r.client_name || r.clientName || '',
          productName: r.product_name || r.productName || '',
          destination: r.destination || '',
          totalAmount: Number(r.total_amount || r.totalAmount || 0),
          amountPaid: Number(r.amount_paid || r.amountPaid || 0),
          customerId: r.customer_id || r.customerId || undefined,
          paymentMode: r.payment_mode || r.paymentMode || 'CASH',
          status: r.status || 'PENDING_FINANCE',
          rejectionReason: r.rejection_reason || undefined,
          createdAt: r.created_at || r.createdAt || new Date().toISOString(),
        }));
        setCustomers(mappedCustomers.length > 0 ? mappedCustomers : customersList.length > 0 ? customersList : []);
        setOrders(mappedOrders.length > 0 ? mappedOrders : []);
      } catch {
        setCustomers(customersList.length > 0 ? customersList : []);
        setOrders([]);
      }
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (customersList && customersList.length > 0) {
      setCustomers(customersList);
    }
  }, [customersList]);

  const locations = Array.from(new Set(customers.map(c => c.location)));
  const now = new Date();
  const thisMonth = customers.filter(c => {
    const d = new Date(c.registeredAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const withOrders = customers.filter(c => (c.orderHistory || []).length > 0).length;
  // Real per-customer outstanding, summed from live orders — the old
  // creditHistory array was always empty (never populated by any mapper),
  // so this figure was silently 0 regardless of actual credit exposure.
  const totalCredit = customers.reduce((sum, c) => sum + outstandingCreditFor(orders, c), 0);

  const filtered = customers.filter(c => {
    if (locationFilter !== 'ALL' && c.location !== locationFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.companyName.toLowerCase().includes(q) && !c.phone.includes(q)) return false;
    }
    return true;
  });

  const resetForm = () => {
    setForm({ name: '', companyName: '', phone: '', location: '', email: '', ghanaCard: '', isSpecialCustomer: false, houseAddress: '', companyAddress: '', ghanaCard2: '', partnerName: '', notes: '' });
    setGpsAddressText('');
    setGpsCoords(null);
    setBusinessCertUrl(null);
  };

  const handleSave = async () => {
    if (!form.name || !form.phone) { addNotification('Name and phone are required.'); return; }
    const now = new Date().toISOString();
    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      name: form.name,
      companyName: form.companyName || form.name,
      phone: form.phone,
      location: form.location,
      email: form.email,
      ghanaCard: form.ghanaCard,
      registeredAt: now,
      orderHistory: [],
      creditHistory: [],
      isSpecialCustomer: form.isSpecialCustomer,
      discountPercent: 0,
      houseAddress: form.houseAddress || undefined,
      companyAddress: form.companyAddress || undefined,
      gpsLat: gpsCoords?.lat,
      gpsLng: gpsCoords?.lng,
      ghanaCard2: form.ghanaCard2 || undefined,
      partnerName: form.partnerName || undefined,
      businessCertificateUrl: businessCertUrl || undefined,
      notes: form.notes || undefined,
      status: 'PENDING',
    };
    onRegisterCustomer(newCust);
    setCustomers(prev => [newCust, ...prev]);
    setShowModal(false);
    resetForm();
  };

  const openEdit = (c: Customer) => {
    setEditTarget(c);
    setForm({
      name: c.name, companyName: c.companyName || '', phone: c.phone, location: c.location || '', email: c.email || '', ghanaCard: c.ghanaCard || '', isSpecialCustomer: c.isSpecialCustomer || false,
      houseAddress: c.houseAddress || '', companyAddress: c.companyAddress || '', ghanaCard2: c.ghanaCard2 || '', partnerName: c.partnerName || '', notes: c.notes || '',
    });
    setGpsAddressText(c.location || '');
    setGpsCoords(c.gpsLat != null && c.gpsLng != null ? { lat: c.gpsLat, lng: c.gpsLng } : null);
    setBusinessCertUrl(c.businessCertificateUrl || null);
    setShowModal(true);
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    if (!form.name || !form.phone) { addNotification('Name and phone are required.'); return; }
    const basePayload: Record<string, any> = {
      name: form.name, company_name: form.companyName, phone: form.phone,
      email: form.email || null, location: form.location || null,
      ghana_card_id: form.ghanaCard || null,
      house_address: form.houseAddress || null,
      company_address: form.companyAddress || null,
      gps_lat: gpsCoords?.lat ?? null,
      gps_lng: gpsCoords?.lng ?? null,
      ghana_card_id_2: form.ghanaCard2 || null,
      partner_name: form.partnerName || null,
      business_certificate_url: businessCertUrl || null,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    };
    // Editing a record Risk sent back for correction is the implicit
    // "resubmit" action — no separate button, fixing the field and saving
    // is what puts it back in Risk's queue.
    if (editTarget.status === 'RETURNED_FOR_CORRECTION') {
      basePayload.status = 'PENDING';
    }
    let { error } = await supabase.from('customers').update({ ...basePayload, is_special_customer: form.isSpecialCustomer }).eq('id', editTarget.id);
    if (error?.message?.includes('is_special_customer')) {
      // Column not migrated yet — don't let that block saving the rest of the edit.
      ({ error } = await supabase.from('customers').update(basePayload).eq('id', editTarget.id));
    }
    if (error) { addNotification(`Update failed: ${error.message}`); return; }
    setCustomers(prev => prev.map(c => c.id === editTarget.id ? {
      ...c, ...form, companyName: form.companyName,
      gpsLat: gpsCoords?.lat, gpsLng: gpsCoords?.lng,
      businessCertificateUrl: businessCertUrl || undefined,
      status: basePayload.status || c.status,
    } : c));
    if (selectedCustomer?.id === editTarget.id) {
      setSelectedCustomer(prev => prev ? {
        ...prev, ...form, companyName: form.companyName,
        gpsLat: gpsCoords?.lat, gpsLng: gpsCoords?.lng,
        businessCertificateUrl: businessCertUrl || undefined,
        status: basePayload.status || prev.status,
      } : prev);
    }
    setShowModal(false); setEditTarget(null);
    addNotification('Customer updated.');
  };

  // businessCertificateUrl/businessCertUrl now hold a private-bucket PATH,
  // not a directly-openable URL — a fresh signed URL is resolved on
  // demand each time "View Certificate" is clicked, matching the
  // chat-attachments precedent (never persisted, always re-minted).
  const viewBusinessCertificate = async (path: string) => {
    const url = await getSignedFileUrl('business-certificates', path);
    if (!url) { addNotification('Could not open certificate — it may have been removed.'); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const uploadCertificateFile = async (file: File) => {
    setUploadingCert(true);
    try {
      // Private bucket — stores the raw storage path, not a public URL.
      // businessCertUrl keeps its name for minimal diff even though it now
      // holds a path, matching the same cosmetic mismatch already accepted
      // for chat-attachments' own attachment_url column.
      const path = await uploadPrivateFile(file, 'business-certificates', editTarget?.id || `new-${Date.now()}`);
      if (!path) throw new Error('Upload failed.');
      setBusinessCertUrl(path);
      addNotification('Business certificate uploaded.');
    } catch (e: any) {
      addNotification(`Certificate upload failed: ${e.message || 'Unknown error'}`);
    } finally {
      setUploadingCert(false);
    }
  };

  const handleCertFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) uploadCertificateFile(file);
  };

  const startCertCamera = async () => {
    setIsCertCameraActive(true);
    setCertCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setCertCameraStream(stream);
    } catch (err: any) {
      setCertCameraError(err.message || 'Camera access is restricted by your browser permissions or environment.');
    }
  };

  useEffect(() => {
    if (isCertCameraActive && certCameraStream && certVideoRef.current) {
      certVideoRef.current.srcObject = certCameraStream;
      certVideoRef.current.play().catch(() => {});
    }
  }, [isCertCameraActive, certCameraStream]);

  const stopCertCamera = () => {
    if (certCameraStream) certCameraStream.getTracks().forEach(t => t.stop());
    setCertCameraStream(null);
    setIsCertCameraActive(false);
    setCertCameraError(null);
  };

  useEffect(() => {
    return () => { if (certCameraStream) certCameraStream.getTracks().forEach(t => t.stop()); };
  }, [certCameraStream]);

  const captureCertPhoto = () => {
    const video = certVideoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(async blob => {
      if (!blob) return;
      const file = new File([blob], `certificate-${Date.now()}.jpg`, { type: 'image/jpeg' });
      stopCertCamera();
      await uploadCertificateFile(file);
    }, 'image/jpeg', 0.85);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('customers').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) { addNotification(`Delete failed: ${error.message}`); return; }
    setCustomers(prev => prev.filter(c => c.id !== deleteTarget.id));
    if (selectedCustomer?.id === deleteTarget.id) setSelectedCustomer(null);
    setDeleteTarget(null);
    addNotification(`Customer "${deleteTarget.name}" deleted.`);
  };

  const handlePhotoUpload = async (file: File) => {
    if (!selectedCustomer) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadFile(file, 'customer-photos', selectedCustomer.id);
      if (!url) throw new Error('Upload failed.');
      const { error } = await supabase.from('customers').update({ customer_photo: url, updated_at: new Date().toISOString() }).eq('id', selectedCustomer.id);
      if (error) throw error;
      setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, photo: url } : c));
      setSelectedCustomer(prev => prev ? { ...prev, photo: url } : prev);
      addNotification(`Photo updated for ${selectedCustomer.name}.`);
    } catch (e: any) {
      addNotification(`Photo upload failed: ${e.message || 'Unknown error'}`);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const exportCustomerCSV = (c: Customer) => {
    const csv = `Name,Company,Phone,Email,Location,Ghana Card,Registered\n${c.name},${c.companyName || ''},${c.phone},${c.email || ''},${c.location || ''},${c.ghanaCard || ''},${(c.registeredAt || '').split('T')[0]}`;
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = `customer_${c.name.replace(/\s+/g,'_')}.csv`; a.click();
    addNotification(`Exported ${c.name}.`);
  };

  const exportAllCSV = () => {
    const rows = filtered.map(c => `${c.name},${c.companyName || ''},${c.phone},${c.email || ''},${c.location || ''},${(c.registeredAt || '').split('T')[0]}`);
    const csv = `Name,Company,Phone,Email,Location,Registered\n${rows.join('\n')}`;
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = 'customers.csv'; a.click();
    addNotification('All customers exported.');
  };

  if (selectedCustomer) {
    const custOrders = ordersForCustomer(orders, selectedCustomer.name);
    const totalSpend = custOrders.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + o.totalAmount, 0);
    // Real outstanding, matched the same way create_order_with_stock_check()
    // matches customers server-side (prefer customer_id, fall back to name).
    const outstanding = outstandingCreditFor(orders, selectedCustomer);
    const creditOrderRows = ordersForCustomerRow(orders, selectedCustomer)
      .filter(o => (o.paymentMode || '').toUpperCase() === 'CREDIT')
      .map(o => ({
        orderId: o.ticketNumber || o.id,
        amount: Math.max((o.totalAmount || 0) - (o.amountPaid || 0), 0),
        date: o.createdAt,
        status: (o.amountPaid || 0) >= (o.totalAmount || 0) ? 'PAID' : (o.amountPaid || 0) > 0 ? 'PART PAID' : 'UNPAID',
      }));
    const rating = computeCustomerRating(custOrders);
    return (
      <>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button onClick={() => setSelectedCustomer(null)} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> Back to Customers
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCustomerTimeline(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold hover:bg-[var(--accent-light)] hover:text-[var(--accent)] transition-colors cursor-pointer">
              <History className="w-3.5 h-3.5" /> Timeline
            </button>
            <button onClick={() => openEdit(selectedCustomer)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold hover:bg-[var(--accent-light)] hover:text-[var(--accent)] transition-colors cursor-pointer">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            <button onClick={() => exportCustomerCSV(selectedCustomer)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold hover:bg-[var(--accent-light)] hover:text-[var(--accent)] transition-colors cursor-pointer">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button onClick={() => setDeleteTarget(selectedCustomer)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 text-rose-500 text-xs font-semibold hover:bg-rose-50 transition-colors cursor-pointer">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-6 shadow-[var(--box-shadow)]">
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="relative inline-block cursor-pointer group" onClick={() => photoInputRef.current?.click()} title="Update photo">
                <CustomerAvatar name={selectedCustomer.name} photo={selectedCustomer.photo} isSpecial={selectedCustomer.isSpecialCustomer} size={72} rounded="full" />
                <div className="absolute inset-0 rounded-full bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-5 h-5 text-white" />
                </div>
                {uploadingPhoto && (
                  <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                    <span className="text-[8px] text-white font-semibold">Uploading…</span>
                  </div>
                )}
              </div>
              <span className="text-[9px] text-[var(--text-muted)]">Click to update</span>
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handlePhotoUpload(f); }} />
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 flex items-center gap-2 flex-wrap">
                {selectedCustomer.isSpecialCustomer && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    <Star size={9} className="fill-amber-500" /> Special Customer
                  </span>
                )}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${VERIFICATION_STYLES[selectedCustomer.status || 'PENDING']}`}>
                  {VERIFICATION_LABELS[selectedCustomer.status || 'PENDING']}
                </span>
                <RatingBadge rating={rating} />
                <span className="text-[10px] text-[var(--text-muted)]"><CountUp value={rating.orderCount} /> order{rating.orderCount === 1 ? '' : 's'} counted</span>
                {/* Read-only — only Risk can set credit terms (Customer Credit screen). */}
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-input)] text-[var(--text-secondary)]">
                  Credit: {selectedCustomer.creditLimit != null ? `GHS ${selectedCustomer.creditLimit.toLocaleString()} limit` : 'No limit set'} · GHS {outstanding.toLocaleString()} outstanding
                </span>
                {selectedCustomer.creditStatus === 'ON_HOLD' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">ON CREDIT HOLD</span>
                )}
              </div>
              {(selectedCustomer.status === 'REJECTED' || selectedCustomer.status === 'RETURNED_FOR_CORRECTION') && selectedCustomer.rejectionReason && (
                <div className="sm:col-span-2 p-2.5 rounded-xl bg-rose-500/5 border border-rose-500/10 text-xs text-rose-700">
                  <strong>Risk's reason:</strong> {selectedCustomer.rejectionReason}
                </div>
              )}
              {[
                ['Full Name', selectedCustomer.name],
                ['Company', selectedCustomer.companyName],
                ['Phone', selectedCustomer.phone],
                ['Email', selectedCustomer.email || '—'],
                ['Location', selectedCustomer.location],
                ['House Address', selectedCustomer.houseAddress || '—'],
                ['Company Address', selectedCustomer.companyAddress || '—'],
                ['Ghana Card', selectedCustomer.ghanaCard || '—'],
                ['Second Ghana Card', selectedCustomer.ghanaCard2 || '—'],
                ['Partner / Second Customer', selectedCustomer.partnerName || '—'],
                ['Registered', selectedCustomer.registeredAt.split('T')[0]],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-[var(--text-muted)]">{k}</p>
                  <p className="font-medium text-sm text-[var(--text-primary)]">{v}</p>
                </div>
              ))}
              {selectedCustomer.gpsLat != null && selectedCustomer.gpsLng != null && (
                <div>
                  <p className="text-xs text-[var(--text-muted)]">GPS Location</p>
                  <a
                    href={`https://www.google.com/maps?q=${selectedCustomer.gpsLat},${selectedCustomer.gpsLng}`}
                    target="_blank" rel="noreferrer"
                    className="font-medium text-sm text-[var(--accent)] hover:underline inline-flex items-center gap-1"
                  >
                    View on map <ExternalLink size={11} />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {selectedCustomer.notes && (
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 shadow-[var(--box-shadow)]">
            <h4 className="font-semibold text-sm text-[var(--text-primary)] mb-2">Notes</h4>
            <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{selectedCustomer.notes}</p>
          </div>
        )}

        {selectedCustomer.businessCertificateUrl && (
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 shadow-[var(--box-shadow)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[var(--accent)]" />
              <h4 className="font-semibold text-sm text-[var(--text-primary)]">Business Certificate</h4>
            </div>
            <button type="button" onClick={() => viewBusinessCertificate(selectedCustomer.businessCertificateUrl!)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold hover:bg-[var(--accent-light)] hover:text-[var(--accent)] transition-colors">
              View Certificate <ExternalLink size={12} />
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Orders', value: custOrders.length, color: 'text-[var(--text-primary)]' },
            { label: 'Total Spend (GHS)', value: totalSpend, color: 'text-emerald-600' },
            { label: 'Outstanding (GHS)', value: outstanding, color: 'text-rose-600' },
          ].map(c => (
            <div key={c.label} className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-4 shadow-[var(--box-shadow)]">
              <p className="text-xs text-[var(--text-muted)] mb-1">{c.label}</p>
              <p className={`text-xl font-bold ${c.color}`}><CountUp value={c.value} /></p>
            </div>
          ))}
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-4 shadow-[var(--box-shadow)]">
            <p className="text-xs text-[var(--text-muted)] mb-1">Rating — {rating.grade}</p>
            <p className="text-xl font-bold" style={{ color: rating.color }}><CountUp value={rating.score} /><span className="text-xs text-[var(--text-muted)] font-normal">/100</span></p>
            <p className="text-[9px] text-[var(--text-muted)] mt-1">Consistency {rating.consistencyScore} · Volume {rating.volumeScore}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 shadow-[var(--box-shadow)]">
          <h4 className="font-semibold text-sm text-[var(--text-primary)] mb-3">Order History</h4>
          {custOrders.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No orders found.</p>
          ) : (
            <ResponsiveDataView<typeof custOrders[number]>
              columns={[
                { key: 'productName', label: 'Product', primary: true, render: o => o.productName || '—' },
                { key: 'ticketNumber', label: 'Order #', render: o => <span className="font-mono text-xs">{o.ticketNumber || o.id}</span> },
                { key: 'totalAmount', label: 'Amount', render: o => <span className="text-emerald-600 font-semibold">GHS {o.totalAmount.toLocaleString()}</span> },
                { key: 'paymentMode', label: 'Payment' },
                {
                  key: 'status', label: 'Status', status: true, render: o => (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      o.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-700' :
                      o.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                      o.status === 'PROCESSING' ? 'bg-indigo-100 text-indigo-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>{o.status}</span>
                  )
                },
                { key: 'createdAt', label: 'Date', render: o => o.createdAt.split('T')[0] },
              ]}
              data={custOrders}
              rowKey={o => o.id}
            />
          )}
        </div>

        {creditOrderRows.length > 0 && (
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 shadow-[var(--box-shadow)]">
            <h4 className="font-semibold text-sm text-[var(--text-primary)] mb-3">Credit / Payment History</h4>
            <ResponsiveDataView<typeof creditOrderRows[number]>
              columns={[
                { key: 'orderId', label: 'Order ID', primary: true, render: h => <span className="font-mono text-xs">{h.orderId}</span> },
                { key: 'amount', label: 'Amount Due (GHS)', render: h => <span className="text-emerald-600 font-semibold">GHS {h.amount.toLocaleString()}</span> },
                { key: 'date', label: 'Date', render: h => (h.date || '').split('T')[0] },
                {
                  key: 'status', label: 'Status', status: true, render: h => (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      h.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                      h.status === 'PART PAID' ? 'bg-amber-100 text-amber-700' :
                      'bg-rose-100 text-rose-700'
                    }`}>{h.status}</span>
                  )
                },
              ]}
              data={creditOrderRows}
              rowKey={h => `${h.orderId}-${h.date}`}
            />
          </div>
        )}
      </div>
      <RequestTimelinePanel
        open={showCustomerTimeline}
        onClose={() => setShowCustomerTimeline(false)}
        referenceId={selectedCustomer.id}
        displayId={selectedCustomer.name}
      />
      </>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Customer Directory</h2>
          <p className="text-xs text-[var(--text-muted)]">{customers.length} registered customers</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportAllCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold rounded-xl cursor-pointer hover:bg-[var(--accent-light)]">
            <Download className="w-3.5 h-3.5" /> Export All
          </button>
          <button onClick={() => { setEditTarget(null); resetForm(); setShowModal(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90">
            <Plus className="w-3.5 h-3.5" /> Add Customer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Customers', value: customers.length, prefix: '', color: 'text-[var(--text-primary)]' },
          { label: 'Active (with Orders)', value: withOrders, prefix: '', color: 'text-emerald-600' },
          { label: 'New This Month', value: thisMonth, prefix: '', color: 'text-blue-600' },
          { label: 'Credit Outstanding', value: totalCredit, prefix: 'GHS ', color: 'text-rose-600' },
        ].map(c => (
          <div key={c.label} className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-4 shadow-[var(--box-shadow)]">
            <p className="text-xs text-[var(--text-muted)] mb-1">{c.label}</p>
            <p className={`text-xl font-bold ${c.color}`}><CountUp value={c.value} prefix={c.prefix} /></p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, company, phone…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <SearchableDropdown
          value={locationFilter}
          onChange={setLocationFilter}
          options={[{ value: 'ALL', label: 'All Locations' }, ...locations.map(l => ({ value: l, label: l }))]}
          className="sm:w-48"
        />
      </div>

      {loading ? (
        <div className="text-center py-16 text-[var(--text-muted)] text-sm">Loading customers…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)] text-sm">No customers found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filtered.map(c => {
            const custOrders = ordersForCustomer(orders, c.name);
            const rating = computeCustomerRating(custOrders);
            return (
              <div key={c.id} className="group rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-4 shadow-[var(--box-shadow)] flex flex-col gap-2.5 hover:border-[var(--accent)] hover:shadow-lg transition-all">
                <div className="flex items-center gap-2.5">
                  <button onClick={() => setSelectedCustomer(c)} title="View profile" className="cursor-pointer shrink-0">
                    <CustomerAvatar name={c.name} photo={c.photo} isSpecial={c.isSpecialCustomer} size={40} rounded="full" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      <p className="font-semibold text-sm text-[var(--text-primary)] truncate">{c.name}</p>
                      {c.isSpecialCustomer && <Star size={9} className="fill-amber-500 text-amber-500 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] truncate">{c.companyName || c.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <RatingBadge rating={rating} size="xs" />
                  <span className="text-[10px] font-semibold text-[var(--text-secondary)] bg-[var(--bg-input)] px-1.5 py-0.5 rounded-full">
                    {custOrders.length} order{custOrders.length === 1 ? '' : 's'}
                  </span>
                  {!!c.discountPercent && <span className="text-[10px] font-semibold text-emerald-600">{c.discountPercent}% off</span>}
                </div>
                <button onClick={() => setSelectedCustomer(c)}
                  className="w-full py-1.5 rounded-xl border border-[var(--accent)] text-[var(--accent)] text-xs font-semibold hover:bg-[var(--accent-light)] transition-colors cursor-pointer">
                  View Profile
                </button>
              </div>
            );
          })}
        </div>
      )}

      <SidePanel
        open={showModal}
        onClose={() => { setShowModal(false); setEditTarget(null); }}
        title={editTarget ? 'Edit Customer' : 'Register New Customer'}
        footer={
          <>
            <button onClick={() => { setShowModal(false); setEditTarget(null); }} className="erp-btn erp-btn-ghost">Cancel</button>
            <button onClick={editTarget ? handleEditSave : handleSave} className="erp-btn erp-btn-primary">
              {editTarget ? 'Save Changes' : 'Register'}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {[
            { label: 'Full Name *', key: 'name', placeholder: 'E.g., Kofi Owusu' },
            { label: 'Company Name', key: 'companyName', placeholder: 'E.g., Owusu Retail Hub' },
            { label: 'Phone *', key: 'phone', placeholder: 'E.g., +233 24 123 4567' },
            { label: 'Location', key: 'location', placeholder: 'E.g., Kumasi' },
            { label: 'Email', key: 'email', placeholder: 'client@company.com' },
            { label: 'Ghana Card', key: 'ghanaCard', placeholder: 'E.g., GHA-721839210-9' },
            { label: 'Second Ghana Card', key: 'ghanaCard2', placeholder: 'E.g., GHA-901234567-1' },
            { label: 'Partner / Second Customer Name', key: 'partnerName', placeholder: 'E.g., Ama Boateng' },
            { label: 'House / Residential Address', key: 'houseAddress', placeholder: 'E.g., House No. 12, East Legon' },
            { label: 'Company Address', key: 'companyAddress', placeholder: 'E.g., Plot 4, Spintex Road' },
          ].map(f => (
            <div key={f.key} className="erp-form-group">
              <label className="erp-label">{f.label}</label>
              <input value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="erp-input" />
            </div>
          ))}

          <div className="erp-form-group">
            <label className="erp-label">GPS Location</label>
            <DestinationLocator
              value={gpsAddressText}
              onChange={setGpsAddressText}
              onResolve={setGpsCoords}
              placeholder="Search an address or drop a pin"
            />
            {gpsCoords && <p className="text-[10px] text-[var(--text-muted)] mt-1">Pinned: {gpsCoords.lat.toFixed(5)}, {gpsCoords.lng.toFixed(5)}</p>}
          </div>

          <div className="erp-form-group">
            <label className="erp-label">Business Certificate</label>
            {businessCertUrl ? (
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)]">
                <span className="flex items-center gap-1.5 text-xs text-[var(--text-primary)] truncate"><FileText size={13} className="text-[var(--accent)] shrink-0" /> Certificate uploaded</span>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={() => viewBusinessCertificate(businessCertUrl)} className="text-[10px] font-semibold text-[var(--accent)] hover:underline">View</button>
                  <button type="button" onClick={() => setBusinessCertUrl(null)} className="text-[10px] font-semibold text-rose-500 hover:underline cursor-pointer">Remove</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button type="button" onClick={hasGetUserMedia ? startCertCamera : () => certFileInputRef.current?.click()}
                  disabled={uploadingCert}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold rounded-xl cursor-pointer hover:bg-[var(--accent-light)] disabled:opacity-60">
                  {uploadingCert ? 'Uploading…' : hasGetUserMedia ? <><Camera size={13} /> Take Photo</> : <><Upload size={13} /> Upload</>}
                </button>
                {hasGetUserMedia && (
                  <button type="button" onClick={() => certFileInputRef.current?.click()} disabled={uploadingCert}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold rounded-xl cursor-pointer hover:bg-[var(--accent-light)] disabled:opacity-60">
                    <Upload size={13} /> Upload File
                  </button>
                )}
              </div>
            )}
            <input ref={certFileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleCertFileChange} />
          </div>

          <div className="erp-form-group">
            <label className="erp-label">Customer Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any notes for Risk or Marketing to see later..."
              rows={3}
              className="erp-input resize-none"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
            <input type="checkbox" checked={form.isSpecialCustomer} onChange={e => setForm(prev => ({ ...prev, isSpecialCustomer: e.target.checked }))}
              className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer" />
            Special customer <span className="text-xs text-[var(--text-muted)]">(flag for Management's attention. Management sets any discount separately)</span>
          </label>

          {!editTarget && (
            <p className="text-[10px] text-[var(--text-muted)] -mt-1">New customers are submitted to Risk for verification before showing as "Verified".</p>
          )}
        </div>
      </SidePanel>

      {/* Business certificate live camera capture */}
      <SidePanel
        open={isCertCameraActive}
        onClose={stopCertCamera}
        title="Capture Business Certificate"
      >
        <div className="-mx-5 -my-4 flex flex-col">
          {certCameraError ? (
            <div className="p-6 text-center space-y-4 flex flex-col items-center justify-center min-h-[220px]">
              <AlertTriangle className="w-12 h-12 text-amber-500" />
              <p className="text-[11px] text-[var(--text-secondary)] max-w-[260px] mx-auto leading-relaxed">Live camera is blocked by browser permissions or environment settings.</p>
              <div className="flex flex-col gap-2 w-full pt-2">
                <button type="button" onClick={() => { stopCertCamera(); certFileInputRef.current?.click(); }}
                  className="w-full py-2.5 bg-[var(--accent)] text-white text-xs font-bold rounded-xl cursor-pointer">Upload File Instead</button>
                <button type="button" onClick={stopCertCamera} className="w-full py-2 border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold rounded-xl cursor-pointer">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                <video ref={certVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              </div>
              <div className="p-4 flex gap-3 justify-end bg-[var(--bg)]">
                <button type="button" onClick={stopCertCamera} className="px-4 py-2 border border-[var(--border)] text-xs font-semibold rounded-xl text-[var(--text-secondary)] cursor-pointer">Cancel</button>
                <button type="button" onClick={captureCertPhoto} disabled={uploadingCert}
                  className="px-4 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 disabled:opacity-50">
                  <Camera className="w-3.5 h-3.5" /> {uploadingCert ? 'Uploading...' : 'Capture & Upload'}
                </button>
              </div>
            </>
          )}
        </div>
      </SidePanel>

      <SidePanel
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Customer"
        subtitle="This cannot be undone."
        footer={
          <>
            <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="erp-btn erp-btn-ghost disabled:opacity-50">Cancel</button>
            <button onClick={handleDelete} disabled={deleting} className="erp-btn erp-btn-danger disabled:opacity-50">
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </>
        }
      >
        {deleteTarget && (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0"><Trash2 className="w-5 h-5 text-rose-500" /></div>
            <p className="text-sm text-[var(--text-secondary)] pt-2">Delete <strong>{deleteTarget.name}</strong> and all their records from the directory?</p>
          </div>
        )}
      </SidePanel>
    </div>
  );
}
