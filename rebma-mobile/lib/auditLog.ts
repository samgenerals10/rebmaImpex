// rebma-mobile/lib/auditLog.ts
//
// Direct correction: "the workflow doesn't even get to delivery... every
// department should track the workflow... the workflow should end at the
// customer's destination." Traced the real cause — `delivery_logs` audit
// events (dispatch, POD submitted, POD approved/rejected, delivery
// failed) were being written with `reference_id = delivery_logs.id`,
// while the rest of that same order's lifecycle (creation, Risk
// approval, Finance payment) is written with `reference_id = orders.id`.
// Two different ids for one workflow means `RequestTimelineSheet`
// (which filters by one reference_id) could never show both halves —
// the order's own timeline always stopped right before dispatch, and a
// delivery's own timeline never showed how the order got there. One
// shared resolver so every delivery-stage write anchors to the ORDER,
// which is the one id that spans the whole thing from creation to
// delivered.
import { supabase } from './supabaseClient';

// Cargo intake and orders are each their own real record with their own
// id — audit entries for those write reference_id = their own id
// directly, no resolution needed. This resolver is specifically for
// delivery_logs rows, which are a step INSIDE an order's own workflow,
// not a separate workflow of their own.
export async function resolveOrderReferenceId(deliveryLogId: string, knownOrderId?: string | null): Promise<string> {
  if (knownOrderId) return knownOrderId;
  const { data } = await supabase.from('delivery_logs').select('order_id').eq('id', deliveryLogId).maybeSingle();
  return data?.order_id || deliveryLogId;
}

export interface WorkflowLogEntry {
  referenceId: string;
  department: string;
  action: string;
  performedBy: string;
  details?: string | null;
}

export async function logWorkflowEvent(entry: WorkflowLogEntry): Promise<void> {
  await supabase.from('global_audit_history').insert([{
    department: entry.department,
    action: entry.action,
    performed_by: entry.performedBy,
    reference_id: entry.referenceId,
    details: entry.details ?? null,
    timestamp: new Date().toISOString(),
  }]);
}

// Delivery-stage convenience wrapper — resolves to the order's id first,
// so every dispatch/POD/failure event lands on the ORDER's own timeline,
// not a separate, disconnected delivery-only one.
export async function logDeliveryWorkflowEvent(
  deliveryLogId: string,
  action: string,
  performedBy: string,
  knownOrderId?: string | null,
  details?: string | null
): Promise<void> {
  const referenceId = await resolveOrderReferenceId(deliveryLogId, knownOrderId);
  await logWorkflowEvent({ referenceId, department: 'ADMIN_WAREHOUSE', action, performedBy, details });
}
