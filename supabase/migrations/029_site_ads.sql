-- =====================================================================
-- إعلانات مباشرة من براندات (سعر ثابت). يلزم تشغيل 001 قبله.
-- شغّل الملف مرة واحدة في Supabase → SQL Editor. آمن لو اتشغّل أكثر من مرة.
-- =====================================================================
create table if not exists public.site_ads (
  id          uuid primary key default gen_random_uuid(),
  advertiser  text not null,
  placement   text not null check (placement in ('home_top','products_top','product_page','footer_top')),
  kind        text not null default 'image' check (kind in ('image','video')),
  media_url   text not null,
  link_url    text,
  price       numeric not null default 0,
  starts_on   date not null default current_date,
  ends_on     date not null,
  is_active   boolean not null default true,
  impressions bigint not null default 0,
  clicks      bigint not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists site_ads_place_idx on public.site_ads (placement, is_active, starts_on, ends_on);

alter table public.site_ads enable row level security;

drop policy if exists site_ads_public_select on public.site_ads;
create policy site_ads_public_select on public.site_ads for select
  using (is_active and current_date between starts_on and ends_on);

drop policy if exists site_ads_staff_all on public.site_ads;
create policy site_ads_staff_all on public.site_ads for all
  using (public.is_owner() or public.has_permission('ads'))
  with check (public.is_owner() or public.has_permission('ads'));

-- عدّاد المشاهدات والنقرات (الزائر ما يقدر يعدّل الجدول مباشرة)
create or replace function public.ad_view(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.site_ads set impressions = impressions + 1
   where id = p_id and is_active and current_date between starts_on and ends_on;
$$;
create or replace function public.ad_click(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare u text;
begin
  update public.site_ads set clicks = clicks + 1
   where id = p_id and is_active and current_date between starts_on and ends_on
   returning link_url into u;
  return u;
end;
$$;
grant execute on function public.ad_view(uuid) to anon, authenticated;
grant execute on function public.ad_click(uuid) to anon, authenticated;
