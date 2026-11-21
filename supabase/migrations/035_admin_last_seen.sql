-- متابعة الأدمن: آخر ظهور لكل أدمن. شغّله مرة واحدة في Supabase → SQL Editor. آمن لو اتشغّل أكثر من مرة.
alter table public.profiles add column if not exists last_seen_at timestamptz;

create or replace function public.touch_seen() returns void
language sql security definer set search_path = public as $$
  update public.profiles set last_seen_at = now()
   where id = auth.uid() and (last_seen_at is null or last_seen_at < now() - interval '1 minute');
$$;
grant execute on function public.touch_seen() to authenticated;
