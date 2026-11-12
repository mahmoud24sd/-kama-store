-- Telegram bot + permissions + speed + visits: run once (012,013,015,016,017,018)

-- ===== 012 =====
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

-- ===== 013 =====
-- =====================================================================
-- بوت تليجرام: سحب منشورات قناة عامة من اللينك (آخر N يوم). يلزم تشغيل 012 أولًا.
-- شغّل هذا الملف مرة واحدة في Supabase → SQL Editor. آمن لو اتشغّل أكثر من مرة.
-- =====================================================================
alter table public.telegram_items add column if not exists posted_at timestamptz;
alter table public.telegram_items add column if not exists post_url  text;

-- ===== 015 =====
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

-- ===== 016 =====
-- =====================================================================
-- صلاحيات جديدة لكل صفحات اللوحة. شغّل هذا الملف مرة واحدة في Supabase → SQL Editor. آمن لو اتشغّل أكثر من مرة.
-- يلزم تشغيل 007 و 011 قبله.
-- =====================================================================

-- 1) السماح لمن عنده الصلاحية (وليس المالك فقط) بالوصول لهذه الجداول
drop policy if exists ad_requests_owner on public.ad_requests;
drop policy if exists ad_requests_staff on public.ad_requests;
create policy ad_requests_staff on public.ad_requests for all
  using (public.is_owner() or public.has_permission('ads'))
  with check (public.is_owner() or public.has_permission('ads'));

drop policy if exists product_sources_owner on public.product_sources;
drop policy if exists product_sources_staff on public.product_sources;
create policy product_sources_staff on public.product_sources for all
  using (public.is_owner() or public.has_permission('sources'))
  with check (public.is_owner() or public.has_permission('sources'));

drop policy if exists settings_owner on public.app_settings;
drop policy if exists settings_staff on public.app_settings;
create policy settings_staff on public.app_settings for all
  using (public.is_owner() or public.has_permission('settings'))
  with check (public.is_owner() or public.has_permission('settings'));

-- 2) الأدمن الحاليون كانوا يدخلون هذه الصفحات بدون صلاحية، فنمنحهم إياها حتى لا تتعطل عليهم
--    (تقدر تسحبها من أي أدمن من «الفريق والصلاحيات»)
update public.profiles
set permissions = (
  select array(select distinct unnest(permissions || array['orders', 'products', 'inventory', 'offers', 'reviews']))
)
where role = 'admin';

-- ===== 017 =====
-- =====================================================================
-- فهارس لتسريع صفحات المنتجات والبحث والإحصائيات. آمنة لو اتشغّلت أكثر من مرة.
-- شغّل هذا الملف مرة واحدة في Supabase → SQL Editor.
-- =====================================================================
create extension if not exists pg_trgm;

-- بحث بالاسم (ilike '%كلمة%') يستخدم هذا الفهرس بدل مسح الجدول كله
create index if not exists products_name_trgm_idx on public.products using gin (name gin_trgm_ops);

-- القوائم الأكثر استخدامًا: منتجات مفعّلة مرتبة بالأحدث / الأكثر مبيعًا / العروض
create index if not exists products_active_created_idx  on public.products (is_active, created_at desc);
create index if not exists products_active_sold_idx     on public.products (is_active, sold_count desc);
create index if not exists products_active_category_idx on public.products (is_active, category_id);
create index if not exists products_active_deal_idx     on public.products (is_active, is_deal) where is_deal;
create index if not exists products_active_rating_idx   on public.products (is_active, rating_avg desc, rating_count desc);

analyze public.products;

-- ===== 018 =====
-- =====================================================================
-- عدد الزيارات يظهر فقط لمن عنده صلاحية «عدد الزيارات» (والمالك). يلزم تشغيل 007 و 001 قبله.
-- شغّل هذا الملف مرة واحدة في Supabase → SQL Editor. آمن لو اتشغّل أكثر من مرة.
-- =====================================================================
create or replace function public.admin_visits() returns bigint
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_owner() or public.has_permission('visits')) then
    raise exception 'forbidden';
  end if;
  return coalesce((select value from public.site_counters where key = 'visits'), 0);
end;
$$;

revoke all on function public.admin_visits() from public, anon;
grant execute on function public.admin_visits() to authenticated;

-- القراءة العامة لم تعد لازمة: الزائر فقط يُسجَّل (track_visit) ولا يستطيع قراءة العدد
revoke execute on function public.get_visits() from anon, authenticated;
