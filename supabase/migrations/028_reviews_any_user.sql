-- أي مستخدم مسجّل دخول يقدر يقيّم المنتج بالنجوم (من غير شرط إنه اشتراه من الموقع).
-- شغّل الملف مرة واحدة في Supabase → SQL Editor. آمن لو اتشغّل أكثر من مرة.
drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews for insert with check (user_id = auth.uid());
