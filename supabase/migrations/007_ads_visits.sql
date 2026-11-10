-- =====================================================================
-- 1) طلبات الإعلان (من يريد الإعلان في الموقع) 2) عدّاد الزيارات
-- شغّل هذا الملف كاملًا مرة واحدة في Supabase → SQL Editor. آمن لو اتشغّل أكثر من مرة.
-- =====================================================================

-- ---------- طلبات الإعلان: أي زائر يرسل طلبًا، والمالك فقط يقرأها ويديرها ----------
create table if not exists public.ad_requests (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 100),
  phone      text not null check (char_length(phone) between 6 and 30),
  email      text check (email is null or char_length(email) <= 200),
  message    text check (message is null or char_length(message) <= 2000),
  is_handled boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.ad_requests enable row level security;

drop policy if exists ad_requests_insert on public.ad_requests;
create policy ad_requests_insert on public.ad_requests for insert to anon, authenticated with check (true);
drop policy if exists ad_requests_owner on public.ad_requests;
create policy ad_requests_owner on public.ad_requests for all using (public.is_owner()) with check (public.is_owner());

-- ---------- عدّاد الزيارات: لا وصول مباشر للجدول، فقط عبر الدالتين ----------
create table if not exists public.site_counters (
  key   text primary key,
  value bigint not null default 0
);
insert into public.site_counters (key, value) values ('visits', 0) on conflict (key) do nothing;
alter table public.site_counters enable row level security;

create or replace function public.track_visit() returns bigint
language sql security definer set search_path = public as $$
  update public.site_counters set value = value + 1 where key = 'visits' returning value;
$$;

create or replace function public.get_visits() returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.site_counters where key = 'visits'), 0);
$$;

grant execute on function public.track_visit() to anon, authenticated;
grant execute on function public.get_visits() to anon, authenticated;
