// rebma-mobile/lib/sendNotification.ts
// Mobile mirror of rebma-web/src/utils/sendNotification.ts — same
// `notifications` table, same shape. Used to notify one specific person
// (recipientId) or a whole department (recipientDepartment); pass either
// or both.
import { supabase } from './supabaseClient';

export async function sendNotification({
  recipientId,
  recipientDepartment,
  title,
  message,
  type = 'info',
  actionUrl,
  actionLabel,
}: {
  recipientId?: string | null;
  recipientDepartment?: string | null;
  title: string;
  message: string;
  type?: string;
  actionUrl?: string;
  actionLabel?: string;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('notifications').insert({
      recipient_id: recipientId ?? null,
      recipient_department: recipientDepartment ?? null,
      sender_id: user?.id ?? null,
      sender_name: user?.email ?? null,
      title,
      message,
      type,
      action_url: actionUrl ?? null,
      action_label: actionLabel ?? null,
      read: false,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('sendNotification error:', err);
  }
}
