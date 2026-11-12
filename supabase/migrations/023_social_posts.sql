-- طابور النشر التلقائي على فيسبوك وانستجرام. شغّله مرة واحدة في Supabase → SQL Editor.
create table if not exists public.social_posts (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  platform    text not null check (platform in ('facebook', 'instagram')),
  status      text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts    integer not null default 0,
  error       text,
  external_id text,
  created_at  timestamptz not null default now(),
  posted_at   timestamptz,
  unique (product_id, platform)
);
create index if not exists social_posts_queue_idx on public.social_posts (platform, status, created_at);
alter table public.social_posts enable row level security;
drop policy if exists social_posts_select on public.social_posts;
create policy social_posts_select on public.social_posts for select using (public.has_permission('social'));
-- الكتابة من السيرفر فقط (service role)
