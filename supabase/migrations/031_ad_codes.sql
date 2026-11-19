-- أكواد الإعلانات (Adsterra / Monetag ...) بتشغيل وإيقاف من لوحة الأدمن. يلزم تشغيل 001.
-- شغّل الملف مرة واحدة في Supabase → SQL Editor. آمن لو اتشغّل أكثر من مرة.
create table if not exists public.ad_codes (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  type         text not null check (type in ('script','container','banner','link')),
  src          text,
  container_id text,
  ad_key       text,
  width        int,
  height       int,
  link_url     text,
  link_label   text,
  placement    text not null default 'footer_top',
  is_active    boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
alter table public.ad_codes enable row level security;

drop policy if exists ad_codes_public_select on public.ad_codes;
create policy ad_codes_public_select on public.ad_codes for select using (is_active);
drop policy if exists ad_codes_staff_select on public.ad_codes;
create policy ad_codes_staff_select on public.ad_codes for select using (public.is_owner() or public.has_permission('ad_codes'));
drop policy if exists ad_codes_owner_insert on public.ad_codes;
create policy ad_codes_owner_insert on public.ad_codes for insert with check (public.is_owner());
drop policy if exists ad_codes_owner_delete on public.ad_codes;
create policy ad_codes_owner_delete on public.ad_codes for delete using (public.is_owner());
-- التشغيل والإيقاف: المالك أو الأدمن اللي معاه صلاحية «تشغيل وإيقاف الإعلانات التلقائية»
drop policy if exists ad_codes_toggle on public.ad_codes;
create policy ad_codes_toggle on public.ad_codes for update
  using (public.is_owner() or public.has_permission('ad_codes'))
  with check (public.is_owner() or public.has_permission('ad_codes'));

-- الأكواد اللي مركّبة حاليًا في الموقع (عشان تظهر وتتحكم فيها)
insert into public.ad_codes (name, type, src, container_id, ad_key, width, height, link_url, link_label, placement, sort_order)
select * from (values
  ('Adsterra — بانر Native (أسفل الصفحات)', 'container', 'https://bauval.org/21/f26c277b56a180add6c7a07c55fa278d', 'container-f26c277b56a180add6c7a07c55fa278d', null::text, null::int, null::int, null::text, null::text, 'footer_top', 1),
  ('Adsterra — سكربت', 'script', 'https://abscloud.org/1/ace67a975a55b3a1fa8964b47d3e47a8', null, null, null, null, null, null, 'global', 2),
  ('Adsterra — بانر 728×90', 'banner', 'https://bauval.org/22/59ef69cd4f8e5a0386e09869187b07d1', null, '59ef69cd4f8e5a0386e09869187b07d1', 728, 90, null, null, 'products_top', 3),
  ('Adsterra — رابط مباشر', 'link', null, null, null, null, null, 'https://araplhn.org/4/d265e280d9d8b4e1e38183646164b2b3', '🎁 عروض مميزة', 'footer_top', 4)
) as v(name,type,src,container_id,ad_key,width,height,link_url,link_label,placement,sort_order)
where not exists (select 1 from public.ad_codes);
