-- خانة «أنا فقط» في الأقسام: القسم يختفي من الموقع للزوار ويفضل ظاهر في لوحة الأدمن.
-- شغّل الملف مرة واحدة في Supabase → SQL Editor. آمن لو اتشغّل أكثر من مرة.
alter table public.categories add column if not exists admin_only boolean not null default false;
