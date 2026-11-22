-- عداد إحالات الأدمن. شغّله مرة واحدة في Supabase → SQL Editor. آمن لو اتشغّل أكثر من مرة.
create table if not exists public.ref_events (
  id bigserial primary key,
  admin_id uuid not null,
  kind text not null check (kind in ('visit','order')),
  order_number text,
  amount numeric,
  created_at timestamptz not null default now()
);
alter table public.ref_events enable row level security;
create index if not exists ref_events_admin_idx on public.ref_events (admin_id, kind);

-- زيارة جت من لينك إحالة (بتتسجل بس لو صاحب اللينك أدمن أو مالك)
create or replace function public.ref_hit(p_admin uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles where id = p_admin and role in ('admin','owner')) then
    insert into public.ref_events (admin_id, kind) values (p_admin, 'visit');
  end if;
end $$;
grant execute on function public.ref_hit(uuid) to anon, authenticated;

-- طلب اتعمل من زبون جاي من لينك إحالة (بنتأكد إن الطلب بتاع المستخدم الحالي)
create or replace function public.ref_order(p_admin uuid, p_order text, p_amount numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_admin = auth.uid() then return; end if;
  if not exists (select 1 from public.profiles where id = p_admin and role in ('admin','owner')) then return; end if;
  if not exists (select 1 from public.orders where order_number = p_order and user_id = auth.uid()) then return; end if;
  if exists (select 1 from public.ref_events where kind = 'order' and order_number = p_order) then return; end if;
  insert into public.ref_events (admin_id, kind, order_number, amount) values (p_admin, 'order', p_order, p_amount);
end $$;
grant execute on function public.ref_order(uuid, text, numeric) to authenticated;

-- الإحصائيات: المالك يشوف الكل، والأدمن يشوف نفسه بس
create or replace function public.admin_ref_stats() returns table (admin_id uuid, name text, visits bigint, orders bigint, total numeric)
language plpgsql security definer set search_path = public as $$
begin
  return query
  select e.admin_id,
         coalesce(p.full_name, p.email, 'بدون اسم')::text,
         count(*) filter (where e.kind = 'visit'),
         count(*) filter (where e.kind = 'order'),
         coalesce(sum(e.amount) filter (where e.kind = 'order'), 0)
    from public.ref_events e
    left join public.profiles p on p.id = e.admin_id
   where public.is_owner() or e.admin_id = auth.uid()
   group by e.admin_id, p.full_name, p.email
   order by 4 desc, 3 desc;
end $$;
grant execute on function public.admin_ref_stats() to authenticated;
