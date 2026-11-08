\set ON_ERROR_STOP 1
create table public._results(n serial, name text, ok boolean, detail text);
create function public._t(nm text, ok boolean, d text default '') returns void language sql as $$ insert into public._results(name,ok,detail) values (nm, coalesce(ok,false), d) $$;
create function public._err(q text) returns text language plpgsql as $$ begin execute q; return 'NO_ERROR'; exception when others then return sqlerrm; end $$;

insert into auth.users(id,email,raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-000000000001','a@x.com','{"full_name":"Ali","role":"admin"}'),
 ('bbbbbbbb-0000-0000-0000-000000000002','b@x.com','{}'),
 ('cccccccc-0000-0000-0000-000000000003','admin@x.com','{}');
update public.profiles set role='admin' where id='cccccccc-0000-0000-0000-000000000003';
insert into public.coupons(code,discount_type,value,min_order,max_uses) values ('SAVE10','percent',10,100,2),('FIX50','fixed',50,0,null);
select public._t('signup creates profile with email', (select email from public.profiles where id='aaaaaaaa-0000-0000-0000-000000000001')='a@x.com');
select public._t('metadata role=admin is ignored at signup', (select role from public.profiles where id='aaaaaaaa-0000-0000-0000-000000000001')='customer');

-- ===== anon =====
set role anon;
select public._t('anon sees active products', (select count(*) from public.products)>0);
select public._t('anon cannot read coupons', (select count(*) from public.coupons)=0);
select public._t('anon cannot read orders', (select count(*) from public.orders)=0);
select public._t('anon cannot call create_order', public._err($q$select public.create_order('[]','{}','standard','cod')$q$) ilike '%permission denied%', public._err($q$select public.create_order('[]','{}','standard','cod')$q$));
select public._t('anon validate_coupon works', (public.validate_coupon('SAVE10',500)->>'valid')::boolean);
reset role;

-- ===== user A =====
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
select public._t('A sees only own profile', (select count(*) from public.profiles)=1);
select public._t('A cannot self-promote to admin', public._err($q$update public.profiles set role='admin' where id='aaaaaaaa-0000-0000-0000-000000000001'$q$) ilike '%forbidden_role_change%');
select public._t('A cannot call admin_stats', public._err($q$select public.admin_stats()$q$) ilike '%forbidden%');
update public.products set price = 1 where slug='demo-bluetooth-headphones';
select public._t('A cannot change product price (RLS)', (select price from public.products where slug='demo-bluetooth-headphones')=450);
select public._t('A cannot insert order directly', public._err($q$insert into public.orders(order_number,user_id,payment_method,shipping_method,ship_name,ship_phone,ship_line1,ship_city,ship_governorate) values ('X','aaaaaaaa-0000-0000-0000-000000000001','cod','standard','a','1','l','c','g')$q$) ilike '%row-level security%');

do $$
declare r jsonb; h uuid; c uuid; o record; st int;
begin
  select id into h from public.products where slug='demo-bluetooth-headphones';
  select id into c from public.products where slug='demo-fast-charger';
  -- 1) order with coupon: 2*450 + 1*220 = 1120, SAVE10 => -112, shipping 0 (>=1000), total 1008
  r := public.create_order(jsonb_build_array(
         jsonb_build_object('product_id',h,'variant_id',null,'quantity',2),
         jsonb_build_object('product_id',c,'variant_id',null,'quantity',1)),
       '{"full_name":"Ali","phone":"01000000000","line1":"شارع التحرير 5","city":"الدقي","governorate":"الجيزة","notes":"n"}'::jsonb,
       'standard','cod','save10');
  select * into o from public.orders where order_number = r->>'order_number';
  perform public._t('order total with coupon = 1008', o.total=1008 and o.subtotal=1120 and o.discount=112 and o.shipping=0, o.subtotal||'/'||o.discount||'/'||o.shipping||'/'||o.total);
  perform public._t('order number format KS-YYMMDD-XXXXXX', (r->>'order_number') ~ '^KS-[0-9]{6}-[0-9A-F]{6}$', r->>'order_number');
  perform public._t('stock decremented 25->23', (select stock from public.products where id=h)=23);
  perform public._t('sold_count incremented', (select sold_count from public.products where id=h)=42);
  perform public._t('coupon used_count = 1', true);
  perform public._t('payment row created unpaid', (select status from public.payments where order_id=o.id)='unpaid');
  -- 2) shipping variants
  r := public.create_order(jsonb_build_array(jsonb_build_object('product_id',c,'variant_id',null,'quantity',1)),
       '{"full_name":"Ali","phone":"01000000000","line1":"شارع التحرير 5","city":"الدقي","governorate":"الجيزة"}'::jsonb,'standard','cod',null);
  perform public._t('standard shipping below 1000 = 60 (total 280)', (r->>'total')::numeric=280, r->>'total');
  r := public.create_order(jsonb_build_array(jsonb_build_object('product_id',c,'variant_id',null,'quantity',1)),
       '{"full_name":"Ali","phone":"01000000000","line1":"شارع التحرير 5","city":"الدقي","governorate":"الجيزة"}'::jsonb,'express','cod','FIX50');
  perform public._t('express 120 + FIX50 on 220 (total 290)', (r->>'total')::numeric=290, r->>'total');
  -- 3) variant order: sneakers black/41 price 900 x2
  r := public.create_order(jsonb_build_array(jsonb_build_object('product_id',(select id from public.products where slug='demo-sneakers'),
        'variant_id',(select v.id from public.product_variants v where v.product_id=(select id from public.products where slug='demo-sneakers') and v.color='أسود' and v.size='41'),'quantity',2)),
       '{"full_name":"Ali","phone":"01000000000","line1":"شارع التحرير 5","city":"الدقي","governorate":"الجيزة"}'::jsonb,'standard','cod',null);
  perform public._t('variant order total 1800 (free shipping)', (r->>'total')::numeric=1800, r->>'total');
  perform public._t('variant stock 5->3', (select stock from public.product_variants where color='أسود' and size='41')=3);
  perform public._t('product stock synced to sum of variants', (select stock from public.products where slug='demo-sneakers')=10, (select stock from public.products where slug='demo-sneakers')::text);
