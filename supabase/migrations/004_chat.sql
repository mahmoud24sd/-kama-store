-- =====================================================================
-- الدردشة: رد آلي في الواجهة + تحويل لشخص (محادثات ورسائل) + إشعار للأدمن
-- شغّل هذا الملف كاملًا مرة واحدة في Supabase → SQL Editor (بعد 001).
-- آمن لو اتشغّل أكثر من مرة.
-- =====================================================================

create table if not exists public.chat_conversations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  customer_name   text,
  -- waiting = العميل طلب شخصًا ولم يُرد عليه بعد | open = الموظف ردّ | closed = مغلقة
  status          text not null default 'waiting' check (status in ('waiting', 'open', 'closed')),
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index if not exists chat_conv_status_idx on public.chat_conversations (status, last_message_at desc);
create index if not exists chat_conv_user_idx on public.chat_conversations (user_id);

create table if not exists public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  sender          text not null check (sender in ('customer', 'staff')),
  sender_name     text,
  body            text not null check (char_length(body) between 1 and 2000),
  created_at      timestamptz not null default now()
);
create index if not exists chat_msg_conv_idx on public.chat_messages (conversation_id, created_at);

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

-- المحادثات: العميل يرى محادثاته، ومن لديه صلاحية chat يرى الكل
drop policy if exists chat_conv_select on public.chat_conversations;
create policy chat_conv_select on public.chat_conversations for select using (
  user_id = auth.uid() or public.has_permission('chat')
);
drop policy if exists chat_conv_insert on public.chat_conversations;
create policy chat_conv_insert on public.chat_conversations for insert with check (
  user_id = auth.uid() and status = 'waiting'
);
drop policy if exists chat_conv_update on public.chat_conversations;
create policy chat_conv_update on public.chat_conversations for update
  using (public.has_permission('chat')) with check (public.has_permission('chat'));

-- الرسائل
drop policy if exists chat_msg_select on public.chat_messages;
create policy chat_msg_select on public.chat_messages for select using (
  public.has_permission('chat')
  or exists (select 1 from public.chat_conversations c where c.id = conversation_id and c.user_id = auth.uid())
);
drop policy if exists chat_msg_insert on public.chat_messages;
create policy chat_msg_insert on public.chat_messages for insert with check (
  (sender = 'customer' and exists (
    select 1 from public.chat_conversations c where c.id = conversation_id and c.user_id = auth.uid()
  ))
  or (sender = 'staff' and public.has_permission('chat'))
);

-- عند وصول رسالة: عميل → waiting (إشعار للأدمن)، موظف → open
create or replace function public.chat_after_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.chat_conversations
     set last_message_at = now(),
         status = case when new.sender = 'customer' then 'waiting' else 'open' end
   where id = new.conversation_id;
  return new;
end $$;
drop trigger if exists chat_msg_after_insert on public.chat_messages;
create trigger chat_msg_after_insert after insert on public.chat_messages
  for each row execute function public.chat_after_message();
