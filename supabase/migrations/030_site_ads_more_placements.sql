-- أماكن إعلان أكتر في الموقع. يلزم تشغيل 029 قبله. آمن لو اتشغّل أكثر من مرة.
alter table public.site_ads drop constraint if exists site_ads_placement_check;
alter table public.site_ads add constraint site_ads_placement_check check (placement in (
  'header_top','home_top','home_middle','home_bottom',
  'products_top','products_bottom','product_page','product_bottom','footer_top'));
