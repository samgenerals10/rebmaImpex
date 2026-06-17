import { supabase } from '../lib/supabaseClient';

export async function sendNotification({
  recipientId,
  recipientDepartment,
  title,
  message,
  type = 'info',
  actionUrl,
  actionLabel,
}: {
  recipientId?: string;
  recipientDepartment?: string;
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
