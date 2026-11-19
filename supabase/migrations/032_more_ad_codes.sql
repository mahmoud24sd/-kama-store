-- إضافة أكواد Adsterra الجديدة لصفحة «أكواد الإعلانات». يلزم تشغيل 031 قبله.
-- بيتخطّى أي كود موجود بالفعل. شغّله مرة واحدة في Supabase → SQL Editor.
insert into public.ad_codes (name, type, src, container_id, ad_key, width, height, link_url, link_label, placement, is_active, sort_order)
select * from (values
  ('Adsterra — سكربت إضافي (bauval /14)', 'script', 'https://bauval.org/14/398f49461dea45ab1837f6c571544b12', null::text, null::text, null::int, null::int, null::text, null::text, 'global', true, 5),
  ('Adsterra — بانر 468×60', 'banner', 'https://bauval.org/22/22cf432aa39d3cd8bc1b466e3e90d4bf', null, '22cf432aa39d3cd8bc1b466e3e90d4bf', 468, 60, null, null, 'home_middle', true, 6),
  ('Adsterra — مستطيل 300×250', 'banner', 'https://bauval.org/22/f6d21705c681fe9e7c3605340423c686', null, 'f6d21705c681fe9e7c3605340423c686', 300, 250, null, null, 'product_page', true, 7),
  ('Adsterra — بانر موبايل 320×50', 'banner', 'https://bauval.org/22/f400055786c71a30b88dda8420cb0aea', null, 'f400055786c71a30b88dda8420cb0aea', 320, 50, null, null, 'products_top', true, 8),
  ('Adsterra — طولي 160×600 (موقوف)', 'banner', 'https://bauval.org/22/1190e10bd58a4fceca65fcff44a31c5c', null, '1190e10bd58a4fceca65fcff44a31c5c', 160, 600, null, null, 'home_bottom', false, 9),
  ('Adsterra — طولي 160×300 (موقوف)', 'banner', 'https://bauval.org/22/d93d2c57fbc336e2667d00c4b047fc53', null, 'd93d2c57fbc336e2667d00c4b047fc53', 160, 300, null, null, 'home_bottom', false, 10)
) as v(name,type,src,container_id,ad_key,width,height,link_url,link_label,placement,is_active,sort_order)
where not exists (select 1 from public.ad_codes c where c.src = v.src);
