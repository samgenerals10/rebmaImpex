// rebma-mobile/screens/adminWarehouse/ScannerScreen.tsx
// Ports: rebma-web/src/views/dispatch/ScannerView.tsx — live QR decode +
// manual entry fallback + result card. Web decodes frames itself via
// `jsQR` running in a requestAnimationFrame loop over a <canvas>;
// `expo-camera`'s CameraView has native barcode detection built in, so
// this is simpler than a straight port, not a gap. The QR payload is
// `{ waybillNumber, orderId, containerNumber }` JSON (Phase 4,
// ApprovedGoodsView.tsx's printWaybill()) — parsed here the same way.
import { useCallback, useRef, useState } from 'react';
import { View, Text, Image } from 'react-native';
import { Alert } from '../../lib/appAlert';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { QrCode, CircleCheckBig, CircleX, ShieldCheck, PackageSearch } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import { lookupProductBarcode, type ProductLookupResult } from '../../lib/barcodeLookup';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

interface WaybillResult {
  waybillNumber: string;
  containerNumber: string | null;
  clientName: string | null;
  destination: string | null;
  vehicleId: string | null;
  driverName: string | null;
  status: string | null;
  scannedAt: string | null;
  scannedBy: string | null;
}

export default function ScannerScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualNumber, setManualNumber] = useState('');
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState<WaybillResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [looking, setLooking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // A code that isn't a REBMA waybill falls back to an external product
  // lookup, but only when Control Center's api_key_scanner_lookup is
  // actually set (lookupProductBarcode itself returns null with no
  // network call when it's empty) — see lib/barcodeLookup.ts.
  const [productResult, setProductResult] = useState<ProductLookupResult | null>(null);
  const [lookingProduct, setLookingProduct] = useState(false);
  const lastScanned = useRef<string | null>(null);

  const lookupWaybill = useCallback(async (waybillNumber: string) => {
    setLooking(true);
    setNotFound(false);
    setResult(null);
    const { data: wb } = await supabase.from('waybills').select('waybill_number, container_number, order_id, delivery_log_id, scanned_at, scanned_by').eq('waybill_number', waybillNumber).maybeSingle();
    if (!wb) {
      setLooking(false);
      setNotFound(true);
      return;
    }
    const [orderRes, deliveryRes] = await Promise.all([
      wb.order_id ? supabase.from('orders').select('client_name, destination').eq('id', wb.order_id).maybeSingle() : Promise.resolve({ data: null }),
      wb.delivery_log_id ? supabase.from('delivery_logs').select('vehicle_id, driver_name, status').eq('id', wb.delivery_log_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setLooking(false);
    setResult({
      waybillNumber: wb.waybill_number,
      containerNumber: wb.container_number,
      clientName: orderRes.data?.client_name || null,
      destination: orderRes.data?.destination || null,
      vehicleId: deliveryRes.data?.vehicle_id || null,
      driverName: deliveryRes.data?.driver_name || null,
      status: deliveryRes.data?.status || null,
      scannedAt: wb.scanned_at || null,
      scannedBy: wb.scanned_by || null,
    });
  }, []);

  // The physical control the user asked for: goods can't leave until Risk
  // has scanned the waybill and explicitly cleared it. This is the write
  // that turns a lookup into a real gate — DispatchHomeScreen checks
  // exactly this column before letting a driver start sharing location.
  const confirmClearance = useCallback(async () => {
    if (!result) return;
    setConfirming(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('waybills')
      .update({ scanned_at: now, scanned_by: profile?.fullName || 'Risk' })
      .eq('waybill_number', result.waybillNumber);
    setConfirming(false);
    if (error) {
      Alert.alert('Could Not Clear Waybill', error.message);
      return;
    }
    setResult({ ...result, scannedAt: now, scannedBy: profile?.fullName || 'Risk' });
    Alert.alert('Cleared for Dispatch', `${result.waybillNumber} is now cleared. The driver can start their trip.`);
  }, [result, profile?.fullName]);

  const tryProductLookup = useCallback(async (code: string) => {
    setLookingProduct(true);
    setProductResult(null);
    const product = await lookupProductBarcode(code);
    setLookingProduct(false);
    if (product) {
      setProductResult(product);
    } else {
      // Either no key is configured (lookupProductBarcode returns null
      // instantly, no request made) or the external database genuinely
      // has nothing for this code — same "not a REBMA waybill" message
      // either way, since the person scanning doesn't need to know which.
      Alert.alert('Unrecognized Code', 'This is not a REBMA waybill, and no product match was found.');
      setScanning(true);
      lastScanned.current = null;
    }
  }, []);

  const onBarcodeScanned = useCallback((event: { data: string }) => {
    if (event.data === lastScanned.current) return;
    lastScanned.current = event.data;
    setScanning(false);
    try {
      const parsed = JSON.parse(event.data);
      if (!parsed.waybillNumber) throw new Error('No waybill number in code.');
      lookupWaybill(parsed.waybillNumber);
    } catch {
      tryProductLookup(event.data);
    }
  }, [lookupWaybill, tryProductLookup]);

  const requestCamera = async () => {
    const res = await requestPermission();
    if (!res.granted) {
      Alert.alert('Camera Permission Needed', 'Enable camera access in your device settings to scan a waybill.');
    }
  };

  const resetScan = () => {
    setResult(null);
    setNotFound(false);
    setProductResult(null);
    lastScanned.current = null;
    setScanning(true);
  };

  return (
    <Screen>
      <View style={{ gap: t.spacing.lg }}>
        <View style={{ height: 320, borderRadius: t.radius.card, overflow: 'hidden', backgroundColor: '#000' }}>
          {permission?.granted ? (
            scanning ? (
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                // REBMA waybills are always 'qr'. The rest are real 1D
                // product-barcode formats — widened so a scanned product
                // package can actually reach tryProductLookup() below;
                // with 'qr' only (the old setting), the camera would
                // never even recognize a UPC/EAN code as a barcode at
                // all, so the lookup key could never be exercised no
                // matter how it was wired.
                barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] }}
                onBarcodeScanned={onBarcodeScanned}
              />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Button label="Scan Again" onPress={resetScan} />
              </View>
            )
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing.md, padding: t.spacing.xl }}>
              <QrCode size={32} color="#94a3b8" />
              <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: '#e2e8f0', textAlign: 'center' }}>
                Camera access is needed to scan a waybill QR code.
              </Text>
              <Button label="Enable Camera" onPress={requestCamera} size="sm" />
            </View>
          )}
        </View>

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary, marginBottom: t.spacing.sm }}>
            Or enter the Waybill Number manually
          </Text>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Input value={manualNumber} onChangeText={setManualNumber} placeholder="E.g., WB-000123" autoCapitalize="characters" />
            </View>
            <Button label="Look Up" onPress={() => manualNumber.trim() && lookupWaybill(manualNumber.trim())} loading={looking} disabled={looking || !manualNumber.trim()} />
          </View>
        </Card>

        {looking && (
          <Card>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center' }}>Looking up waybill…</Text>
          </Card>
        )}

        {notFound && (
          <Card>
            <View style={{ alignItems: 'center', gap: t.spacing.sm }}>
              <CircleX size={28} color={t.colors.status.danger.text} />
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.status.danger.text }}>Not Found</Text>
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center' }}>No waybill matches that number.</Text>
            </View>
          </Card>
        )}

        {result && (
          <Card style={{ borderColor: t.colors.status.success.text }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.md }}>
              <CircleCheckBig size={20} color={t.colors.status.success.text} />
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.status.success.text }}>Valid Waybill</Text>
            </View>
            <DetailRow label="Waybill" value={result.waybillNumber} />
            <DetailRow label="Container" value={result.containerNumber || '—'} />
            <DetailRow label="Client" value={result.clientName || '—'} />
            <DetailRow label="Destination" value={result.destination || '—'} />
            <DetailRow label="Vehicle" value={result.vehicleId || '—'} />
            <DetailRow label="Driver" value={result.driverName || '—'} />
            {result.status && <View style={{ marginTop: t.spacing.sm }}><Badge tone="info" label={result.status.replace(/_/g, ' ')} /></View>}

            <View style={{ marginTop: t.spacing.md, paddingTop: t.spacing.md, borderTopWidth: 1, borderTopColor: t.colors.border }}>
              {result.scannedAt ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
                  <ShieldCheck size={18} color={t.colors.status.success.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.status.success.text }}>Cleared for Dispatch</Text>
                    <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 2 }}>
                      By {result.scannedBy || 'Risk'} · {new Date(result.scannedAt).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ) : (
                <View>
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted, marginBottom: t.spacing.sm }}>
                    Not yet cleared. The driver can't start this trip until you confirm it here.
                  </Text>
                  <Button
                    label={confirming ? 'Clearing…' : 'Confirm & Clear for Dispatch'}
                    onPress={confirmClearance}
                    loading={confirming}
                    disabled={confirming}
                    fullWidth
                    icon={<ShieldCheck size={14} color="#fff" />}
                  />
                </View>
              )}
            </View>
          </Card>
        )}

        {lookingProduct && (
          <Card>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center' }}>Looking up product…</Text>
          </Card>
        )}

        {productResult && (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.md }}>
              <PackageSearch size={20} color={t.colors.accent} />
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>Product Match</Text>
            </View>
            {productResult.imageUrl && (
              <Image source={{ uri: productResult.imageUrl }} style={{ width: '100%', height: 140, borderRadius: t.radius.md, marginBottom: t.spacing.sm }} resizeMode="contain" />
            )}
            <DetailRow label="Barcode" value={productResult.barcode} />
            <DetailRow label="Name" value={productResult.title} />
            <DetailRow label="Brand" value={productResult.brand || '—'} />
            <DetailRow label="Category" value={productResult.category || '—'} />
            {productResult.description && (
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted, marginTop: t.spacing.sm }}>
                {productResult.description}
              </Text>
            )}
          </Card>
        )}
      </View>
    </Screen>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textMuted }}>{label}</Text>
      <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{value}</Text>
    </View>
  );
}