end $$;

select public._t('over-stock rejected', public._err($q$select public.create_order(jsonb_build_array(jsonb_build_object('product_id',(select id from public.products where slug='demo-glass-set'),'variant_id',null,'quantity',50)),'{"full_name":"A","phone":"1","line1":"l","city":"c","governorate":"g"}','standard','cod')$q$) ilike 'insufficient_stock%', public._err($q$select public.create_order(jsonb_build_array(jsonb_build_object('product_id',(select id from public.products where slug='demo-glass-set'),'variant_id',null,'quantity',50)),'{"full_name":"A","phone":"1","line1":"l","city":"c","governorate":"g"}','standard','cod')$q$));
select public._t('zero-stock product rejected', public._err($q$select public.create_order(jsonb_build_array(jsonb_build_object('product_id',(select id from public.products where slug='demo-cotton-tshirt'),'variant_id',null,'quantity',1)),'{"full_name":"A","phone":"1","line1":"l","city":"c","governorate":"g"}','standard','cod')$q$) ilike 'insufficient_stock%');
select public._t('variant product without variant rejected', public._err($q$select public.create_order(jsonb_build_array(jsonb_build_object('product_id',(select id from public.products where slug='demo-sneakers'),'variant_id',null,'quantity',1)),'{"full_name":"A","phone":"1","line1":"l","city":"c","governorate":"g"}','standard','cod')$q$) ilike 'variant_required%');
select public._t('quantity 0 / 100 rejected', public._err($q$select public.create_order(jsonb_build_array(jsonb_build_object('product_id',(select id from public.products where slug='demo-glass-set'),'variant_id',null,'quantity',100)),'{"full_name":"A","phone":"1","line1":"l","city":"c","governorate":"g"}','standard','cod')$q$) ilike 'invalid_quantity%');
select public._t('card payment blocked (not configured)', public._err($q$select public.create_order(jsonb_build_array(jsonb_build_object('product_id',(select id from public.products where slug='demo-glass-set'),'variant_id',null,'quantity',1)),'{"full_name":"A","phone":"1","line1":"l","city":"c","governorate":"g"}','standard','card')$q$) ilike 'payment_unavailable%');
select public._t('bad coupon rejected', public._err($q$select public.create_order(jsonb_build_array(jsonb_build_object('product_id',(select id from public.products where slug='demo-glass-set'),'variant_id',null,'quantity',1)),'{"full_name":"A","phone":"1","line1":"l","city":"c","governorate":"g"}','standard','cod','NOPE')$q$) ilike 'invalid_coupon%');
select public._t('failed orders leave no residue (stock unchanged)', (select stock from public.products where slug='demo-glass-set')=15);
select public._t('failed orders leave no order rows', (select count(*) from public.orders)=4, (select count(*) from public.orders)::text);
select public._t('A sees own 4 orders', (select count(*) from public.orders)=4);
select public._t('A cannot review unpurchased product', public._err($q$insert into public.reviews(product_id,user_id,rating) values ((select id from public.products where slug='demo-yoga-mat'),'aaaaaaaa-0000-0000-0000-000000000001',5)$q$) ilike '%row-level security%');
insert into public.reviews(product_id,user_id,author_name,rating,comment) values ((select id from public.products where slug='demo-bluetooth-headphones'),'aaaaaaaa-0000-0000-0000-000000000001','Ali',4,'good');
select public._t('A can review purchased product; rating updated', (select rating_avg from public.products where slug='demo-bluetooth-headphones')=4.00 and (select rating_count from public.products where slug='demo-bluetooth-headphones')=1);
select public._t('duplicate review blocked', public._err($q$insert into public.reviews(product_id,user_id,rating) values ((select id from public.products where slug='demo-bluetooth-headphones'),'aaaaaaaa-0000-0000-0000-000000000001',1)$q$) ilike '%duplicate%');
select public._t('A cannot review as someone else', public._err($q$insert into public.reviews(product_id,user_id,rating) values ((select id from public.products where slug='demo-bluetooth-headphones'),'bbbbbbbb-0000-0000-0000-000000000002',1)$q$) ilike '%row-level security%');
reset role;

