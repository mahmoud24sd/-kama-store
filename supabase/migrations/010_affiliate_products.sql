-- =====================================================================
-- منتجات الأفيليت (أمازون): المنتج له رابط خارجي، والشراء يتم على أمازون وليس من سلة الموقع
-- شغّل هذا الملف كاملًا مرة واحدة في Supabase → SQL Editor. آمن لو اتشغّل أكثر من مرة.
-- =====================================================================
alter table public.products add column if not exists affiliate_url    text;
alter table public.products add column if not exists affiliate_source text;   -- مثال: amazon
alter table public.products add column if not exists external_id      text;    -- مثال: ASIN، لمنع تكرار نفس المنتج
create unique index if not exists products_external_unique
  on public.products (affiliate_source, external_id) where external_id is not null;
