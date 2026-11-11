-- =====================================================================
-- ربط متاجر خارجية: سحب منتجاتها تلقائيًا لموقعك (Shopify / WooCommerce) بدون حذف أي منتج
-- يلزم تشغيل ملف 010 أولًا. شغّل هذا الملف مرة واحدة في Supabase → SQL Editor. آمن لو اتشغّل أكثر من مرة.
-- =====================================================================
create table if not exists public.product_sources (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  kind            text not null check (kind in ('shopify', 'woocommerce')),
  base_url        text not null,                       -- مثال: https://store.example.com
  category_id     uuid references public.categories(id) on delete set null,
  markup_percent  numeric(6, 2) not null default 0 check (markup_percent >= -90 and markup_percent <= 1000),
  rate            numeric(12, 4) not null default 1 check (rate > 0),   -- سعر صرف عملة المتجر إلى الجنيه
  per_run         int not null default 50 check (per_run between 1 and 200),
  is_active       boolean not null default true,
  cursor_page     int not null default 1,
  imported_total  int not null default 0,
  last_run_at     timestamptz,
  last_status     text,
  created_at      timestamptz not null default now()
);
alter table public.product_sources enable row level security;
drop policy if exists product_sources_owner on public.product_sources;
create policy product_sources_owner on public.product_sources for all
  using (public.is_owner()) with check (public.is_owner());
