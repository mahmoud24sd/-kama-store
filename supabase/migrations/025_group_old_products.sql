-- يحوّل المنتجات القديمة المرفوعة دفعة واحدة (من غير ملف) لفولدرات حقيقية، عشان تتعدّل مرة واحدة.
-- كل مجموعة = نفس الشخص اللي نشر + نفس الدقيقة + نفس الحالة (3 منتجات فأكتر).
-- شغّله مرة واحدة بعد 020 و024. آمن لو اتشغّل أكتر من مرة (اللي له فولدر ما بيتلمسش).
do $$
declare g record; fid uuid;
begin
  for g in
    select published_by as uid, date_trunc('minute', coalesce(published_at, created_at)) as at, is_active, count(*) as c
    from public.products
    where file_id is null and deleted_at is null
    group by 1, 2, 3
    having count(*) >= 3
  loop
    insert into public.product_files (name, source, markup, is_public, stage, created_by, created_at)
    values ('ملف ' || to_char(g.at at time zone 'Africa/Cairo', 'DD/MM HH24:MI'), 'import', 0, g.is_active, case when g.is_active then 'public' else 'draft' end, g.uid, g.at)
    returning id into fid;
    update public.products set file_id = fid, base_price = price
    where file_id is null and deleted_at is null and is_active = g.is_active
      and published_by is not distinct from g.uid
      and date_trunc('minute', coalesce(published_at, created_at)) = g.at;
  end loop;
end $$;

-- الأدمن اللي معاه «المنتجات» يقدر يعدّل جماعي
update public.profiles
set permissions = (select array(select distinct unnest(permissions || array['drafts_edit'])))
where role = 'admin' and 'products' = any (permissions);
