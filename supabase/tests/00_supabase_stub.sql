-- ════════════════════════════════════════════════════════════════
-- ⚠️ بيانات تجريبية للاختبار فقط — لا تشغّل هذا الملف في موقع حقيقي.
-- المنتجات هنا وهمية وبدون صور. احذفها من لوحة الإدارة قبل الإطلاق.
-- يُشغَّل بعد schema.sql.
-- ════════════════════════════════════════════════════════════════
insert into public.products (category_id, name, slug, description, brand, price, compare_at_price, stock, is_deal, sold_count)
select c.id, v.name, v.slug, v.description, v.brand, v.price, v.compare_at, v.stock, v.is_deal, v.sold
from (values
  ('electronics', '[تجريبي] سماعة بلوتوث لاسلكية', 'demo-bluetooth-headphones', 'منتج تجريبي لاختبار الموقع.', 'DemoBrand', 450.00, 600.00, 25, true, 40),
  ('electronics', '[تجريبي] شاحن سريع 30 واط', 'demo-fast-charger', 'منتج تجريبي لاختبار الموقع.', 'DemoBrand', 220.00, null, 60, false, 85),
  ('fashion', '[تجريبي] تيشيرت قطن', 'demo-cotton-tshirt', 'منتج تجريبي لاختبار الموقع.', 'DemoWear', 180.00, 250.00, 0, true, 12),
  ('home-kitchen', '[تجريبي] طقم أكواب زجاج', 'demo-glass-set', 'منتج تجريبي لاختبار الموقع.', 'DemoHome', 320.00, 400.00, 15, false, 22),
  ('beauty', '[تجريبي] كريم ترطيب', 'demo-moisturizer', 'منتج تجريبي لاختبار الموقع.', 'DemoCare', 150.00, null, 40, false, 33),
  ('sports', '[تجريبي] حصيرة يوجا', 'demo-yoga-mat', 'منتج تجريبي لاختبار الموقع.', 'DemoFit', 275.00, 350.00, 18, true, 19)
) as v(cat, name, slug, description, brand, price, compare_at, stock, is_deal, sold)
join public.categories c on c.slug = v.cat
on conflict (slug) do nothing;

-- مثال على منتج بمقاسات وألوان (المخزون يُحسب من الـ variants)
with p as (
  insert into public.products (category_id, name, slug, description, brand, price, compare_at_price, stock, sold_count)
  select id, '[تجريبي] حذاء رياضي', 'demo-sneakers', 'منتج تجريبي بخيارات لون ومقاس.', 'DemoFit', 900.00, 1200.00, 0, 7
  from public.categories where slug = 'sports'
  on conflict (slug) do nothing
  returning id
)
insert into public.product_variants (product_id, color, size, stock)
select p.id, v.color, v.size, v.stock from p, (values
  ('أسود', '41', 5), ('أسود', '42', 3), ('أبيض', '41', 4), ('أبيض', '42', 0)
) as v(color, size, stock);
