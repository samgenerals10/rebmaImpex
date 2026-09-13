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
import { QrCode, Camera, AlertTriangle, CheckCircle, XCircle, Search, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface Props {
  addNotification?: (msg: string) => void;
}

interface WaybillResult {
  waybillNumber: string;
  containerNumber: string | null;
  createdAt: string;
  order: { clientName: string; destination: string; status: string; ticketNumber: string } | null;
  delivery: { vehicleId: string; driverName: string; status: string } | null;
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
  const [notFound, setNotFound] = useState<string | null>(null); // holds the value that failed to look up

  const lookupWaybill = useCallback(async (waybillNumber: string) => {
    if (!waybillNumber) return;
    setLooking(true);
    setResult(null);
    setNotFound(null);
    try {
      const { data: rows } = await supabase.from('waybills').select('*').eq('waybill_number', waybillNumber.trim()).limit(1);
      const wb = rows?.[0];
      if (!wb) {
        setNotFound(waybillNumber);
        return;
      }
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
      setResult({ waybillNumber: wb.waybill_number, containerNumber: wb.container_number, createdAt: wb.created_at, order, delivery });
      addNotification?.(`Waybill ${wb.waybill_number} verified.`);
    } catch (e) {
      console.error(e);
      setNotFound(waybillNumber);
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
            let waybillNumber = code.data;
            try {
              const parsed = JSON.parse(code.data);
              if (parsed && parsed.waybillNumber) waybillNumber = parsed.waybillNumber;
            } catch { /* not JSON — treat the raw scanned text as the waybill number */ }
            stopCamera();
            lookupWaybill(waybillNumber);
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
                <div className="w-56 h-56 border-2 border-white/70 rounded-2xl" />
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
            placeholder="e.g. WB-000123"
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
          <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm"><CheckCircle size={18} /> Valid Waybill</div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-emerald-600/70">Waybill No.</span><p className="font-mono font-bold text-emerald-800">{result.waybillNumber}</p></div>
            <div><span className="text-emerald-600/70">Container No.</span><p className="font-semibold text-emerald-800">{result.containerNumber || '—'}</p></div>
            {result.order && <>
              <div><span className="text-emerald-600/70">Customer</span><p className="font-semibold text-emerald-800">{result.order.clientName}</p></div>
              <div><span className="text-emerald-600/70">Destination</span><p className="font-semibold text-emerald-800">{result.order.destination}</p></div>
              <div><span className="text-emerald-600/70">Order Status</span><p className="font-semibold text-emerald-800">{result.order.status?.replace(/_/g, ' ')}</p></div>
            </>}
            {result.delivery && <>
              <div><span className="text-emerald-600/70">Vehicle</span><p className="font-semibold text-emerald-800">{result.delivery.vehicleId || '—'}</p></div>
              <div><span className="text-emerald-600/70">Driver</span><p className="font-semibold text-emerald-800">{result.delivery.driverName || '—'}</p></div>
              <div><span className="text-emerald-600/70">Delivery Status</span><p className="font-semibold text-emerald-800">{result.delivery.status?.replace(/_/g, ' ')}</p></div>
            </>}
          </div>
          <button onClick={() => { setResult(null); setManualEntry(''); }} className="text-xs font-semibold text-emerald-700 underline cursor-pointer">Scan Another</button>
        </div>
      )}

      {notFound && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-rose-700 font-bold text-sm"><XCircle size={18} /> Not Found / Invalid Code</div>
          <p className="text-xs text-rose-600">"{notFound}" doesn't match any waybill on record. Double-check the number, or the code may have been tampered with.</p>
          <button onClick={() => { setNotFound(null); setManualEntry(''); }} className="text-xs font-semibold text-rose-700 underline cursor-pointer">Try Again</button>
        </div>
      )}
    </div>
  );
}
