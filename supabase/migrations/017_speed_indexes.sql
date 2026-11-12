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
