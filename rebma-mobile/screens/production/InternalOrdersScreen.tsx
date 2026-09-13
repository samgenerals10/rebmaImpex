// rebma-mobile/screens/production/InternalOrdersScreen.tsx
// Ports: rebma-web/src/views/production/InternalOrdersView.tsx (769 lines,
// read in full) — the centerpiece of Phase 7.8 (D63). Two lifecycles in
// one screen, matching web's own single-file structure: production_requests
// full CRUD (submit/duplicate/edit incl. status+rejection_reason/delete)
// with a getDisplayStatus() cross-reference against wip_stock (once a WIP
// item exists with a matching product name, the displayed status shows
// that item's live pipeline stage instead of the raw production_requests
// status); material_requisitions submit-only, exact write shape from
// apiClient.ts's production.requestMaterials().
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { Plus, Boxes, Copy, Trash2, Edit3 } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import type { StatusTone } from '../../theme/tokens';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input, { Field } from '../../components/ui/Input';
import SearchablePicker from '../../components/ui/SearchablePicker';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Sheet from '../../components/ui/Sheet';
import SectionHeader from '../../components/ui/SectionHeader';

const STATUS_LABELS: Record<string, string> = {
  PENDING_MANAGEMENT: 'Pending',
  APPROVED: 'Approved',
  TICKETS_ISSUED: 'Issued',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
};

function statusOrStageTone(status: string): StatusTone {
  const map: Record<string, StatusTone> = {
    PENDING_MANAGEMENT: 'warning',
    APPROVED: 'info',
    TICKETS_ISSUED: 'purple',
    COMPLETED: 'success',
    REJECTED: 'danger',
    'Raw Materials': 'muted',
    Processing: 'info',
    'Quality Check': 'warning',
    Packaging: 'warning',
    'Awaiting Dispatch': 'success',
    Completed: 'purple',
  };
  return map[status] || 'muted';
}

const getDisplayStatus = (order: any, wipList: any[]) => {
  if (order.status === 'COMPLETED' || order.status === 'REJECTED') {
    return { text: STATUS_LABELS[order.status] || order.status, statusVal: order.status };
  }
  const match = wipList.find(
    (w) => (w.product_name || '').toLowerCase().trim() === (order.product_name || '').toLowerCase().trim()
  );
  if (match) return { text: match.stage, statusVal: match.stage };
  return { text: STATUS_LABELS[order.status] || order.status, statusVal: order.status };
};

const REQ_STATUS_LABELS: Record<string, string> = {
  PENDING_MANAGEMENT: 'Awaiting Management',
  PENDING_FINANCE: 'Awaiting Finance',
  APPROVED: 'Approved — Awaiting Pickup',
  FULFILLED: 'Materials Released',
  REJECTED: 'Rejected',
};

const emptyNewForm = { productName: '', quantity: '', unit: 'kg', requiredByDate: '', purpose: '', priority: 'Medium', notes: '' };
const emptyMaterialForm = { materialName: '', quantity: '', unit: 'kg', notes: '' };

