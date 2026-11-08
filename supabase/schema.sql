-- =====================================================================
-- Kama Store — مخطط قاعدة البيانات (Supabase / PostgreSQL)
-- شغّل هذا الملف كاملًا مرة واحدة في: Supabase Dashboard → SQL Editor
-- جدول "users" هو جدول المصادقة الجاهز auth.users، و"profiles" يمتد منه ويحمل الصلاحية (role).
-- ⚠️ قيم الشحن داخل create_order (60 / 120 / مجاني فوق 1000) يجب أن تطابق src/lib/shipping.ts
-- =====================================================================

-- ---------- دوال مساعدة ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- profiles ----------
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  phone      text,
  role       text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- هل المستخدم الحالي أدمن؟ (security definer لتفادي التكرار اللانهائي في سياسات RLS)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- إنشاء profile تلقائيًا عند التسجيل. الصلاحية دائمًا customer ولا تُقرأ أبدًا من بيانات المتصفح
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- منع العميل من ترقية نفسه إلى أدمن (التعديل من SQL Editor مسموح لأن auth.uid() يكون null)
create or replace function public.protect_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'forbidden_role_change';
  end if;
  if new.email is distinct from old.email and auth.uid() is not null and not public.is_admin() then
    new.email := old.email;
  end if;
  return new;
end $$;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------- categories ----------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  parent_id  uuid references public.categories(id) on delete set null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- products ----------
create table public.products (
  id               uuid primary key default gen_random_uuid(),
  category_id      uuid references public.categories(id) on delete set null,
  name             text not null,
  slug             text not null unique,
  description      text,
  brand            text,
  price            numeric(12,2) not null check (price >= 0),
  compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= 0), -- السعر قبل الخصم
  stock            int not null default 0 check (stock >= 0),
  sold_count       int not null default 0 check (sold_count >= 0),
  is_active        boolean not null default true,
  is_deal          boolean not null default false,
  deal_ends_at     timestamptz,
  rating_avg       numeric(3,2) not null default 0,
  rating_count     int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index products_category_idx on public.products (category_id);
create index products_brand_idx    on public.products (brand);
create index products_created_idx  on public.products (created_at desc);
create index products_sold_idx     on public.products (sold_count desc);
create trigger products_updated before update on public.products
  for each row execute function public.set_updated_at();

-- ---------- product_images ----------
create table public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url        text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, sort_order);

-- ---------- product_variants (اللون / المقاس) ----------
create table public.product_variants (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products(id) on delete cascade,
  color          text,
  size           text,
  sku            text,
  price_override numeric(12,2) check (price_override is null or price_override >= 0),
  stock          int not null default 0 check (stock >= 0),
  created_at     timestamptz not null default now(),
  check (color is not null or size is not null)
);
create index product_variants_product_idx on public.product_variants (product_id);

-- عند وجود خيارات يصبح products.stock = مجموع مخزون الخيارات
create or replace function public.sync_product_stock() returns trigger
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if tg_op = 'DELETE' then pid := old.product_id; else pid := new.product_id; end if;
  update public.products
     set stock = coalesce((select sum(v.stock) from public.product_variants v where v.product_id = pid), 0)
   where id = pid
     and exists (select 1 from public.product_variants v where v.product_id = pid);
  return null;
end $$;
create trigger variants_sync_stock after insert or update or delete on public.product_variants
  for each row execute function public.sync_product_stock();

