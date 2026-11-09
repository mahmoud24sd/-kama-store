-- =====================================================================
-- التسجيل: رقم الهاتف + المحافظة + دعم الدخول عبر Google / Facebook
-- شغّل هذا الملف كاملًا مرة واحدة في Supabase → SQL Editor (بعد 001).
-- آمن لو اتشغّل أكثر من مرة.
-- =====================================================================

alter table public.profiles add column if not exists governorate text;

-- ينشئ ملف المستخدم تلقائيًا. الصلاحية دائمًا customer ولا تُقرأ من بيانات المتصفح.
-- الاسم: full_name (تسجيل عادي) أو name (Google / Facebook)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, email, full_name, phone, governorate)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(v_meta->>'full_name', v_meta->>'name', '')), ''),
    nullif(left(trim(coalesce(v_meta->>'phone', '')), 20), ''),
    nullif(left(trim(coalesce(v_meta->>'governorate', '')), 80), '')
  )
  on conflict (id) do nothing;
  return new;
end $$;
