-- ملفات المنتجات (كل ملف مرفوع/من البوت = مجموعة)، سلة المهملات، وصلاحية النشر من البوت
-- شغّله مرة واحدة في Supabase → SQL Editor (بعد 003 و 016). آمن لو اتشغّل أكثر من مرة.

create table if not exists public.product_files (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  source      text not null default 'import',        -- import (ملف مرفوع) | bot (من بوت تليجرام)
  markup      numeric(12, 2) not null default 0,      -- الزيادة (جنيه) على كل منتج في الملف
  is_public   boolean not null default false,         -- ظاهر للعلن كمجموعة
  tg_by       bigint,                                 -- رقم تليجرام لمن رفعه من البوت
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists product_files_created_idx on public.product_files (created_at desc);

alter table public.products add column if not exists file_id    uuid references public.product_files(id) on delete set null;
alter table public.products add column if not exists base_price numeric(12, 2);   -- السعر قبل زيادة الملف
alter table public.products add column if not exists deleted_at timestamptz;      -- المهملات
create index if not exists products_file_idx    on public.products (file_id);
create index if not exists products_deleted_idx on public.products (deleted_at) where deleted_at is not null;

alter table public.product_files enable row level security;
drop policy if exists product_files_select on public.product_files;
create policy product_files_select on public.product_files for select using (
  (is_public and deleted_at is null) or public.has_permission('products') or public.has_permission('bot_publish')
);
drop policy if exists product_files_write on public.product_files;
create policy product_files_write on public.product_files for all
  using (public.has_permission('products') or public.has_permission('bot_publish'))
  with check (public.has_permission('products') or public.has_permission('bot_publish'));

-- تعديل زيادة الملف: السعر الجديد = السعر الأصلي + الزيادة، لكل منتجات الملف
create or replace function public.apply_file_markup(p_file uuid, p_markup numeric) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not (public.has_permission('products') or public.has_permission('bot_publish')) then raise exception 'forbidden'; end if;
  if p_markup < 0 or p_markup > 1000000 then raise exception 'bad_markup'; end if;
  update public.product_files set markup = p_markup where id = p_file;
  update public.products
     set price = base_price + p_markup,
         compare_at_price = case when compare_at_price is not null and compare_at_price < base_price + p_markup then null else compare_at_price end
   where file_id = p_file and base_price is not null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.apply_file_markup(uuid, numeric) from public, anon;
grant execute on function public.apply_file_markup(uuid, numeric) to authenticated;
