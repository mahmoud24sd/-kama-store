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
