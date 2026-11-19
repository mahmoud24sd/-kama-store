-- اسم الأدمن اللي جاب كل كود (عشان الفولدرات). شغّله مرة واحدة في Supabase → SQL Editor. آمن لو اتشغّل أكثر من مرة.
alter table public.ad_codes add column if not exists created_by uuid default auth.uid();
