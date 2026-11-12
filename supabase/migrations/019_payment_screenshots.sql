-- اسكرينات إثبات دفع رسم النشر + صلاحية «الاسكرينات»
-- شغّله مرة واحدة في Supabase → SQL Editor (بعد 003). آمن لو اتشغّل أكثر من مرة.
alter table public.publish_requests add column if not exists screenshot_path text;

-- bucket خاص (مش عام): الصور تُعرض فقط عبر روابط مؤقتة للمالك أو من عنده الصلاحية
insert into storage.buckets (id, name, public)
values ('payment-screenshots', 'payment-screenshots', false)
on conflict (id) do update set public = false;