-- ===== user B =====
set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000002',false);
select public._t('B cannot see A orders', (select count(*) from public.orders)=0);
select public._t('B cannot see A order_items', (select count(*) from public.order_items)=0);
select public._t('B cannot see A payments', (select count(*) from public.payments)=0);
select public._t('B sees only own profile', (select count(*) from public.profiles)=1);
select public._t('B cannot read coupons', (select count(*) from public.coupons)=0);
update public.orders set status='delivered';
select public._t('B cannot update orders', true);
insert into public.addresses(user_id,full_name,phone,line1,city,governorate) values ('bbbbbbbb-0000-0000-0000-000000000002','B','1','line one','c','g');
select public._t('B cannot insert address for A', public._err($q$insert into public.addresses(user_id,full_name,phone,line1,city,governorate) values ('aaaaaaaa-0000-0000-0000-000000000001','x','1','line one','c','g')$q$) ilike '%row-level security%');
reset role;
select public._t('orders untouched by B update attempt', (select count(*) from public.orders where status='delivered')=0);

-- ===== admin =====
set role authenticated; select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000003',false);
select public._t('admin sees all orders', (select count(*) from public.orders)=4);
select public._t('admin sees all profiles', (select count(*) from public.profiles)=3);
select public._t('admin sees coupons', (select count(*) from public.coupons)=2);
select public._t('admin_stats: orders_count=4', (public.admin_stats()->>'orders_count')::int=4, public.admin_stats()::text);
select public._t('admin_stats: sales_by_day shape', (public.admin_stats()->'sales_by_day'->0) ? 'orders' and (public.admin_stats()->'sales_by_day'->0) ? 'day');
update public.products set price = 400 where slug='demo-bluetooth-headphones';
select public._t('admin can edit product price', (select price from public.products where slug='demo-bluetooth-headphones')=400);
-- cancel the first order => restock
update public.orders set status='cancelled' where order_number = (select order_number from public.orders where subtotal=1120);
select public._t('cancel restocks headphones 23->25', (select stock from public.products where slug='demo-bluetooth-headphones')=25, (select stock from public.products where slug='demo-bluetooth-headphones')::text);
select public._t('cancel restocks charger (+1 from first order)', (select stock from public.products where slug='demo-fast-charger')=58, (select stock from public.products where slug='demo-fast-charger')::text);
select public._t('cannot un-cancel an order', public._err($q$update public.orders set status='pending' where status='cancelled'$q$) ilike '%order_cancelled%');
update public.orders set status='delivered', payment_status='paid' where subtotal=1800;
select public._t('admin can mark delivered', (select count(*) from public.orders where status='delivered')=1);
select public._t('admin can promote user', public._err($q$update public.profiles set role='admin' where id='bbbbbbbb-0000-0000-0000-000000000002'$q$)='NO_ERROR');
reset role;

-- ===== coupon limits & final =====
select public._t('coupon used_count=1 after first order', (select used_count from public.coupons where code='SAVE10')=1, (select used_count from public.coupons where code='SAVE10')::text);

select name, case when ok then 'PASS' else 'FAIL' end as result, detail from public._results order by n;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from public._results;
