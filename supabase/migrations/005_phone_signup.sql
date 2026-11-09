-- =====================================================================
-- التسجيل برقم الهاتف: الحساب يُخزَّن ببريد داخلي (...@phone.invalid) ولا يُعرض كبريد حقيقي
-- شغّل مرة واحدة في Supabase → SQL Editor (بعد 002). آمن لو اتشغّل أكثر من مرة.
-- =====================================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, email, full_name, phone, governorate)
  values (
    new.id,
    case when new.email like '%@phone.invalid' then null else new.email end,
    nullif(trim(coalesce(v_meta->>'full_name', v_meta->>'name', '')), ''),
    nullif(left(trim(coalesce(v_meta->>'phone', '')), 20), ''),
    nullif(left(trim(coalesce(v_meta->>'governorate', '')), 80), '')
  )
  on conflict (id) do nothing;
  return new;
end $$;
