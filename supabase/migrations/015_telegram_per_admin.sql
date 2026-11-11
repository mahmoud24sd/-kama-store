-- =====================================================================
-- بوت تليجرام: كل أدمن يرى منتجاته فقط (لا يرى منتجات غيره). يلزم تشغيل 012 و013 قبله.
-- شغّل هذا الملف مرة واحدة في Supabase → SQL Editor. آمن لو اتشغّل أكثر من مرة.
-- =====================================================================
alter table public.telegram_items add column if not exists added_by bigint not null default 0;  -- رقم تليجرام لمن أضافها

alter table public.telegram_items drop constraint if exists telegram_items_chat_id_message_id_key;
drop index if exists public.telegram_items_group_unique;

create unique index if not exists telegram_items_msg_unique   on public.telegram_items (chat_id, message_id, added_by);
create unique index if not exists telegram_items_group_unique on public.telegram_items (chat_id, media_group_id, added_by) where media_group_id is not null;
create index if not exists telegram_items_owner_idx           on public.telegram_items (added_by, exported_at, created_at);
