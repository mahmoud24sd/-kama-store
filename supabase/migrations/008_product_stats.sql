-- =====================================================================
-- إحصائيات المنتجات: الأكثر انتشارًا + من نشر كم منتج في أي قسم
-- شغّل هذا الملف كاملًا مرة واحدة في Supabase → SQL Editor. آمن لو اتشغّل أكثر من مرة.
-- =====================================================================

-- من نشر المنتج ومتى (يُسجَّل من الآن فصاعدًا؛ المنتجات القديمة تظهر «غير محدد»)
alter table public.products add column if not exists published_by uuid references auth.users(id) on delete set null;
alter table public.products add column if not exists published_at timestamptz;
create index if not exists products_published_by_idx on public.products (published_by);

create or replace function public.admin_product_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    -- أكثر 10 منتجات مبيعًا (آخر 30 يومًا ثم الإجمالي)، الطلبات الملغاة لا تُحسب
    'trending', coalesce((
      select jsonb_agg(t) from (
        select p.id, p.name, c.name as category, p.sold_count as sold_total,
               coalesce(s.units, 0) as units_30d, coalesce(s.revenue, 0) as revenue_30d
          from public.products p
          left join public.categories c on c.id = p.category_id
          left join (
            select oi.product_id, sum(oi.quantity) as units, sum(oi.quantity * oi.unit_price) as revenue
              from public.order_items oi
              join public.orders o on o.id = oi.order_id
             where o.status <> 'cancelled' and o.created_at >= now() - interval '30 days' and oi.product_id is not null
             group by oi.product_id
          ) s on s.product_id = p.id
         where p.sold_count > 0 or coalesce(s.units, 0) > 0
         order by coalesce(s.units, 0) desc, p.sold_count desc
         limit 10
      ) t
    ), '[]'::jsonb),
    -- عدد المنتجات المنشورة حاليًا لكل ناشر وقسم
    'publishers', coalesce((
      select jsonb_agg(r) from (
        select p.published_by as admin_id,
               coalesce(nullif(pr.full_name, ''), pr.email) as admin_name,
               coalesce(c.name, 'بدون قسم') as category,
               count(*) as products
          from public.products p
          left join public.profiles pr on pr.id = p.published_by
          left join public.categories c on c.id = p.category_id
         where p.is_active
         group by p.published_by, coalesce(nullif(pr.full_name, ''), pr.email), coalesce(c.name, 'بدون قسم')
         order by count(*) desc
      ) r
    ), '[]'::jsonb)
  );
end $$;
