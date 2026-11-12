-- مراحل الملف (inbox = ملفات جديدة في صفحة «الملفات»، draft = في المسودات، public = منشور) + تعديل جماعي للسعر
-- شغّله مرة واحدة في Supabase → SQL Editor (بعد 020). آمن لو اتشغّل أكثر من مرة.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'product_files' and column_name = 'stage') then
    alter table public.product_files add column stage text not null default 'draft';
    update public.product_files set stage = case when is_public then 'public' when source = 'bot' then 'inbox' else 'draft' end;
  end if;
end $$;

-- تعديل سعر جماعي: p_set = سعر ثابت جديد (أو null)، p_add = زيادة/نقصان بالجنيه (أو null)
create or replace function public.bulk_edit_price(p_ids uuid[], p_set numeric, p_add numeric) returns integer
language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_permission('drafts_edit') or public.has_permission('products')) then raise exception 'forbidden'; end if;
  if p_set is not null and (p_set < 1 or p_set > 10000000) then raise exception 'bad_price'; end if;
  if p_add is not null and abs(p_add) > 10000000 then raise exception 'bad_add'; end if;
  update public.products
     set price = greatest(coalesce(p_set, price) + coalesce(p_add, 0), 1),
         base_price = case
           when p_set is not null then null
           when p_add is not null and base_price is not null then greatest(base_price + p_add, 0)
           else base_price end
   where id = any (p_ids);
  update public.products set compare_at_price = null where id = any (p_ids) and compare_at_price is not null and compare_at_price < price;
  return coalesce(cardinality(p_ids), 0);
end $$;
revoke execute on function public.bulk_edit_price(uuid[], numeric, numeric) from public, anon;
grant execute on function public.bulk_edit_price(uuid[], numeric, numeric) to authenticated;

-- الأدمن اللي معاه «المنتجات» يفضل يشوف صفحة «الملفات» الجديدة
update public.profiles
set permissions = (select array(select distinct unnest(permissions || array['files'])))
where role = 'admin' and 'products' = any (permissions);
