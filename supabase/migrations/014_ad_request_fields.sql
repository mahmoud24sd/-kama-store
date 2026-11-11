-- =====================================================================
-- طلبات الإعلان: نوع الإعلان + السعر المعروض. يلزم تشغيل 007 قبله.
-- شغّل هذا الملف مرة واحدة في Supabase → SQL Editor. آمن لو اتشغّل أكثر من مرة.
-- =====================================================================
alter table public.ad_requests add column if not exists ad_type  text check (ad_type is null or char_length(ad_type) <= 60);
alter table public.ad_requests add column if not exists ad_price numeric(12, 2) check (ad_price is null or ad_price >= 0);