-- ---------- carts (جاهزة لمزامنة السلة بين الأجهزة لاحقًا؛ السلة الحالية محفوظة في المتصفح) ----------
create table public.carts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);
create table public.cart_items (
  id         uuid primary key default gen_random_uuid(),
  cart_id    uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  quantity   int not null check (quantity > 0 and quantity <= 99)
);
create unique index cart_items_unique_idx on public.cart_items
  (cart_id, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ---------- addresses ----------
create table public.addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  full_name   text not null,
  phone       text not null,
  line1       text not null,
  city        text not null,
  governorate text not null,
  notes       text,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index addresses_user_idx on public.addresses (user_id);

-- ---------- coupons ----------
create table public.coupons (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique check (code = upper(code)),
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  value         numeric(12,2) not null check (value > 0),
  min_order     numeric(12,2) not null default 0,
  max_uses      int,
  used_count    int not null default 0,
  expires_at    timestamptz,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  check (discount_type <> 'percent' or value <= 100)
);

-- ---------- app_settings ----------
create table public.app_settings (
  key   text primary key,
  value text not null
);
insert into public.app_settings (key, value) values ('card_payments_enabled', 'false');

-- ---------- orders ----------
create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     text not null unique,
  user_id          uuid references auth.users(id) on delete set null,
  status           text not null default 'pending'
                   check (status in ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  payment_method   text not null check (payment_method in ('cod', 'card')),
  payment_status   text not null default 'unpaid'
                   check (payment_status in ('unpaid', 'paid', 'failed', 'refunded')),
  shipping_method  text not null check (shipping_method in ('standard', 'express')),
  subtotal         numeric(12,2) not null default 0,
  discount         numeric(12,2) not null default 0,
  shipping         numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0,
  coupon_code      text,
  ship_name        text not null,
  ship_phone       text not null,
  ship_line1       text not null,
  ship_city        text not null,
  ship_governorate text not null,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index orders_user_idx    on public.orders (user_id, created_at desc);
create index orders_status_idx  on public.orders (status);
create index orders_created_idx on public.orders (created_at desc);
create trigger orders_updated before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  product_id    uuid references public.products(id) on delete set null,
  variant_id    uuid references public.product_variants(id) on delete set null,
  name          text not null,
  variant_label text,
  image_url     text,
  unit_price    numeric(12,2) not null,
  quantity      int not null check (quantity > 0)
);
create index order_items_order_idx   on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

-- ---------- payments ----------
create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  provider     text not null,          -- cod | stripe | paymob | ...
  method       text not null,
  amount       numeric(12,2) not null,
  status       text not null default 'unpaid' check (status in ('unpaid', 'paid', 'failed', 'refunded')),
  provider_ref text,                   -- مرجع العملية لدى البوابة. لا تخزّن بيانات بطاقات أبدًا
  created_at   timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);

-- عند إلغاء الطلب يُعاد المخزون تلقائيًا، ولا يمكن إلغاء الإلغاء (حتى لا يختل المخزون)
create or replace function public.orders_on_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare it record;
begin
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'order_cancelled';
  end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    for it in select * from public.order_items where order_id = new.id loop
      if it.variant_id is not null then
        update public.product_variants set stock = stock + it.quantity where id = it.variant_id;
      elsif it.product_id is not null then
        update public.products set stock = stock + it.quantity where id = it.product_id;
      end if;
      if it.product_id is not null then
        update public.products set sold_count = greatest(sold_count - it.quantity, 0) where id = it.product_id;
      end if;
    end loop;
  end if;
  return new;
end $$;
create trigger orders_status_change before update of status on public.orders
  for each row execute function public.orders_on_status_change();

-- ---------- reviews ----------
create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  author_name text,
  rating      int not null check (rating between 1 and 5),
  comment     text,
  is_approved boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (product_id, user_id)
);
create index reviews_product_idx on public.reviews (product_id, created_at desc);

create or replace function public.refresh_product_rating() returns trigger
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if tg_op = 'DELETE' then pid := old.product_id; else pid := new.product_id; end if;
  update public.products p
     set rating_avg   = coalesce((select round(avg(r.rating)::numeric, 2) from public.reviews r where r.product_id = pid and r.is_approved), 0),
         rating_count = (select count(*) from public.reviews r where r.product_id = pid and r.is_approved)
   where p.id = pid;
  return null;
end $$;
create trigger reviews_refresh_rating after insert or update or delete on public.reviews
  for each row execute function public.refresh_product_rating();

