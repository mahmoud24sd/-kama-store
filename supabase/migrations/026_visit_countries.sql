-- =====================================================================
-- إحصائيات الزوار حسب الدولة: يظهر للأدمن اللي عنده صلاحية «عدد الزيارات» (والمالك) فقط.
-- شغّل هذا الملف مرة واحدة في Supabase → SQL Editor. آمن لو اتشغّل أكثر من مرة. يلزم تشغيل 007 و 018 قبله.
-- =====================================================================
create table if not exists public.visit_countries (
  country text primary key,
  visits  bigint not null default 0
);
alter table public.visit_countries enable row level security; -- بدون سياسات: لا وصول مباشر

create or replace function public.track_visit_country(c text) returns void
language plpgsql security definer set search_path = public as $$
begin
  c := upper(left(coalesce(c, ''), 2));
  if c !~ '^[A-Z]{2}$' then c := 'XX'; end if; -- XX = دولة غير معروفة
  insert into public.visit_countries (country, visits) values (c, 1)
  on conflict (country) do update set visits = public.visit_countries.visits + 1;
end;
$$;
revoke all on function public.track_visit_country(text) from public;
grant execute on function public.track_visit_country(text) to anon, authenticated;

create or replace function public.admin_visit_countries() returns table (country text, visits bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_owner() or public.has_permission('visits')) then
    raise exception 'forbidden';
  end if;
  return query select v.country, v.visits from public.visit_countries v order by v.visits desc;
end;
$$;
revoke all on function public.admin_visit_countries() from public, anon;
grant execute on function public.admin_visit_countries() to authenticated;
