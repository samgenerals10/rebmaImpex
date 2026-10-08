// rebma-web/src/views/dispatch/ScannerView.tsx
//
// Validates a Waybill's QR code. Genuinely new — confirmed nothing in this
// app has ever decoded a QR/barcode before (they're only ever generated for
// printing). Uses the same getUserMedia + <video> + <canvas> camera pattern
// already established in ProofOfDeliveryView.tsx/StockIntakeForm.tsx, just
// run continuously via requestAnimationFrame + jsQR() instead of a single
// still capture. A manual "or type it" field sits alongside the camera at
// all times, not just as a camera-blocked fallback — a torn/unreadable
// label shouldn't be a dead end.
import { useState, useRef, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import { QrCode, Camera, AlertTriangle, CheckCircle, XCircle, Search, RefreshCw, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { readScannedCode, notADeliveryPaper } from '../../utils/scanCode';

interface Props {
  addNotification?: (msg: string) => void;
}

interface WaybillResult {
  waybillNumber: string;
  containerNumber: string | null;
  createdAt: string;
  order: { clientName: string; destination: string; status: string; ticketNumber: string } | null;
  delivery: { vehicleId: string; driverName: string; status: string } | null;
  /** Shown when the scan was an older dispatch ticket rather than a waybill. */
  note?: string;
  /** When Risk cleared this waybill for dispatch (drivers can't start before). */
  scannedAt?: string | null;
  scannedBy?: string | null;
}

export default function ScannerView({ addNotification }: Props) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const [hasGetUserMedia] = useState(() => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));

  const [manualEntry, setManualEntry] = useState('');
  const [looking, setLooking] = useState(false);
  const [result, setResult] = useState<WaybillResult | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null); // a readable reason the lookup failed

  // Load the order and delivery that go with a waybill row.
  const describeWaybill = async (wb: any, note?: string): Promise<WaybillResult> => {
    let order: WaybillResult['order'] = null;
    let delivery: WaybillResult['delivery'] = null;
    if (wb.order_id) {
      const { data: oRows } = await supabase.from('orders').select('client_name, destination, status, ticket_number').eq('id', wb.order_id).limit(1);
      if (oRows?.[0]) order = { clientName: oRows[0].client_name, destination: oRows[0].destination, status: oRows[0].status, ticketNumber: oRows[0].ticket_number };
    }
    if (wb.delivery_log_id) {
      const { data: dRows } = await supabase.from('delivery_logs').select('vehicle_id, driver_name, status').eq('id', wb.delivery_log_id).limit(1);
      if (dRows?.[0]) delivery = { vehicleId: dRows[0].vehicle_id, driverName: dRows[0].driver_name, status: dRows[0].status };
    }
    return { waybillNumber: wb.waybill_number, containerNumber: wb.container_number, createdAt: wb.created_at, order, delivery, note, scannedAt: wb.scanned_at || null, scannedBy: wb.scanned_by || null };
  };

  // Risk's gate, same as the phone Scanner: goods can't leave until Risk
  // has scanned the waybill and cleared it. The driver's screen waits for
  // this (waybills.scanned_at) before a trip can start.
  const [clearing, setClearing] = useState(false);
  const confirmClearance = async () => {
    if (!result || !result.createdAt) return;
    setClearing(true);
    let who = 'Risk';
    try {
      const { data: u } = await supabase.auth.getUser();
      if (u.user?.id) {
        const { data: p } = await supabase.from('profiles').select('full_name').eq('id', u.user.id).maybeSingle();
        if (p?.full_name) who = p.full_name;
      }
    } catch { /* keep the default name */ }
    const now = new Date().toISOString();
    const { error } = await supabase.from('waybills').update({ scanned_at: now, scanned_by: who }).eq('waybill_number', result.waybillNumber);
    setClearing(false);
    if (error) { addNotification?.(`Could not clear the waybill: ${error.message}`); return; }
    setResult({ ...result, scannedAt: now, scannedBy: who });
    addNotification?.(`${result.waybillNumber} is cleared for dispatch. The driver can start the trip.`);
  };

  // Accepts a waybill code, an older dispatch ticket (found by its ticket
  // number), or anything typed by hand.
  const lookupWaybill = useCallback(async (raw: string) => {
    if (!raw || !raw.trim()) return;
    setLooking(true);
    setResult(null);
    setNotFound(null);
    try {
      const code = readScannedCode(raw);
      const wrongPaper = notADeliveryPaper(code);
      if (wrongPaper) { setNotFound(wrongPaper); return; }

      if (code.kind === 'waybill') {
        const { data: rows } = await supabase.from('waybills').select('*').eq('waybill_number', code.waybillNumber.trim()).limit(1);
        if (!rows?.[0]) { setNotFound(`Waybill ${code.waybillNumber} isn't on record. Double-check the number, or the code may have been tampered with.`); return; }
        const res = await describeWaybill(rows[0]);
        setResult(res);
        addNotification?.(`Waybill ${res.waybillNumber} verified.`);
        return;
      }

      if (code.kind === 'ticket') {
        const { data: oRows } = await supabase.from('orders').select('id, client_name, destination, status, ticket_number').eq('ticket_number', code.ticketNumber).limit(1);
        const o = oRows?.[0];
        if (!o) { setNotFound(`Dispatch ticket ${code.ticketNumber} doesn't match any order on record.`); return; }
        const { data: wRows } = await supabase.from('waybills').select('*').eq('order_id', o.id).order('created_at', { ascending: false }).limit(1);
        if (wRows?.[0]) {
          const res = await describeWaybill(wRows[0], `Found from older dispatch ticket ${code.ticketNumber}. Reprint the waybill for this order.`);
          setResult(res);
          addNotification?.(`Waybill ${res.waybillNumber} found from ticket ${code.ticketNumber}.`);
          return;
        }
        // The order is real but no waybill has been printed for it yet.
        const { data: dRows } = await supabase.from('delivery_logs').select('vehicle_id, driver_name, status').eq('order_id', o.id).order('created_at', { ascending: false }).limit(1);
        setResult({
          waybillNumber: 'Not printed yet',
          containerNumber: null,
          createdAt: '',
          order: { clientName: o.client_name, destination: o.destination, status: o.status, ticketNumber: o.ticket_number },
          delivery: dRows?.[0] ? { vehicleId: dRows[0].vehicle_id, driverName: dRows[0].driver_name, status: dRows[0].status } : null,
          note: `Older dispatch ticket ${code.ticketNumber}. This order has no waybill yet, so print one before the goods leave.`,
        });
      }
    } catch (e) {
      console.error(e);
      setNotFound('Could not check that code right now. Please try again.');
    } finally {
      setLooking(false);
    }
  }, [addNotification]);

  const startCamera = async () => {
    setIsCameraActive(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setCameraStream(stream);
    } catch (err: any) {
      setCameraError(err.message || 'Camera access is restricted by your browser permissions or environment.');
    }
  };

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
    setCameraStream(null);
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); if (cameraStream) cameraStream.getTracks().forEach(t => t.stop()); };
  }, [cameraStream]);

  // Continuous decode loop — attach the stream to the video, then scan every
  // frame until a QR code decodes or the camera is stopped.
  useEffect(() => {
    if (!isCameraActive || !cameraStream || !videoRef.current) return;
    const video = videoRef.current;
    video.srcObject = cameraStream;
    video.play().catch(() => {});

    const tick = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA && canvasRef.current) {
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
          if (code && code.data) {
            stopCamera();
            lookupWaybill(code.data);
            return;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCameraActive, cameraStream]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2"><QrCode size={22} /> Waybill Scanner</h1>
        <p className="text-sm text-[var(--text-secondary)]">Scan a waybill's QR code, or type its number, to validate it</p>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
        {isCameraActive ? (
          cameraError ? (
            <div className="p-8 text-center space-y-3 flex flex-col items-center">
              <AlertTriangle className="w-10 h-10 text-amber-500" />
              <p className="text-sm text-[var(--text-secondary)] max-w-xs">Live camera is blocked by browser permissions or environment settings. Use the manual entry field below instead.</p>
              <button onClick={stopCamera} className="px-4 py-2 border border-[var(--border)] text-xs font-semibold rounded-xl text-[var(--text-secondary)] cursor-pointer">Close Camera</button>
            </div>
          ) : (
            <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-56 h-56 border-2 border-white/70 rounded-2xl overflow-hidden">
                  {/* Laser line sweeping up and down while the camera scans */}
                  <div className="scanner-laser" />
                </div>
              </div>
              <button onClick={stopCamera} className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/60 text-white text-xs font-semibold rounded-lg cursor-pointer">Stop</button>
            </div>
          )
        ) : (
          <button onClick={hasGetUserMedia ? startCamera : () => setCameraError('Camera not available in this browser.')}
            className="w-full flex flex-col items-center justify-center gap-2 py-12 text-[var(--text-secondary)] hover:bg-[var(--accent-light)] transition-colors cursor-pointer">
            <Camera size={28} />
            <span className="text-sm font-semibold">Tap to Start Scanning</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-[var(--border)]" />
        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">or enter manually</span>
        <div className="flex-1 h-px bg-[var(--border)]" />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={manualEntry}
            onChange={e => setManualEntry(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') lookupWaybill(manualEntry); }}
            placeholder="Waybill or ticket number, e.g. WB-000123"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <button onClick={() => lookupWaybill(manualEntry)} disabled={looking || !manualEntry.trim()}
          className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 cursor-pointer" style={{ background: 'var(--accent)' }}>
          {looking ? <RefreshCw size={14} className="animate-spin" /> : 'Validate'}
        </button>
      </div>

      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm"><CheckCircle size={18} /> {result.createdAt ? 'Valid Waybill' : 'Order Found'}</div>
          {result.note && <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{result.note}</p>}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-emerald-600/70">Waybill No.</span><p className="font-mono font-bold text-emerald-800">{result.waybillNumber}</p></div>
            <div><span className="text-emerald-600/70">Container No.</span><p className="font-semibold text-emerald-800">{result.containerNumber || 'Not set'}</p></div>
            {result.order && <>
              <div><span className="text-emerald-600/70">Customer</span><p className="font-semibold text-emerald-800">{result.order.clientName}</p></div>
              <div><span className="text-emerald-600/70">Destination</span><p className="font-semibold text-emerald-800">{result.order.destination}</p></div>
              <div><span className="text-emerald-600/70">Order Status</span><p className="font-semibold text-emerald-800">{result.order.status?.replace(/_/g, ' ')}</p></div>
            </>}
            {result.delivery && <>
              <div><span className="text-emerald-600/70">Vehicle</span><p className="font-semibold text-emerald-800">{result.delivery.vehicleId || 'Not set'}</p></div>
              <div><span className="text-emerald-600/70">Driver</span><p className="font-semibold text-emerald-800">{result.delivery.driverName || 'Not set'}</p></div>
              <div><span className="text-emerald-600/70">Delivery Status</span><p className="font-semibold text-emerald-800">{result.delivery.status?.replace(/_/g, ' ')}</p></div>
            </>}
          </div>
          <div className="pt-3 border-t border-emerald-200">
            {!result.createdAt ? (
              <p className="text-xs text-emerald-800">Print the waybill for this order first. It can be cleared for dispatch once it has one.</p>
            ) : result.scannedAt ? (
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-emerald-700">Cleared for Dispatch</p>
                  <p className="text-[11px] text-emerald-700/80">By {result.scannedBy || 'Risk'}, {new Date(result.scannedAt).toLocaleString()}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-emerald-800">Not yet cleared. The driver can't start this trip until you confirm it here.</p>
                <button onClick={confirmClearance} disabled={clearing}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-60 cursor-pointer">
                  <ShieldCheck size={14} /> {clearing ? 'Clearing...' : 'Confirm and Clear for Dispatch'}
                </button>
              </div>
            )}
          </div>
          <button onClick={() => { setResult(null); setManualEntry(''); }} className="text-xs font-semibold text-emerald-700 underline cursor-pointer">Scan Another</button>
        </div>
      )}

      {notFound && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-rose-700 font-bold text-sm"><XCircle size={18} /> Not Found / Invalid Code</div>
          <p className="text-xs text-rose-600">{notFound}</p>
          <button onClick={() => { setNotFound(null); setManualEntry(''); }} className="text-xs font-semibold text-rose-700 underline cursor-pointer">Try Again</button>
        </div>
      )}
    </div>
  );
}