-- ---------- favorites ----------
create table public.favorites (
  user_id    uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles         enable row level security;
alter table public.categories       enable row level security;
alter table public.products         enable row level security;
alter table public.product_images   enable row level security;
alter table public.product_variants enable row level security;
alter table public.carts            enable row level security;
alter table public.cart_items       enable row level security;
alter table public.addresses        enable row level security;
alter table public.coupons          enable row level security;
alter table public.app_settings     enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.payments         enable row level security;
alter table public.reviews          enable row level security;
alter table public.favorites        enable row level security;

-- profiles: كل مستخدم يرى ويعدّل ملفه فقط، والأدمن يرى الجميع
create policy profiles_select on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- الكتالوج: قراءة عامة للمنتجات النشطة، والكتابة للأدمن فقط
create policy categories_select on public.categories for select using (true);
create policy categories_admin  on public.categories for all using (public.is_admin()) with check (public.is_admin());

create policy products_select on public.products for select using (is_active or public.is_admin());
create policy products_admin  on public.products for all using (public.is_admin()) with check (public.is_admin());

create policy product_images_select on public.product_images for select using (
  public.is_admin() or exists (select 1 from public.products p where p.id = product_images.product_id and p.is_active));
create policy product_images_admin on public.product_images for all using (public.is_admin()) with check (public.is_admin());

create policy product_variants_select on public.product_variants for select using (
  public.is_admin() or exists (select 1 from public.products p where p.id = product_variants.product_id and p.is_active));
create policy product_variants_admin on public.product_variants for all using (public.is_admin()) with check (public.is_admin());

-- الكوبونات والإعدادات: الأدمن فقط (العميل يتحقق من الكوبون عبر validate_coupon دون قراءة الجدول)
create policy coupons_admin  on public.coupons      for all using (public.is_admin()) with check (public.is_admin());
create policy settings_admin on public.app_settings for all using (public.is_admin()) with check (public.is_admin());

-- السلة والعناوين والمفضلة: صاحبها فقط
create policy carts_own on public.carts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cart_items_own on public.cart_items for all
  using (exists (select 1 from public.carts c where c.id = cart_items.cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.carts c where c.id = cart_items.cart_id and c.user_id = auth.uid()));

create policy addresses_own on public.addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy favorites_own on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- الطلبات: قراءة لصاحبها أو الأدمن. لا يوجد INSERT مباشر — الإنشاء فقط عبر create_order()
create policy orders_select on public.orders for select using (user_id = auth.uid() or public.is_admin());
create policy orders_admin_update on public.orders for update using (public.is_admin()) with check (public.is_admin());

create policy order_items_select on public.order_items for select using (
  public.is_admin() or exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid()));

create policy payments_select on public.payments for select using (
  public.is_admin() or exists (select 1 from public.orders o where o.id = payments.order_id and o.user_id = auth.uid()));
create policy payments_admin_update on public.payments for update using (public.is_admin()) with check (public.is_admin());

-- التقييمات: القراءة للمعتمد، والكتابة لمن اشترى المنتج فقط، والأدمن يدير الكل
create policy reviews_select on public.reviews for select
  using (is_approved or user_id = auth.uid() or public.is_admin());
create policy reviews_insert on public.reviews for insert with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.order_items oi join public.orders o on o.id = oi.order_id
     where oi.product_id = reviews.product_id and o.user_id = auth.uid() and o.status <> 'cancelled'));
create policy reviews_update on public.reviews for update
  using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy reviews_delete on public.reviews for delete using (user_id = auth.uid() or public.is_admin());

-- =====================================================================
-- دوال الأعمال (الأسعار والمخزون والكوبون والشحن تُحسب هنا على السيرفر فقط)
-- =====================================================================

-- التحقق من كوبون للعرض في السلة (لا تكشف محتوى جدول coupons)
create or replace function public.validate_coupon(p_code text, p_subtotal numeric) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c public.coupons%rowtype; d numeric;
begin
  select * into c from public.coupons
   where code = upper(trim(p_code)) and is_active and (expires_at is null or expires_at > now());
  if not found or (c.max_uses is not null and c.used_count >= c.max_uses) then
    return jsonb_build_object('valid', false, 'discount', 0, 'message', 'الكوبون غير صالح أو منتهي');
  end if;
  if p_subtotal < c.min_order then
    return jsonb_build_object('valid', false, 'discount', 0,
      'message', 'الحد الأدنى لاستخدام هذا الكوبون ' || c.min_order::text || ' ج.م');
  end if;
  d := case when c.discount_type = 'percent'
            then round(p_subtotal * c.value / 100, 2)
            else least(c.value, p_subtotal) end;
  return jsonb_build_object('valid', true, 'discount', d, 'message', 'تم تطبيق الكوبون');
