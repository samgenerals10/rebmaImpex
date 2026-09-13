// rebma-mobile/screens/ceo/PriceApprovalsScreen.tsx
// Ports: rebma-web/src/views/ceo/PriceApprovalsView.tsx (251 lines, read
// in full) — D74. Pending queue with a was→now price comparison (red on
// increase, green on decrease). Approve upserts goods_prices + updates
// the request row + notifies MANAGEMENT; Reject skips the upsert, same
// other writes — both behind a remark modal (required on reject, optional
// on approve), matching source exactly. Recent-decisions history list +
// RequestTimelineSheet (Phase 7.5, D34) access, same shape as
// ApprovalsScreen (D73).
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { CheckCircle, XCircle, History, ArrowRight, Tag } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input, { Field } from '../../components/ui/Input';
import Sheet from '../../components/ui/Sheet';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonList } from '../../components/ui/Skeleton';
import RequestTimelineSheet from '../../components/shared/RequestTimelineSheet';

interface PriceRequest {
  id: string;
  product_name: string;
  category: string | null;
  unit_price: number;
  cost_price: number | null;
  currency: string;
  product_image: string | null;
  requested_by_name: string | null;
  created_at: string;
  status: string;
}

export default function PriceApprovalsScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const [pending, setPending] = useState<PriceRequest[]>([]);
  const [current, setCurrent] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<PriceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [decisionModal, setDecisionModal] = useState<{ req: PriceRequest; approve: boolean } | null>(null);
  const [remark, setRemark] = useState('');
  const [timelineId, setTimelineId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: pendingRows }, { data: historyRows }, { data: liveGoods }] = await Promise.all([
      supabase.from('goods_price_change_requests').select('*').eq('status', 'PENDING').order('created_at', { ascending: false }),
      supabase.from('goods_price_change_requests').select('*').neq('status', 'PENDING').order('decided_at', { ascending: false }).limit(10),
      supabase.from('goods_prices').select('product_name,unit_price'),
    ]);
    setPending(pendingRows || []);
    setHistory(historyRows || []);
    const priceMap: Record<string, number> = {};
    (liveGoods || []).forEach((g: any) => { priceMap[g.product_name] = Number(g.unit_price || 0); });
    setCurrent(priceMap);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const confirmDecision = () => {
    if (!decisionModal) return;
    const { req, approve } = decisionModal;
    setDecisionModal(null);
    decide(req, approve, remark.trim() || undefined);
  };

  const decide = async (req: PriceRequest, approve: boolean, note?: string) => {
    setDecidingId(req.id);
    const performedBy = profile?.fullName || 'CEO';
    try {
      if (approve) {
        await supabase.from('goods_prices').upsert(
          {
            product_name: req.product_name,
            unit_price: req.unit_price,
            cost_price: req.cost_price,
            category: req.category,
            currency: req.currency,
            product_image: req.product_image,
            updated_by: req.requested_by_name,
            updated_at: new Date().toISOString(),
            status: 'active',
          },
          { onConflict: 'product_name' }
        );
      }
      await supabase.from('goods_price_change_requests').update({
        status: approve ? 'APPROVED' : 'REJECTED',
        decided_at: new Date().toISOString(),
        decided_by: performedBy,
        rejection_reason: approve ? null : (note || null),
      }).eq('id', req.id);

      const details = `${req.product_name} → ${req.currency} ${Number(req.unit_price).toLocaleString()}${note ? ` — ${note}` : ''}`;
      await supabase.from('global_audit_history').insert({
        action: `${approve ? 'Approved' : 'Rejected'} price request`,
        department: 'MANAGEMENT',
        performed_by: performedBy,
        reference_id: req.id,
        details,
      });

      await supabase.from('supplier_order_notifications').insert({
        message: `Price change ${approve ? 'APPROVED' : 'REJECTED'} by CEO: ${req.product_name} → ${req.currency} ${Number(req.unit_price).toLocaleString()}${note ? ` — ${note}` : ''}`,
        notified_department: 'MANAGEMENT',
        read: false,
      });

      setPending((prev) => prev.filter((r) => r.id !== req.id));
      await load();
    } finally {
      setDecidingId(null);
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.lg }}>
        <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>
          {loading ? 'Loading…' : `${pending.length} price change${pending.length !== 1 ? 's' : ''} awaiting your decision`}
        </Text>

        {loading ? (
          <SkeletonList rows={3} />
        ) : pending.length === 0 ? (
          <EmptyState icon={<CheckCircle size={20} color={t.colors.status.success.text} />} title="All clear!" description="No price changes waiting on you right now." />
        ) : (
          <View style={{ gap: t.spacing.sm }}>
            {pending.map((req) => {
              const prev = current[req.product_name];
              const isIncrease = prev != null && req.unit_price > prev;
              const isDecrease = prev != null && req.unit_price < prev;
              return (
                <Card key={req.id}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.sm }}>
                    <View style={{ width: 32, height: 32, borderRadius: t.radius.sm, backgroundColor: t.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Tag size={15} color={t.colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{req.product_name}</Text>
                      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>
                        {req.requested_by_name || 'Management'} · {req.created_at ? new Date(req.created_at).toLocaleDateString() : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs, marginBottom: t.spacing.sm }}>
                    {prev != null && (
                      <>
                        <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted, textDecorationLine: 'line-through' }}>{req.currency} {prev.toLocaleString()}</Text>
                        <ArrowRight size={12} color={t.colors.textMuted} />
                      </>
                    )}
                    <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: isIncrease ? t.colors.status.danger.text : isDecrease ? t.colors.status.success.text : t.colors.textPrimary }}>
                      {req.currency} {Number(req.unit_price).toLocaleString()}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs }}>
                    <Button label="Timeline" size="sm" variant="ghost" icon={<History size={12} color={t.colors.textSecondary} />} onPress={() => setTimelineId(req.id)} />
                    <Button label="Approve" size="sm" icon={<CheckCircle size={12} color="#fff" />} onPress={() => { setRemark(''); setDecisionModal({ req, approve: true }); }} disabled={decidingId === req.id} />
                    <Button label="Reject" size="sm" variant="danger" icon={<XCircle size={12} color="#fff" />} onPress={() => { setRemark(''); setDecisionModal({ req, approve: false }); }} disabled={decidingId === req.id} />
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {history.length > 0 && (
          <View>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.sm }}>Recent Decisions</Text>
            <View style={{ gap: t.spacing.xs }}>
              {history.map((req) => (
                <View key={req.id} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.xs }}>
                  {req.status === 'APPROVED' ? <CheckCircle size={14} color={t.colors.status.success.text} /> : <XCircle size={14} color={t.colors.status.danger.text} />}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.textPrimary }} numberOfLines={1}>
                      {req.product_name} — {req.currency} {Number(req.unit_price).toLocaleString()}
                    </Text>
                    <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{req.requested_by_name || 'Management'}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      <Sheet
        open={!!decisionModal}
        onClose={() => setDecisionModal(null)}
        title={decisionModal?.approve ? 'Approve Price Change' : 'Reject Price Change'}
        subtitle={decisionModal?.req.product_name}
        side="bottom"
        maxHeight={360}
        footer={
          <Button
            label={decisionModal?.approve ? 'Confirm Approve' : 'Confirm Reject'}
            variant={decisionModal?.approve ? 'primary' : 'danger'}
            onPress={confirmDecision}
            disabled={decisionModal ? !decisionModal.approve && !remark.trim() : true}
            loading={!!decidingId}
            fullWidth
          />
        }
      >
        <Field label={`Remark ${decisionModal?.approve ? '(optional)' : '(required)'}`}>
          <Input
            value={remark}
            onChangeText={setRemark}
            multiline
            numberOfLines={4}
            placeholder={decisionModal?.approve ? 'Optional note...' : 'Why is this price change being rejected?'}
            style={{ minHeight: 96, textAlignVertical: 'top' }}
          />
        </Field>
      </Sheet>

      <RequestTimelineSheet open={!!timelineId} onClose={() => setTimelineId(null)} referenceId={timelineId || ''} />
    </Screen>
  );
}