export default function InternalOrdersScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [wipItems, setWipItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newForm, setNewForm] = useState(emptyNewForm);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [materialForm, setMaterialForm] = useState(emptyMaterialForm);
  const [submittingMaterial, setSubmittingMaterial] = useState(false);

  const load = useCallback(async () => {
    const [{ data: wipData }, { data: orderData }, { data: reqData }] = await Promise.all([
      supabase.from('wip_stock').select('*'),
      supabase.from('production_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('material_requisitions').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    setWipItems(wipData || []);
    setOrders(orderData || []);
    setRequisitions(reqData || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = orders.filter((o) => {
    const matchStatus = statusFilter === 'All' || o.status === statusFilter;
    const s = search.toLowerCase();
    const matchSearch =
      !s ||
      (o.product_name || '').toLowerCase().includes(s) ||
      String(o.request_number || '').toLowerCase().includes(s) ||
      (o.purpose || '').toLowerCase().includes(s);
    return matchStatus && matchSearch;
  });

  const counts = {
    total: orders.length,
    pending: orders.filter((o) => o.status === 'PENDING_MANAGEMENT').length,
    approved: orders.filter((o) => o.status === 'APPROVED').length,
    completed: orders.filter((o) => o.status === 'COMPLETED').length,
  };

  const handleSubmitNew = async () => {
    if (!newForm.productName.trim()) {
      Alert.alert('Product Name is required.');
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('production_requests').insert({
        request_number: `REQ-${Math.floor(10000 + Math.random() * 90000)}`,
        product_name: newForm.productName,
        quantity: Number(newForm.quantity) || 0,
        unit: newForm.unit,
        required_by_date: newForm.requiredByDate || null,
        purpose: newForm.purpose || null,
        priority: newForm.priority,
        status: 'PENDING_MANAGEMENT',
        notes: newForm.notes || null,
      });
      if (error) throw error;
      setShowNewModal(false);
      setNewForm(emptyNewForm);
      await load();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Could not submit production request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDuplicate = async (order: any) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('production_requests').insert({
        request_number: `REQ-${Math.floor(10000 + Math.random() * 90000)}`,
        product_name: order.product_name,
        quantity: Number(order.quantity),
        unit: order.unit,
        required_by_date: order.required_by_date || null,
        purpose: order.purpose || null,
        priority: order.priority || 'Medium',
        status: 'PENDING_MANAGEMENT',
        notes: `Duplicated from request ${order.request_number || order.id}`,
      });
      if (error) throw error;
      await load();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Could not duplicate request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSave = async () => {
    if (!editForm || !String(editForm.product_name || '').trim()) {
      Alert.alert('Product Name is required.');
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('production_requests')
        .update({
          product_name: editForm.product_name,
          quantity: Number(editForm.quantity) || 0,
          unit: editForm.unit,
          required_by_date: editForm.required_by_date || null,
          purpose: editForm.purpose || null,
          priority: editForm.priority,
          status: editForm.status,
          notes: editForm.notes || null,
          rejection_reason: editForm.status === 'REJECTED' ? editForm.rejection_reason : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editForm.id);
      if (error) throw error;
      setShowEditModal(false);
      setEditForm(null);
      await load();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Could not save changes.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (order: any) => {
    Alert.alert('Delete Request', `Delete production request ${order.request_number || order.id}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('production_requests').delete().eq('id', order.id);
          if (error) Alert.alert('Failed', error.message);
          else await load();
        },
      },
    ]);
  };

  const handleSubmitMaterialRequest = async () => {
    if (!materialForm.materialName.trim() || !(Number(materialForm.quantity) > 0)) {
      Alert.alert('Material name and a positive quantity are required.');
      return;
    }
    if (submittingMaterial) return;
    setSubmittingMaterial(true);
    try {
      const requestedBy = profile?.fullName || 'Production Staff';
      const { error } = await supabase.from('material_requisitions').insert({
        requested_by: requestedBy,
        department: 'PRODUCTION',
        items: [{ materialName: materialForm.materialName.trim(), quantity: Number(materialForm.quantity), unit: materialForm.unit }],
        notes: materialForm.notes || null,
        status: 'PENDING_MANAGEMENT',
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      setShowMaterialModal(false);
      setMaterialForm(emptyMaterialForm);
      await load();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Could not submit material request.');
    } finally {
      setSubmittingMaterial(false);
    }
  };

  const columns: DataColumn<any>[] = [
    { key: 'product_name', label: 'Product', primary: true },
    {
      key: 'status',
      label: 'Status',
      status: true,
      render: (o) => {
        const d = getDisplayStatus(o, wipItems);
        return <Badge tone={statusOrStageTone(d.statusVal)} label={d.text} size="xs" />;
      },
    },
    { key: 'request_number', label: 'Request #', render: (o) => `Req #${o.request_number || String(o.id).slice(0, 8)}` },
    { key: 'quantity', label: 'Qty', render: (o) => `${o.quantity} ${o.unit}` },
    { key: 'priority', label: 'Priority' },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button label="Materials" variant="ghost" icon={<Boxes size={14} color={t.colors.textSecondary} />} onPress={() => setShowMaterialModal(true)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="New Request" icon={<Plus size={14} color="#fff" />} onPress={() => setShowNewModal(true)} />
          </View>
        </View>

        <Card>
          <SectionHeader title="Raw Material Requisitions" subtitle="Goes to Management, then Finance, then Operations releases the stock." />
          <View style={{ gap: t.spacing.sm }}>
            {requisitions.slice(0, 8).map((r) => {
              const items = Array.isArray(r.items) ? r.items : [];
              const summary = items.map((i: any) => `${i.materialName} (${i.quantity}${i.unit ? ' ' + i.unit : ''})`).join(', ') || 'Materials';
              return (
                <View
                  key={r.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: t.spacing.sm,
                    padding: t.spacing.sm,
                    backgroundColor: t.colors.bgPage,
                    borderRadius: t.radius.sm,
                    borderWidth: 1,
                    borderColor: t.colors.border,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{summary}</Text>
                    <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 2 }}>
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}
                      {r.notes ? ` · ${r.notes}` : ''}
                    </Text>
                  </View>
                  <Badge tone={r.status === 'REJECTED' ? 'danger' : r.status === 'FULFILLED' ? 'success' : 'warning'} label={REQ_STATUS_LABELS[r.status] || r.status} size="xs" />
                </View>
              );
            })}
            {requisitions.length === 0 && (
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center', paddingVertical: t.spacing.md }}>
                No raw material requests yet.
              </Text>
            )}
          </View>
        </Card>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          <View style={{ width: '47%' }}><MetricCard label="Total Orders" value={counts.total} emphasis="secondary" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Pending" value={counts.pending} tone="warning" emphasis="secondary" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Approved" value={counts.approved} tone="accent" emphasis="secondary" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Completed" value={counts.completed} tone="accent" emphasis="secondary" /></View>
        </View>

        <Input value={search} onChangeText={setSearch} placeholder="Search orders or materials..." />
        <SearchablePicker
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'All', label: 'All Statuses' },
            { value: 'PENDING_MANAGEMENT', label: 'Pending' },
            { value: 'APPROVED', label: 'Approved' },
            { value: 'TICKETS_ISSUED', label: 'Tickets Issued' },
            { value: 'COMPLETED', label: 'Completed' },
            { value: 'REJECTED', label: 'Rejected' },
          ]}
        />

        <DataList
          columns={columns}
          data={filtered}
          rowKey={(o) => o.id}
          loading={loading}
          onRowPress={(o) => setSelectedOrder(o)}
          emptyIcon={<Boxes size={28} color={t.colors.textMuted} />}
          emptyTitle="No orders yet"
          emptyDescription="They will appear here once added"
          renderActions={(o) => (
            <View style={{ flexDirection: 'row', gap: t.spacing.xs }}>
              <Button label="Edit" size="sm" variant="ghost" icon={<Edit3 size={12} color={t.colors.textSecondary} />} onPress={() => { setEditForm({ ...o }); setShowEditModal(true); }} />
              <Button label="Copy" size="sm" variant="ghost" icon={<Copy size={12} color={t.colors.textSecondary} />} onPress={() => handleDuplicate(o)} />
              <Button label="Delete" size="sm" variant="danger" icon={<Trash2 size={12} color="#fff" />} onPress={() => handleDelete(o)} />
            </View>
          )}
        />
      </View>

      <Sheet
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title="Request Details"
        side="bottom"
        maxHeight={640}
        footer={<Button label="Close" onPress={() => setSelectedOrder(null)} fullWidth />}
      >
        {selectedOrder && (() => {
          const disp = getDisplayStatus(selectedOrder, wipItems);
          return (
            <View style={{ gap: t.spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
                <Badge tone={statusOrStageTone(disp.statusVal)} label={disp.text} />
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>
                  Created: {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString() : '—'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>Product</Text>
                  <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{selectedOrder.product_name}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>Quantity</Text>
                  <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>
                    {selectedOrder.quantity} {selectedOrder.unit}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>Required By</Text>
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>
                    {selectedOrder.required_by_date ? new Date(selectedOrder.required_by_date).toLocaleDateString() : '—'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>Priority</Text>
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{selectedOrder.priority}</Text>
                </View>
              </View>
              <View>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>Purpose</Text>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{selectedOrder.purpose || '—'}</Text>
              </View>
              {selectedOrder.rejection_reason && (
                <Card tone="inset">
                  <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.status.danger.text, marginBottom: 4 }}>Rejection Reason</Text>
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{selectedOrder.rejection_reason}</Text>
                </Card>
              )}
              <View>
                <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.textPrimary, marginBottom: 4 }}>Notes</Text>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body14.size, color: t.colors.textSecondary }}>{selectedOrder.notes || 'No notes added.'}</Text>
              </View>
            </View>
          );
        })()}
      </Sheet>

      <Sheet
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="New Production Request"
        side="bottom"
        maxHeight={680}
        footer={<Button label={submitting ? 'Submitting…' : 'Submit Request'} onPress={handleSubmitNew} loading={submitting} disabled={submitting} fullWidth />}
      >
        <Field label="Product Name"><Input value={newForm.productName} onChangeText={(v) => setNewForm((f) => ({ ...f, productName: v }))} placeholder="e.g. Bread Flour" /></Field>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}><Field label="Quantity"><Input value={newForm.quantity} onChangeText={(v) => setNewForm((f) => ({ ...f, quantity: v }))} keyboardType="numeric" placeholder="Qty" /></Field></View>
          <View style={{ flex: 1 }}><Field label="Unit"><Input value={newForm.unit} onChangeText={(v) => setNewForm((f) => ({ ...f, unit: v }))} placeholder="e.g. kg" /></Field></View>
        </View>
        <Field label="Required By Date"><Input value={newForm.requiredByDate} onChangeText={(v) => setNewForm((f) => ({ ...f, requiredByDate: v }))} placeholder="YYYY-MM-DD" /></Field>
        <Field label="Priority">
          <SearchablePicker value={newForm.priority} onChange={(v) => setNewForm((f) => ({ ...f, priority: v }))} options={[{ value: 'Low', label: 'Low' }, { value: 'Medium', label: 'Medium' }, { value: 'High', label: 'High' }]} />
        </Field>
        <Field label="Purpose"><Input value={newForm.purpose} onChangeText={(v) => setNewForm((f) => ({ ...f, purpose: v }))} placeholder="e.g. Order Fulfillment" /></Field>
        <Field label="Notes"><Input value={newForm.notes} onChangeText={(v) => setNewForm((f) => ({ ...f, notes: v }))} multiline numberOfLines={3} style={{ minHeight: 72, textAlignVertical: 'top' }} /></Field>
      </Sheet>

      <Sheet
        open={showEditModal && !!editForm}
        onClose={() => { setShowEditModal(false); setEditForm(null); }}
        title="Edit Production Request"
        side="bottom"
        maxHeight={720}
        footer={<Button label={submitting ? 'Saving…' : 'Save Changes'} onPress={handleEditSave} loading={submitting} disabled={submitting} fullWidth />}
      >
        {editForm && (
          <>
            <Field label="Product Name"><Input value={editForm.product_name} onChangeText={(v) => setEditForm({ ...editForm, product_name: v })} /></Field>
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <View style={{ flex: 1 }}><Field label="Quantity"><Input value={String(editForm.quantity ?? '')} onChangeText={(v) => setEditForm({ ...editForm, quantity: v })} keyboardType="numeric" /></Field></View>
              <View style={{ flex: 1 }}><Field label="Unit"><Input value={editForm.unit} onChangeText={(v) => setEditForm({ ...editForm, unit: v })} /></Field></View>
            </View>
            <Field label="Required By Date"><Input value={editForm.required_by_date || ''} onChangeText={(v) => setEditForm({ ...editForm, required_by_date: v })} placeholder="YYYY-MM-DD" /></Field>
            <Field label="Priority">
              <SearchablePicker
                value={editForm.priority}
                onChange={(v) => setEditForm({ ...editForm, priority: v })}
                options={[{ value: 'Low', label: 'Low' }, { value: 'Medium', label: 'Medium' }, { value: 'High', label: 'High' }]}
              />
            </Field>
            <Field label="Purpose"><Input value={editForm.purpose || ''} onChangeText={(v) => setEditForm({ ...editForm, purpose: v })} /></Field>
            <Field label="Status">
              <SearchablePicker
                value={editForm.status}
                onChange={(v) => setEditForm({ ...editForm, status: v })}
                options={[
                  { value: 'PENDING_MANAGEMENT', label: 'Pending' },
                  { value: 'APPROVED', label: 'Approved' },
                  { value: 'TICKETS_ISSUED', label: 'Tickets Issued' },
                  { value: 'COMPLETED', label: 'Completed' },
                  { value: 'REJECTED', label: 'Rejected' },
                ]}
              />
            </Field>
            {editForm.status === 'REJECTED' && (
              <Field label="Rejection Reason">
                <Input value={editForm.rejection_reason || ''} onChangeText={(v) => setEditForm({ ...editForm, rejection_reason: v })} multiline numberOfLines={2} style={{ minHeight: 56, textAlignVertical: 'top' }} />
              </Field>
            )}
            <Field label="Notes"><Input value={editForm.notes || ''} onChangeText={(v) => setEditForm({ ...editForm, notes: v })} multiline numberOfLines={3} style={{ minHeight: 72, textAlignVertical: 'top' }} /></Field>
          </>
        )}
      </Sheet>

      <Sheet
        open={showMaterialModal}
        onClose={() => setShowMaterialModal(false)}
        title="Request Raw Materials"
        subtitle="Goes to Management, then Finance, then Operations releases the materials to you."
        side="bottom"
        maxHeight={600}
        footer={<Button label={submittingMaterial ? 'Submitting…' : 'Submit Request'} onPress={handleSubmitMaterialRequest} loading={submittingMaterial} disabled={submittingMaterial} fullWidth />}
      >
        <Field label="Raw Material"><Input value={materialForm.materialName} onChangeText={(v) => setMaterialForm((f) => ({ ...f, materialName: v }))} placeholder="e.g. Raw Cocoa Beans" /></Field>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}><Field label="Quantity"><Input value={materialForm.quantity} onChangeText={(v) => setMaterialForm((f) => ({ ...f, quantity: v }))} keyboardType="numeric" /></Field></View>
          <View style={{ flex: 1 }}><Field label="Unit"><Input value={materialForm.unit} onChangeText={(v) => setMaterialForm((f) => ({ ...f, unit: v }))} placeholder="e.g. kg" /></Field></View>
        </View>
        <Field label="Notes"><Input value={materialForm.notes} onChangeText={(v) => setMaterialForm((f) => ({ ...f, notes: v }))} multiline numberOfLines={3} placeholder="What's this needed for..." style={{ minHeight: 72, textAlignVertical: 'top' }} /></Field>
      </Sheet>
    </Screen>
  );
}
