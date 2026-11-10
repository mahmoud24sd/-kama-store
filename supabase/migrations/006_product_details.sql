-- =====================================================================
-- تفاصيل المنتج: عامة (يراها العميل) + خاصة (يراها الأدمن والمالك فقط)
-- شغّل هذا الملف كاملًا مرة واحدة في Supabase → SQL Editor. آمن لو اتشغّل أكثر من مرة.
-- =====================================================================

-- تفاصيل عامة: سطر لكل خاصية بالشكل «الخاصية: القيمة» (تظهر في صفحة المنتج)
alter table public.products add column if not exists details text;

-- تفاصيل خاصة في جدول منفصل: RLS يسمح للأدمن والمالك فقط، فلا يمكن لأي عميل أو زائر قراءتها
create table if not exists public.product_private (
  product_id uuid primary key references public.products(id) on delete cascade,
  cost_price numeric(12, 2) check (cost_price is null or cost_price >= 0),
  supplier   text,
  notes      text,
  updated_at timestamptz not null default now()
);
alter table public.product_private enable row level security;

drop policy if exists product_private_admin on public.product_private;
create policy product_private_admin on public.product_private for all
  using (public.is_admin()) with check (public.is_admin());