end $$;

-- إنشاء الطلب: يعيد حساب الأسعار من قاعدة البيانات ويتحقق من المخزون بقفل الصفوف.
-- أي رقم سعر قادم من المتصفح يُتجاهل بالكامل.
create or replace function public.create_order(
  p_items           jsonb,   -- [{ "product_id": "...", "variant_id": "..."|null, "quantity": 2 }]
  p_address         jsonb,   -- { full_name, phone, line1, city, governorate, notes? }
  p_shipping_method text,
  p_payment_method  text,
  p_coupon          text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user     uuid := auth.uid();
  v_order_id uuid := gen_random_uuid();
  v_number   text;
  v_item     jsonb;
  v_qty      int;
  v_prod     public.products%rowtype;
  v_var      public.product_variants%rowtype;
  v_unit     numeric;
  v_label    text;
  v_img      text;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_shipping numeric := 0;
  v_total    numeric;
  v_coupon   public.coupons%rowtype;
  v_card_ok  boolean := false;
  v_name     text := trim(coalesce(p_address->>'full_name', ''));
  v_phone    text := trim(coalesce(p_address->>'phone', ''));
  v_line1    text := trim(coalesce(p_address->>'line1', ''));
  v_city     text := trim(coalesce(p_address->>'city', ''));
  v_gov      text := trim(coalesce(p_address->>'governorate', ''));
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_cart';
  end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'invalid_quantity'; end if;
  if p_shipping_method not in ('standard', 'express') then raise exception 'invalid_shipping'; end if;
  if p_payment_method not in ('cod', 'card') then raise exception 'invalid_payment'; end if;
  if v_name = '' or v_phone = '' or v_line1 = '' or v_city = '' or v_gov = '' then
    raise exception 'invalid_address';
  end if;

  -- الدفع بالبطاقة مغلق حتى يتم ربط بوابة دفع وتفعيل الإعداد يدويًا
  if p_payment_method = 'card' then
    select coalesce((select value = 'true' from public.app_settings where key = 'card_payments_enabled'), false)
      into v_card_ok;
    if not v_card_ok then raise exception 'payment_unavailable'; end if;
  end if;

  v_number := 'KS-' || to_char(now() at time zone 'Africa/Cairo', 'YYMMDD') || '-' ||
              upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  insert into public.orders (id, order_number, user_id, payment_method, shipping_method,
                             ship_name, ship_phone, ship_line1, ship_city, ship_governorate, notes)
  values (v_order_id, v_number, v_user, p_payment_method, p_shipping_method,
          v_name, v_phone, v_line1, v_city, v_gov,
          nullif(trim(coalesce(p_address->>'notes', '')), ''));

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := nullif(v_item->>'quantity', '')::int;
    if v_qty is null or v_qty < 1 or v_qty > 99 then raise exception 'invalid_quantity'; end if;

    select * into v_prod from public.products
     where id = (v_item->>'product_id')::uuid and is_active for update;
    if not found then raise exception 'product_unavailable'; end if;

    v_unit  := v_prod.price;
    v_label := null;

    if coalesce(v_item->>'variant_id', '') <> '' then
      select * into v_var from public.product_variants
       where id = (v_item->>'variant_id')::uuid and product_id = v_prod.id for update;
      if not found then raise exception 'variant_unavailable'; end if;
      if v_var.stock < v_qty then raise exception 'insufficient_stock:%', v_prod.name; end if;
      v_unit  := coalesce(v_var.price_override, v_prod.price);
      v_label := nullif(concat_ws(' / ', v_var.color, v_var.size), '');
      update public.product_variants set stock = stock - v_qty where id = v_var.id;
    else
      if exists (select 1 from public.product_variants where product_id = v_prod.id) then
        raise exception 'variant_required:%', v_prod.name;
      end if;
      if v_prod.stock < v_qty then raise exception 'insufficient_stock:%', v_prod.name; end if;
      update public.products set stock = stock - v_qty where id = v_prod.id;
    end if;

    update public.products set sold_count = sold_count + v_qty where id = v_prod.id;

    select url into v_img from public.product_images
     where product_id = v_prod.id order by sort_order, created_at limit 1;

    insert into public.order_items (order_id, product_id, variant_id, name, variant_label, image_url, unit_price, quantity)
    values (v_order_id, v_prod.id, nullif(v_item->>'variant_id', '')::uuid, v_prod.name, v_label, v_img, v_unit, v_qty);

    v_subtotal := v_subtotal + v_unit * v_qty;
  end loop;

  -- الكوبون
  if p_coupon is not null and trim(p_coupon) <> '' then
    select * into v_coupon from public.coupons
     where code = upper(trim(p_coupon)) and is_active and (expires_at is null or expires_at > now())
     for update;
    if not found then raise exception 'invalid_coupon'; end if;
    if v_coupon.max_uses is not null and v_coupon.used_count >= v_coupon.max_uses then
      raise exception 'invalid_coupon';
    end if;
    if v_subtotal < v_coupon.min_order then raise exception 'coupon_min_order'; end if;
    v_discount := case when v_coupon.discount_type = 'percent'
                       then round(v_subtotal * v_coupon.value / 100, 2)
                       else least(v_coupon.value, v_subtotal) end;
    update public.coupons set used_count = used_count + 1 where id = v_coupon.id;
  end if;

  -- الشحن: عادي 60 (مجاني عند 1000 فأكثر بعد الخصم)، سريع 120
  v_shipping := case when p_shipping_method = 'express' then 120
                     when (v_subtotal - v_discount) >= 1000 then 0
                     else 60 end;
  v_total := v_subtotal - v_discount + v_shipping;

  update public.orders
     set subtotal = v_subtotal, discount = v_discount, shipping = v_shipping, total = v_total,
         coupon_code = case when v_discount > 0 then v_coupon.code end
   where id = v_order_id;

  insert into public.payments (order_id, provider, method, amount, status)
  values (v_order_id, case when p_payment_method = 'cod' then 'cod' else 'pending_gateway' end,
          p_payment_method, v_total, 'unpaid');

  return jsonb_build_object('id', v_order_id, 'order_number', v_number, 'total', v_total);
end $$;

-- إحصائيات لوحة التحكم (أدمن فقط)
create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'total_sales',     coalesce((select sum(total) from public.orders where status <> 'cancelled'), 0),
    'orders_count',    (select count(*) from public.orders),
    'pending_orders',  (select count(*) from public.orders where status = 'pending'),
    'customers_count', (select count(*) from public.profiles where role = 'customer'),
    'products_count',  (select count(*) from public.products),
    'low_stock',       (select count(*) from public.products where is_active and stock <= 5),
    'sales_by_day',    coalesce((
      select jsonb_agg(jsonb_build_object('day', to_char(s.d, 'YYYY-MM-DD'), 'total', s.t, 'orders', s.c) order by s.d)
        from (select (created_at at time zone 'Africa/Cairo')::date as d, sum(total) as t, count(*) as c
                from public.orders
               where status <> 'cancelled' and created_at >= now() - interval '14 days'
               group by 1) s
    ), '[]'::jsonb)
  );
end $$;

-- صلاحيات التنفيذ: Supabase يمنحها افتراضيًا للجميع، لذلك نسحبها ونمنح ما نحتاجه فقط
revoke all on function public.create_order(jsonb, jsonb, text, text, text) from public, anon;
grant execute on function public.create_order(jsonb, jsonb, text, text, text) to authenticated;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
revoke all on function public.validate_coupon(text, numeric) from public;
grant execute on function public.validate_coupon(text, numeric) to anon, authenticated;

-- =====================================================================
-- Storage: صور المنتجات (قراءة عامة، رفع/حذف للأدمن فقط)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'])
on conflict (id) do nothing;

create policy "product_images_public_read" on storage.objects for select
  using (bucket_id = 'product-images');
create policy "product_images_admin_insert" on storage.objects for insert
  with check (bucket_id = 'product-images' and public.is_admin());
create policy "product_images_admin_update" on storage.objects for update
  using (bucket_id = 'product-images' and public.is_admin());
create policy "product_images_admin_delete" on storage.objects for delete
  using (bucket_id = 'product-images' and public.is_admin());
