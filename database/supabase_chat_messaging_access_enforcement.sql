-- supabase_chat_messaging_access_enforcement.sql
--
-- Security fix. The CEO's messaging switches were only checked by the apps'
-- screens, so a blocked account could still send messages by calling the
-- database directly. This adds a database guard that runs before every new
-- chat message, next to the existing block/suspension/invite guard
-- (chat_messages_enforce_access), which is left untouched.
--
-- Same rule the apps already show:
--   1. Messaging Access (ceo_settings 'messaging_access_allowed'): a
--      per-person exception in ceo_feature_exceptions wins; otherwise the
--      master switch decides. On unless the CEO turned it off.
--   2. The chat-type switches: 'global_chat_enabled' (Everyone),
--      'department_chat_enabled' (groups), 'direct_messages_enabled' (direct
--      chats). Each is on unless the CEO turned it off.
-- Old Boardroom mailbox rows (no channel) and server-side inserts (no
-- signed-in person) are not affected, same as the existing guard.
-- Safe to run more than once.

-- True unless the setting exists and is explicitly false.
create or replace function public.ceo_flag_on(p_key text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select (setting_value #>> '{}') is distinct from 'false' from public.ceo_settings where setting_key = p_key),
    true
  );
$$;

create or replace function public.enforce_messaging_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_exception boolean;
  v_type text;
begin
  if new.channel_id is null or v_sender is null then return new; end if;

  -- 1. Messaging Access: personal exception first, then the master switch.
  select e.allowed into v_exception
  from public.ceo_feature_exceptions e
  where e.feature_key = 'messaging_access_allowed' and lower(e.user_email) = v_email
  limit 1;
  if coalesce(v_exception, public.ceo_flag_on('messaging_access_allowed')) = false then
    raise exception 'Messaging is turned off for your account.';
  end if;

  -- 2. The switch for this kind of chat.
  select type into v_type from public.channels where id::text = new.channel_id::text;
  if (v_type = 'everyone' and not public.ceo_flag_on('global_chat_enabled'))
     or (v_type = 'group' and not public.ceo_flag_on('department_chat_enabled'))
     or (v_type = 'dm' and not public.ceo_flag_on('direct_messages_enabled')) then
    raise exception 'The CEO has turned this kind of chat off.';
  end if;

  return new;
end;
$$;

drop trigger if exists chat_messages_enforce_messaging_access on public.chat_messages;
create trigger chat_messages_enforce_messaging_access
  before insert on public.chat_messages
  for each row execute function public.enforce_messaging_access();
