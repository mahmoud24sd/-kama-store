-- سجل محادثات أدمن البوت مع البوت (للمالك يشوفه من البوت). شغّله مرة واحدة في Supabase → SQL Editor. آمن لو اتشغّل أكثر من مرة.
create table if not exists public.telegram_log (
  id         bigserial primary key,
  tg_id      bigint not null,
  dir        text not null check (dir in ('in','out')),
  text       text not null,
  created_at timestamptz not null default now()
);
create index if not exists telegram_log_idx on public.telegram_log (tg_id, created_at desc);
-- مفيش سياسات = الوصول بس عن طريق السيرفر (service role). محدش من الموقع يقدر يقراه.
alter table public.telegram_log enable row level security;
