-- =====================================================================
-- بوت تليجرام: يجمع الصور والأسعار من الرسائل ويطلّع ملف إكسل بنسبة ربح تحددها
-- شغّل هذا الملف كاملًا مرة واحدة في Supabase → SQL Editor. آمن لو اتشغّل أكثر من مرة.
-- =====================================================================
create table if not exists public.telegram_items (
  id             uuid primary key default gen_random_uuid(),
  chat_id        bigint not null,
  message_id     bigint not null,
  media_group_id text,
  source         text,                       -- اسم الجروب/القناة المصدر
  name           text,
  description    text,
  price          numeric(12, 2),             -- السعر الأصلي كما ورد في الرسالة
  images         text[] not null default '{}',
  exported_at    timestamptz,
  created_at     timestamptz not null default now(),
  unique (chat_id, message_id)
);
create unique index if not exists telegram_items_group_unique
  on public.telegram_items (chat_id, media_group_id) where media_group_id is not null;
create index if not exists telegram_items_pending_idx on public.telegram_items (exported_at, created_at);

create table if not exists public.telegram_state (
  key   text primary key,
  value text not null
);

-- لا توجد سياسات: الوصول من السيرفر فقط (service role)
alter table public.telegram_items enable row level security;
alter table public.telegram_state enable row level security;
