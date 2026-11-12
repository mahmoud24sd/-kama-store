-- =====================================================================
-- عدد الزيارات يظهر فقط لمن عنده صلاحية «عدد الزيارات» (والمالك). يلزم تشغيل 007 و 001 قبله.
-- شغّل هذا الملف مرة واحدة في Supabase → SQL Editor. آمن لو اتشغّل أكثر من مرة.
-- =====================================================================
create or replace function public.admin_visits() returns bigint
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_owner() or public.has_permission('visits')) then
    raise exception 'forbidden';
  end if;
  return coalesce((select value from public.site_counters where key = 'visits'), 0);
end;
$$;

revoke all on function public.admin_visits() from public, anon;
grant execute on function public.admin_visits() to authenticated;

-- القراءة العامة لم تعد لازمة: الزائر فقط يُسجَّل (track_visit) ولا يستطيع قراءة العدد
revoke execute on function public.get_visits() from anon, authenticated;
