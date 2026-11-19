-- صلاحية «إضافة وحذف أكواد الإعلانات» للأدمن اللي المالك يدّيها له. يلزم تشغيل 031.
-- شغّله مرة واحدة في Supabase → SQL Editor. آمن لو اتشغّل أكثر من مرة.
drop policy if exists ad_codes_owner_insert on public.ad_codes;
create policy ad_codes_owner_insert on public.ad_codes for insert
  with check (public.is_owner() or public.has_permission('ad_codes_manage'));
drop policy if exists ad_codes_owner_delete on public.ad_codes;
create policy ad_codes_owner_delete on public.ad_codes for delete
  using (public.is_owner() or public.has_permission('ad_codes_manage'));
drop policy if exists ad_codes_staff_select on public.ad_codes;
create policy ad_codes_staff_select on public.ad_codes for select
  using (public.is_owner() or public.has_permission('ad_codes') or public.has_permission('ad_codes_manage'));
