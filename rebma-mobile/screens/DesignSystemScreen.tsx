// rebma-mobile/screens/DesignSystemScreen.tsx
// __DEV__-only gallery of every primitive — the actual gate for starting
// Phase 7.1 (§9 item 11 of the Phase 7.0 plan). Every future department
// screen is assembled from exactly these components.
import { useState } from 'react';
import { View, Text } from 'react-native';
import { Package, ShieldAlert, Truck, CircleCheckBig } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import {
  Screen, Card, PageTitle, SectionHeader, Badge, Button, MetricCard, Sheet,
  SearchablePicker, DataList, type DataColumn, CountUp, Avatar, EmptyState, SkeletonList,
} from '../components/ui';

interface Row { id: string; product: string; status: string; qty: number; supplier: string }
const ROWS: Row[] = [
  { id: '1', product: 'Bagged Rice 50kg', status: 'APPROVED', qty: 120, supplier: 'Golden Fields' },
  { id: '2', product: 'Cooking Oil 5L', status: 'PENDING_RISK', qty: 60, supplier: 'Sunrise Oils' },
  { id: '3', product: 'Flour 25kg', status: 'REJECTED', qty: 40, supplier: 'Millhouse' },
];

const columns: DataColumn<Row>[] = [
  { key: 'product', label: 'Product', primary: true },
  { key: 'status', label: 'Status', status: true, render: (r) => <Badge tone="warning" label={r.status.replace(/_/g, ' ')} size="xs" /> },
  { key: 'qty', label: 'Qty' },
  { key: 'supplier', label: 'Supplier' },
];

export default function DesignSystemScreen() {
  const t = useTheme();
  const [sheetSide, setSheetSide] = useState<'bottom' | 'right' | 'left' | 'full' | null>(null);
  const [pickerVal, setPickerVal] = useState('a');
  const [bigPickerVal, setBigPickerVal] = useState('1');

  return (
    <Screen>
      <PageTitle title="Design System" subtitle="Phase 7.0 primitive gallery" />

      <SectionHeader title="Cards" />
      <View style={{ gap: t.spacing.md, marginBottom: t.spacing.xl }}>
        <Card><Text style={{ fontFamily: t.font.regular }}>Default card</Text></Card>
        <Card tone="inset"><Text style={{ fontFamily: t.font.regular }}>Inset card</Text></Card>
      </View>

      <SectionHeader title="Badges" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm, marginBottom: t.spacing.xl }}>
        <Badge tone="success" label="Success" />
        <Badge tone="warning" label="Warning" />
        <Badge tone="danger" label="Danger" />
        <Badge tone="info" label="Info" />
        <Badge tone="muted" label="Muted" />
        <Badge tone="purple" label="Purple" />
      </View>

      <SectionHeader title="Buttons" />
      <View style={{ gap: t.spacing.sm, marginBottom: t.spacing.xl }}>
        <Button label="Primary" onPress={() => {}} variant="primary" />
        <Button label="Ghost" onPress={() => {}} variant="ghost" />
        <Button label="Danger" onPress={() => {}} variant="danger" />
        <Button label="Loading" onPress={() => {}} loading />
        <Button label="Disabled" onPress={() => {}} disabled />
      </View>

      <SectionHeader title="Metric Cards" />
      <View style={{ flexDirection: 'row', gap: t.spacing.md, marginBottom: t.spacing.xl }}>
        <MetricCard label="Cargo Pending" value={<CountUp value={12} style={{ fontFamily: t.font.extrabold, fontSize: t.type.kpi28.size, color: t.colors.textPrimary }} />} icon={<Package size={18} color={t.colors.accent} />} emphasis="primary" tone="accent" trend={{ direction: 'up', value: '+4 today' }} />
        <MetricCard label="On Hold" value="3" icon={<ShieldAlert size={16} color={t.colors.status.danger.text} />} tone="danger" />
      </View>

      <SectionHeader title="Data List" />
      <View style={{ marginBottom: t.spacing.xl }}>
        <DataList
          columns={columns}
          data={ROWS}
          rowKey={(r) => r.id}
          renderActions={() => <Button label="Approve" onPress={() => {}} size="sm" icon={<CircleCheckBig size={14} color="#fff" />} />}
        />
      </View>

      <SectionHeader title="Sheets" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm, marginBottom: t.spacing.xl }}>
        <Button label="Bottom" onPress={() => setSheetSide('bottom')} size="sm" variant="ghost" />
        <Button label="Left (drawer)" onPress={() => setSheetSide('left')} size="sm" variant="ghost" />
        <Button label="Right" onPress={() => setSheetSide('right')} size="sm" variant="ghost" />
        <Button label="Full" onPress={() => setSheetSide('full')} size="sm" variant="ghost" />
      </View>

      <SectionHeader title="Searchable Picker" />
      <View style={{ gap: t.spacing.md, marginBottom: t.spacing.xl }}>
        <SearchablePicker
          label="Small list (no search row)"
          value={pickerVal}
          onChange={setPickerVal}
          options={[{ value: 'a', label: 'Option A' }, { value: 'b', label: 'Option B' }, { value: 'c', label: 'Option C' }]}
        />
        <SearchablePicker
          label="Large list (search row appears)"
          value={bigPickerVal}
          onChange={setBigPickerVal}
          options={Array.from({ length: 12 }).map((_, i) => ({ value: String(i + 1), label: `Item ${i + 1}`, sublabel: 'Sample sublabel' }))}
        />
      </View>

      <SectionHeader title="Avatar" />
      <View style={{ flexDirection: 'row', gap: t.spacing.md, marginBottom: t.spacing.xl, alignItems: 'center' }}>
        <Avatar name="Kofi Mensah" />
        <Avatar name="Ama Boateng" isSpecial />
        <Avatar name="Truck Driver" rounded="2xl" />
      </View>

      <SectionHeader title="Empty State" />
      <View style={{ marginBottom: t.spacing.xl }}>
        <Card padded={false}>
          <EmptyState icon={<Truck size={20} color={t.colors.textMuted} />} title="No deliveries yet" description="Assigned deliveries will show up here." />
        </Card>
      </View>

      <SectionHeader title="Skeleton" />
      <View style={{ marginBottom: t.spacing.xl }}>
        <SkeletonList rows={2} />
      </View>

      <Sheet open={sheetSide !== null} onClose={() => setSheetSide(null)} title="Sheet demo" subtitle={sheetSide || undefined} side={sheetSide || 'bottom'} footer={<Button label="Close" onPress={() => setSheetSide(null)} size="sm" />}>
        <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body14.size, color: t.colors.textSecondary }}>
          This is the {sheetSide} presentation of the Sheet primitive.
        </Text>
      </Sheet>
    </Screen>
  );
}
