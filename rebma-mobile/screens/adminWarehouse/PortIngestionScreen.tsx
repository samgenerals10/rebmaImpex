// rebma-mobile/screens/adminWarehouse/PortIngestionScreen.tsx
// Ports: rebma-web/src/views/OperationsDashboard.tsx's `PortIngestion`
// sub-tab (~L1215-1457, the two-card launcher) + apiClient.ts's
// operations.logIntake()/logGeneralPurchase() (the two write paths both
// launcher cards ultimately call — confirmed neither writes to
// stock/stock_ledger directly at intake time; that happens later, at
// Risk's cargo approval or Management's general-purchase approval).
//
// Phase 7.12, D123/D124: the warehouse/port floor is a real candidate for
// poor connectivity (this screen's own header already self-describes that
// environment) — a failed cargo/purchase insert is queued via
// lib/offlineQueue.ts instead of shown as a plain error. D124: logAudit()
// used to swallow a failed audit insert in an empty `catch {}` with no
// alert, no record, no retry — a confirmed, real data-loss bug this phase
// fixes by routing that failure through the same offline queue instead of
// silently discarding it.
import { useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { Ship, Package, Camera as CameraIcon } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { pickOrCaptureImage } from '../../lib/media';
import { enqueue, QUEUE_KEYS } from '../../lib/offlineQueue';
import { getCeoSetting } from '../../lib/ceoSetting';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Sheet from '../../components/ui/Sheet';
import Button from '../../components/ui/Button';
import Input, { Field } from '../../components/ui/Input';
import SearchablePicker from '../../components/ui/SearchablePicker';

type Mode = 'port' | 'inhouse' | null;
type Classification = 'COMPANY_PRODUCT' | 'GENERAL_PURCHASE';

function autoGoodsCode() {
  return `GC-${Date.now().toString().slice(-6)}`;
}

export default function PortIngestionScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const [mode, setMode] = useState<Mode>(null);
  const [submitting, setSubmitting] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);

  // Port cargo fields
  const [productName, setProductName] = useState('');
  const [goodsCode, setGoodsCode] = useState('');
  const [destination, setDestination] = useState('');
  const [country, setCountry] = useState('');
  const [company, setCompany] = useState('');
  const [containerNumber, setContainerNumber] = useState('');
  const [quantity, setQuantity] = useState('');
  const [weight, setWeight] = useState('');
  const [discrepancies, setDiscrepancies] = useState('');

  // In-house fields
  const [classification, setClassification] = useState<Classification>('COMPANY_PRODUCT');
  const [ihProductName, setIhProductName] = useState('');
  const [ihGoodsCode, setIhGoodsCode] = useState('');
  const [ihUnits, setIhUnits] = useState('');
  const [ihWeight, setIhWeight] = useState('');
  const [gpItemName, setGpItemName] = useState('');
  const [gpItemCode, setGpItemCode] = useState('');
  const [gpCategory, setGpCategory] = useState('');
  const [gpQuantity, setGpQuantity] = useState('');
  const [gpCost, setGpCost] = useState('');

  const resetPortForm = () => {
    setProductName(''); setGoodsCode(''); setDestination(''); setCountry(''); setCompany('');
    setContainerNumber(''); setQuantity(''); setWeight(''); setDiscrepancies(''); setPhoto(null);
  };
  const resetInHouseForm = () => {
    setIhProductName(''); setIhGoodsCode(''); setIhUnits(''); setIhWeight('');
    setGpItemName(''); setGpItemCode(''); setGpCategory(''); setGpQuantity(''); setGpCost('');
  };

  const logAudit = async (action: string, details: string) => {
    const payload = {
      action, department: 'ADMIN_WAREHOUSE', performed_by: profile?.fullName || 'Ops Staff',
      user_id: profile?.id || null, details, timestamp: new Date().toISOString(),
    };
    try {
      const { error } = await supabase.from('global_audit_history').insert(payload);
      if (error) await enqueue(QUEUE_KEYS.portIngestion, 'global_audit_history', payload);
    } catch {
      // D124: previously a bare swallow — a genuine thrown error (not just
      // a Postgrest error object) is now queued too, not silently lost.
      await enqueue(QUEUE_KEYS.portIngestion, 'global_audit_history', payload);
    }
  };

  const submitPortCargo = async () => {
    if (!productName.trim() || !destination.trim() || !country.trim() || !company.trim() || !quantity || !weight) {
      Alert.alert('Missing Info', 'Product name, destination, country, company, quantity, and weight are required.');
      return;
    }
    if (!(await getCeoSetting('forms_control', true))) {
      Alert.alert('Disabled by CEO', 'Form submissions are currently disabled by the CEO.');
      return;
    }
    setSubmitting(true);
    const code = goodsCode.trim() || autoGoodsCode();
    const payload = {
      product_name: productName.trim(),
      goods_code: code,
      destination: destination.trim(),
      product_image: photo,
      country: country.trim(),
      company: company.trim(),
      container_number: containerNumber.trim() || null,
      quantity: Number(quantity) || 0,
      weight: Number(weight) || 0,
      discrepancies: discrepancies.trim() || null,
      is_fault_or_damaged: !!discrepancies.trim(),
      status: 'PENDING_RISK_APPROVAL',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('cargo_intake').insert(payload);
    setSubmitting(false);
    if (error) {
      await enqueue(QUEUE_KEYS.portIngestion, 'cargo_intake', payload);
      await logAudit('LOG_CARGO_INTAKE', `Port cargo logged (offline, will sync): ${productName.trim()} (${code})`);
      Alert.alert('Saved Offline', 'No connection right now, so this cargo log will sync automatically once you\'re back online.');
      resetPortForm();
      setMode(null);
      return;
    }
    await logAudit('LOG_CARGO_INTAKE', `Port cargo logged: ${productName.trim()} (${code})`);
    Alert.alert('Cargo Logged', 'Sent to Risk for approval.');
    resetPortForm();
    setMode(null);
  };

  const submitInHouse = async () => {
    if (!(await getCeoSetting('forms_control', true))) {
      Alert.alert('Disabled by CEO', 'Form submissions are currently disabled by the CEO.');
      return;
    }
    if (!(await getCeoSetting('cargo_intake_enabled', true))) {
      Alert.alert('Disabled by CEO', 'Cargo intake is currently disabled by the CEO.');
      return;
    }
    setSubmitting(true);
    if (classification === 'COMPANY_PRODUCT') {
      if (!ihProductName.trim() || !ihUnits) {
        setSubmitting(false);
        Alert.alert('Missing Info', 'Product name and units are required.');
        return;
      }
      const code = ihGoodsCode.trim() || autoGoodsCode();
      const payload = {
        product_name: ihProductName.trim(),
        goods_code: code,
        destination: 'Main Warehouse',
        product_image: photo,
        country: 'Ghana',
        company: 'REBMA IN-HOUSE PRODUCTION',
        quantity: parseInt(ihUnits, 10) || 0,
        weight: parseFloat(ihWeight) || 0,
        discrepancies: 'None',
        status: 'PENDING_RISK_APPROVAL',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('cargo_intake').insert(payload);
      setSubmitting(false);
      if (error) {
        await enqueue(QUEUE_KEYS.portIngestion, 'cargo_intake', payload);
        await logAudit('LOG_CARGO_INTAKE', `Company product stock intake logged (offline, will sync): ${ihProductName.trim()} (${code})`);
        Alert.alert('Saved Offline', 'No connection right now, so this stock intake will sync automatically once you\'re back online.');
        resetInHouseForm();
        setMode(null);
        return;
      }
      await logAudit('LOG_CARGO_INTAKE', `Company product stock intake logged: ${ihProductName.trim()} (${code})`);
    } else {
      if (!gpItemName.trim() || !gpQuantity || !gpCost) {
        setSubmitting(false);
        Alert.alert('Missing Info', 'Item name, quantity, and cost are required.');
        return;
      }
      const code = gpItemCode.trim() || `GP-${Date.now().toString().slice(-6)}`;
      const payload = {
        item_name: gpItemName.trim(),
        item_code: code,
        category: gpCategory.trim() || 'General',
        quantity: parseInt(gpQuantity, 10) || 0,
        cost: parseFloat(gpCost) || 0,
        date_received: new Date().toISOString().slice(0, 10),
        status: 'PENDING_MANAGEMENT_APPROVAL',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('general_purchases').insert(payload);
      setSubmitting(false);
      if (error) {
        await enqueue(QUEUE_KEYS.portIngestion, 'general_purchases', payload);
        await logAudit('LOG_GENERAL_PURCHASE', `General purchase logged (offline, will sync): ${gpItemName.trim()} (${gpQuantity} units, GHS ${gpCost}). Code: ${code}`);
        Alert.alert('Saved Offline', 'No connection right now, so this purchase will sync automatically once you\'re back online.');
        resetInHouseForm();
        setMode(null);
        return;
      }
      await logAudit('LOG_GENERAL_PURCHASE', `General purchase logged: ${gpItemName.trim()} (${gpQuantity} units, GHS ${gpCost}). Code: ${code}`);
    }
    Alert.alert('Logged', classification === 'COMPANY_PRODUCT' ? 'Sent to Risk for approval.' : 'Sent to Management for approval.');
    resetInHouseForm();
    setMode(null);
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
        <LauncherCard icon={<Ship size={26} color={t.colors.accent} />} title="Log Port Cargo" description="Record incoming goods from the port or external suppliers" onPress={() => setMode('port')} />
        <LauncherCard icon={<Package size={26} color={t.colors.accent} />} title="Log Stock Intake" description="Log internal production output or general purchased items" onPress={() => setMode('inhouse')} />
      </View>

      <Sheet open={mode === 'port'} onClose={() => setMode(null)} title="Log Incoming Port Cargo" side="bottom" maxHeight={640}
        footer={<Button label={submitting ? 'Submitting…' : 'Submit Cargo Log'} onPress={submitPortCargo} loading={submitting} disabled={submitting} fullWidth />}
      >
        <Field label="Product / Goods Name *"><Input value={productName} onChangeText={setProductName} placeholder="E.g., Palm Oil Barrels" /></Field>
        <Field label="Goods Code" hint="Auto-generated if left empty"><Input value={goodsCode} onChangeText={setGoodsCode} placeholder={autoGoodsCode()} /></Field>
        <Field label="Delivery Destination *"><Input value={destination} onChangeText={setDestination} placeholder="E.g., Accra Main Warehouse" /></Field>
        <Field label="Country of Origin *"><Input value={country} onChangeText={setCountry} placeholder="E.g., Germany" /></Field>
        <Field label="Shipping Company *"><Input value={company} onChangeText={setCompany} placeholder="E.g., COSCO, Maersk" /></Field>
        <Field label="Container Number" hint="Optional, since not every shipment is containerized"><Input value={containerNumber} onChangeText={setContainerNumber} placeholder="E.g., MSKU-1234567" /></Field>
        <Field label="Total Quantity *"><Input value={quantity} onChangeText={setQuantity} placeholder="E.g., 350" keyboardType="numeric" /></Field>
        <Field label="Weight (Metric Tons) *"><Input value={weight} onChangeText={setWeight} placeholder="E.g., 12.5" keyboardType="decimal-pad" /></Field>
        <Field label="Discrepancy Notes / Faults" hint="Optional"><Input value={discrepancies} onChangeText={setDiscrepancies} placeholder="E.g., 2 boxes damaged" /></Field>
        <Field label="Cargo Photo" hint="Optional">
          <Button
            variant="ghost"
            icon={<CameraIcon size={14} color={t.colors.textSecondary} />}
            label={photo ? 'Change Photo' : 'Add Photo'}
            onPress={async () => setPhoto(await pickOrCaptureImage())}
          />
        </Field>
      </Sheet>

      <Sheet open={mode === 'inhouse'} onClose={() => setMode(null)} title="Warehouse Stock Intake" side="bottom" maxHeight={640}
        footer={<Button label={submitting ? 'Submitting…' : 'Submit'} onPress={submitInHouse} loading={submitting} disabled={submitting} fullWidth />}
      >
        <Field label="Classification">
          <SearchablePicker
            value={classification}
            onChange={(v) => setClassification(v as Classification)}
            options={[
              { value: 'COMPANY_PRODUCT', label: 'Company Produced Goods' },
              { value: 'GENERAL_PURCHASE', label: 'General Purchased Items' },
            ]}
          />
        </Field>
        {classification === 'COMPANY_PRODUCT' ? (
          <>
            <Field label="Product Name *"><Input value={ihProductName} onChangeText={setIhProductName} placeholder="Product name" /></Field>
            <Field label="Goods Code" hint="Auto-generated if left empty"><Input value={ihGoodsCode} onChangeText={setIhGoodsCode} placeholder={autoGoodsCode()} /></Field>
            <Field label="Units *"><Input value={ihUnits} onChangeText={setIhUnits} placeholder="E.g., 200" keyboardType="numeric" /></Field>
            <Field label="Weight (Metric Tons)"><Input value={ihWeight} onChangeText={setIhWeight} placeholder="E.g., 5.0" keyboardType="decimal-pad" /></Field>
          </>
        ) : (
          <>
            <Field label="Item Name *"><Input value={gpItemName} onChangeText={setGpItemName} placeholder="Item name" /></Field>
            <Field label="Item Code" hint="Auto-generated if left empty"><Input value={gpItemCode} onChangeText={setGpItemCode} placeholder="GP-000000" /></Field>
            <Field label="Category"><Input value={gpCategory} onChangeText={setGpCategory} placeholder="E.g., Packaging" /></Field>
            <Field label="Quantity *"><Input value={gpQuantity} onChangeText={setGpQuantity} placeholder="E.g., 100" keyboardType="numeric" /></Field>
            <Field label="Cost (GHS) *"><Input value={gpCost} onChangeText={setGpCost} placeholder="E.g., 1500" keyboardType="decimal-pad" /></Field>
          </>
        )}
        <Field label="Photo" hint="Optional">
          <Button
            variant="ghost"
            icon={<CameraIcon size={14} color={t.colors.textSecondary} />}
            label={photo ? 'Change Photo' : 'Add Photo'}
            onPress={async () => setPhoto(await pickOrCaptureImage())}
          />
        </Field>
      </Sheet>
    </Screen>
  );
}

function LauncherCard({ icon, title, description, onPress }: { icon: React.ReactNode; title: string; description: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: '47%', minWidth: 150, flexGrow: 1, alignItems: 'center', gap: t.spacing.sm,
        padding: t.spacing.xl, backgroundColor: t.colors.bgCard, borderWidth: 1.5, borderColor: t.colors.border,
        borderRadius: t.radius.card,
      }}
    >
      <View style={{ width: 56, height: 56, borderRadius: t.radius.lg, backgroundColor: t.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </View>
      <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, textAlign: 'center' }}>{title}</Text>
      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, textAlign: 'center' }}>{description}</Text>
    </Pressable>
  );
}
