-- =====================================================================
-- المرحلة 1: المالك + صلاحيات الأدمن + إعدادات التواصل + تتبع التسليم + السحب
-- شغّل هذا الملف كاملًا مرة واحدة في Supabase → SQL Editor (بعد schema.sql).
-- آمن لو اتشغّل أكثر من مرة.
-- =====================================================================

-- ---------- الأدوار والصلاحيات ----------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('customer', 'admin', 'owner'));
alter table public.profiles add column if not exists permissions text[] not null default '{}';

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner');
$$;

-- المالك يُعامل كأدمن في كل سياسات RLS الحالية
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'owner'));
$$;

-- المالك له كل الصلاحيات، والأدمن له الصلاحيات الممنوحة له فقط
create or replace function public.has_permission(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and (role = 'owner' or (role = 'admin' and p = any (permissions)))
  );
$$;

-- تغيير الدور أو الصلاحيات للمالك فقط (التعديل من SQL Editor مسموح لأن auth.uid() يكون null)
create or replace function public.protect_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_owner() then
    if new.role is distinct from old.role then
      raise exception 'forbidden_role_change';
    end if;
    if new.permissions is distinct from old.permissions then
      raise exception 'forbidden_permissions_change';
    end if;
  end if;
  if new.email is distinct from old.email and auth.uid() is not null and not public.is_admin() then
    new.email := old.email;
  end if;
  return new;
end $$;

-- ---------- سجل مراحل الطلب (يراه العميل) ----------
create table if not exists public.order_events (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  status          text not null,
  note            text,
  created_by      uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at      timestamptz not null default now()
);
create index if not exists order_events_order_idx on public.order_events (order_id, created_at);
alter table public.order_events enable row level security;

drop policy if exists order_events_select on public.order_events;
create policy order_events_select on public.order_events for select using (
  public.is_admin()
  or exists (select 1 from public.orders o where o.id = order_events.order_id and o.user_id = auth.uid())
);
drop policy if exists order_events_insert on public.order_events;
create policy order_events_insert on public.order_events for insert with check (public.is_admin());

-- ---------- إعدادات التواصل (قراءة عامة، والتعديل للمالك فقط) ----------
drop policy if exists settings_admin on public.app_settings;
drop policy if exists settings_owner on public.app_settings;
create policy settings_owner on public.app_settings for all
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists settings_public_read on public.app_settings;
create policy settings_public_read on public.app_settings for select using (
  key in ('contact_phone', 'contact_email', 'contact_whatsapp', 'social_facebook', 'social_instagram', 'social_tiktok')
);

insert into public.app_settings (key, value) values
  ('contact_phone', ''), ('contact_email', ''), ('contact_whatsapp', ''),
  ('social_facebook', ''), ('social_instagram', ''), ('social_tiktok', '')
on conflict (key) do nothing;

-- ---------- السحب (الأرباح) ----------
create table if not exists public.withdrawals (
  id              uuid primary key default gen_random_uuid(),
  amount          numeric(12, 2) not null check (amount > 0),
  note            text,
  created_by      uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at      timestamptz not null default now()
);
alter table public.withdrawals enable row level security;

drop policy if exists withdrawals_select on public.withdrawals;
create policy withdrawals_select on public.withdrawals for select using (public.has_permission('withdraw'));
drop policy if exists withdrawals_insert on public.withdrawals;
create policy withdrawals_insert on public.withdrawals for insert with check (public.has_permission('withdraw'));

-- ---------- لجعل حسابك مالكًا (غيّر البريد ثم شغّل السطر) ----------
-- update public.profiles set role = 'owner' where email = 'YOUR-EMAIL@example.com';
