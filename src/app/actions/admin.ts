'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertAdmin, assertPermission } from '@/lib/auth';
import { slugify, toNumber } from '@/lib/utils';

const BUCKET = 'product-images';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function fail(path: string, message: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`);
}

const checkbox = (v: FormDataEntryValue | null) => v === 'on' || v === 'true';

/* ───────────────────────── المنتجات ───────────────────────── */

const productSchema = z.object({
  name: z.string().trim().min(2, 'اسم المنتج مطلوب').max(200),
  slug: z.string().trim().max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  brand: z.string().trim().max(100).optional(),
  category_id: z.string().uuid().or(z.literal('')).optional(),
  price: z.coerce.number().min(0, 'السعر غير صالح').max(10_000_000),
  stock: z.coerce.number().int('المخزون يجب أن يكون رقمًا صحيحًا').min(0, 'المخزون لا يمكن أن يكون سالبًا').max(1_000_000),
});

type VariantInput = { color: string | null; size: string | null; stock: number; price_override: number | null; sku: string | null };

/** كل سطر: اللون | المقاس | المخزون | السعر (اختياري) | SKU (اختياري) */
function parseVariants(text: string): { variants: VariantInput[]; error?: string } {
  const variants: VariantInput[] = [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const [i, line] of lines.entries()) {
    const [color, size, stock, price, sku] = line.split('|').map((s) => s.trim());
    const stockNum = Number(stock);
    if (!Number.isInteger(stockNum) || stockNum < 0) return { variants: [], error: `سطر الخيارات رقم ${i + 1}: المخزون غير صالح` };
    const priceNum = price ? Number(price) : null;
    if (priceNum !== null && (!Number.isFinite(priceNum) || priceNum < 0)) {
      return { variants: [], error: `سطر الخيارات رقم ${i + 1}: السعر غير صالح` };
    }
    if (!color && !size) return { variants: [], error: `سطر الخيارات رقم ${i + 1}: حدد لونًا أو مقاسًا` };
    variants.push({ color: color || null, size: size || null, stock: stockNum, price_override: priceNum, sku: sku || null });
  }
  return { variants };
}

function storagePathFromUrl(url: string): string | null {
  const marker = `/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

export async function saveProduct(formData: FormData) {
  const { supabase } = await assertAdmin();
  const id = String(formData.get('id') ?? '');
  const back = id ? `/admin/products/${id}` : '/admin/products/new';

  const parsed = productSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug') ?? '',
    description: formData.get('description') ?? '',
    brand: formData.get('brand') ?? '',
    category_id: formData.get('category_id') ?? '',
    price: formData.get('price'),
    stock: formData.get('stock') ?? 0,
  });
  if (!parsed.success) fail(back, parsed.error.issues[0].message);
  const d = parsed.data;

  const compareAt = toNumber(formData.get('compare_at_price'));
  if (compareAt !== null && compareAt < d.price) fail(back, 'السعر قبل الخصم يجب أن يكون أكبر من أو يساوي السعر الحالي');

  const dealEndsRaw = String(formData.get('deal_ends_at') ?? '');
  const dealEnds = dealEndsRaw ? new Date(dealEndsRaw) : null;
  if (dealEnds && Number.isNaN(dealEnds.getTime())) fail(back, 'تاريخ انتهاء العرض غير صالح');

  const { variants, error: variantsError } = parseVariants(String(formData.get('variants') ?? ''));
  if (variantsError) fail(back, variantsError);

  const row = {
    name: d.name,
    slug: d.slug ? slugify(d.slug) : slugify(d.name) || `p-${Date.now().toString(36)}`,
    description: d.description || null,
    brand: d.brand || null,
    category_id: d.category_id || null,
    price: d.price,
    compare_at_price: compareAt,
    stock: d.stock,
    is_active: checkbox(formData.get('is_active')),
    is_deal: checkbox(formData.get('is_deal')),
    deal_ends_at: dealEnds ? dealEnds.toISOString() : null,
  };

  let productId = id;
  if (id) {
    const { error } = await supabase.from('products').update(row).eq('id', id);
    if (error) fail(back, error.code === '23505' ? 'الرابط المختصر (slug) مستخدم لمنتج آخر' : 'تعذر حفظ المنتج');
  } else {
    const { data, error } = await supabase.from('products').insert(row).select('id').single();
    if (error || !data) fail(back, error?.code === '23505' ? 'الرابط المختصر (slug) مستخدم لمنتج آخر' : 'تعذر إنشاء المنتج');
    productId = data!.id as string;
  }

  // حذف الصور المحددة
  const toDelete = formData.getAll('delete_images').map(String).filter(Boolean);
  if (toDelete.length > 0) {
    const { data: imgs } = await supabase.from('product_images').select('id,url').in('id', toDelete).eq('product_id', productId);
    const paths = (imgs ?? []).map((i) => storagePathFromUrl(i.url as string)).filter((p): p is string => Boolean(p));
    if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths);
    await supabase.from('product_images').delete().in('id', toDelete).eq('product_id', productId);
  }

  // رفع الصور الجديدة
  const files = formData.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > 0) {
    const { data: last } = await supabase
      .from('product_images')
      .select('sort_order')
      .eq('product_id', productId)
      .order('sort_order', { ascending: false })
      .limit(1);
    let order = ((last?.[0]?.sort_order as number | undefined) ?? -1) + 1;

    for (const file of files) {
      if (!file.type.startsWith('image/')) fail(`/admin/products/${productId}`, `الملف ${file.name} ليس صورة`);
      if (file.size > MAX_IMAGE_BYTES) fail(`/admin/products/${productId}`, `الصورة ${file.name} أكبر من 5 ميجابايت`);
      const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
      const path = `${productId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) fail(`/admin/products/${productId}`, 'تعذر رفع الصورة. تأكد من إنشاء bucket باسم product-images (يتم عبر schema.sql)');
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      await supabase.from('product_images').insert({ product_id: productId, url: pub.publicUrl, sort_order: order++ });
    }
  }

  // الخيارات: استبدال كامل (طلبات قديمة تحتفظ بنسخة الاسم والخيار)
  await supabase.from('product_variants').delete().eq('product_id', productId);
  if (variants.length > 0) {
    const { error } = await supabase.from('product_variants').insert(variants.map((v) => ({ ...v, product_id: productId })));
    if (error) fail(`/admin/products/${productId}`, 'تم حفظ المنتج لكن تعذر حفظ الخيارات');
  }

  revalidatePath('/', 'layout');
  redirect(`/admin/products/${productId}?saved=1`);
}

export async function deleteProduct(formData: FormData) {
  const { supabase } = await assertAdmin();
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;

  const { data: imgs } = await supabase.from('product_images').select('url').eq('product_id', id.data);
  const paths = (imgs ?? []).map((i) => storagePathFromUrl(i.url as string)).filter((p): p is string => Boolean(p));
  if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths);

  await supabase.from('products').delete().eq('id', id.data);
  revalidatePath('/', 'layout');
  redirect('/admin/products');
}

/* ───────────────────────── الأقسام ───────────────────────── */

export async function saveCategory(formData: FormData) {
  const { supabase } = await assertPermission('categories');
  const parsed = z
    .object({
      id: z.string().uuid().optional().or(z.literal('')),
      name: z.string().trim().min(2, 'اسم القسم مطلوب').max(100),
      slug: z.string().trim().max(100).optional(),
      sort_order: z.coerce.number().int().min(0).max(10000).default(0),
      parent_id: z.string().uuid().optional().or(z.literal('')),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail('/admin/categories', parsed.error.issues[0].message);
  const d = parsed.data!;

  const row = {
    name: d.name,
    slug: d.slug ? slugify(d.slug) : slugify(d.name) || `c-${Date.now().toString(36)}`,
    sort_order: d.sort_order,
    parent_id: d.parent_id && d.parent_id !== d.id ? d.parent_id : null,
  };
  const { error } = d.id
    ? await supabase.from('categories').update(row).eq('id', d.id)
    : await supabase.from('categories').insert(row);
  if (error) fail('/admin/categories', error.code === '23505' ? 'الرابط المختصر مستخدم لقسم آخر' : 'تعذر حفظ القسم');

  revalidatePath('/', 'layout');
  redirect('/admin/categories');
}

export async function deleteCategory(formData: FormData) {
  const { supabase } = await assertPermission('categories');
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  await supabase.from('categories').delete().eq('id', id.data);
  revalidatePath('/', 'layout');
  redirect('/admin/categories');
}

/* ───────────────────────── المخزون ───────────────────────── */

export async function updateStock(formData: FormData) {
  const { supabase } = await assertAdmin();
  const parsed = z
    .object({
      kind: z.enum(['product', 'variant']),
      id: z.string().uuid(),
      stock: z.coerce.number().int().min(0).max(1_000_000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail('/admin/inventory', 'قيمة المخزون غير صالحة');
  const d = parsed.data!;
  await supabase.from(d.kind === 'product' ? 'products' : 'product_variants').update({ stock: d.stock }).eq('id', d.id);
  revalidatePath('/admin/inventory');
  redirect('/admin/inventory?saved=1');
}

/* ───────────────────────── العروض ───────────────────────── */

export async function saveOffer(formData: FormData) {
  const { supabase } = await assertAdmin();
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;

  const { data: product } = await supabase.from('products').select('price').eq('id', id.data).maybeSingle();
  if (!product) fail('/admin/offers', 'المنتج غير موجود');

  const isDeal = checkbox(formData.get('is_deal'));
  const compareAt = toNumber(formData.get('compare_at_price'));
  if (isDeal && (compareAt === null || compareAt <= Number(product!.price))) {
    fail('/admin/offers', 'لتفعيل العرض أدخل سعرًا قبل الخصم أكبر من السعر الحالي');
  }
  const endsRaw = String(formData.get('deal_ends_at') ?? '');
  const ends = endsRaw ? new Date(endsRaw) : null;
  if (ends && Number.isNaN(ends.getTime())) fail('/admin/offers', 'تاريخ غير صالح');

  await supabase
    .from('products')
    .update({ is_deal: isDeal, compare_at_price: compareAt, deal_ends_at: ends ? ends.toISOString() : null })
    .eq('id', id.data);
  revalidatePath('/', 'layout');
  redirect('/admin/offers?saved=1');
}

/* ───────────────────────── الطلبات ───────────────────────── */

export async function updateOrderStatus(formData: FormData) {
  const { supabase, profile } = await assertAdmin();
  const parsed = z
    .object({
      id: z.string().uuid(),
      status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
      payment_status: z.enum(['unpaid', 'paid', 'failed', 'refunded']),
      note: z.string().trim().max(300).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail('/admin/orders', 'بيانات غير صالحة');
  const d = parsed.data!;

  const { data: before } = await supabase.from('orders').select('status').eq('id', d.id).maybeSingle();

  const { error } = await supabase.from('orders').update({ status: d.status, payment_status: d.payment_status }).eq('id', d.id);
  if (error) fail(`/admin/orders/${d.id}`, 'تعذر تحديث الطلب');
  await supabase.from('payments').update({ status: d.payment_status }).eq('order_id', d.id);

  // سجّل مرحلة جديدة يراها العميل (تغيّرت الحالة أو أُضيفت ملاحظة تسليم). لا نفشل الطلب لو الجدول غير جاهز
  if (before?.status !== d.status || d.note) {
    await supabase.from('order_events').insert({
      order_id: d.id,
      status: d.status,
      note: d.note || null,
      created_by: profile.id,
      created_by_name: profile.full_name || profile.email,
    });
  }

  revalidatePath('/admin/orders');
  revalidatePath('/account/orders');
  redirect(`/admin/orders/${d.id}?saved=1`);
}

/* ───────────────────────── الكوبونات ───────────────────────── */

export async function saveCoupon(formData: FormData) {
  const { supabase } = await assertPermission('coupons');
  const parsed = z
    .object({
      code: z.string().trim().min(3, 'الكود 3 أحرف على الأقل').max(40).regex(/^[A-Za-z0-9_-]+$/, 'الكود: حروف إنجليزية وأرقام فقط'),
      discount_type: z.enum(['percent', 'fixed']),
      value: z.coerce.number().gt(0, 'قيمة الخصم يجب أن تكون أكبر من صفر'),
      min_order: z.coerce.number().min(0).default(0),
    })
    .safeParse({
      code: formData.get('code'),
      discount_type: formData.get('discount_type'),
      value: formData.get('value'),
      min_order: formData.get('min_order') || 0,
    });
  if (!parsed.success) fail('/admin/coupons', parsed.error.issues[0].message);
  const d = parsed.data!;
  if (d.discount_type === 'percent' && d.value > 100) fail('/admin/coupons', 'النسبة لا تتجاوز 100%');

  const maxUses = toNumber(formData.get('max_uses'));
  const expiresRaw = String(formData.get('expires_at') ?? '');
  const expires = expiresRaw ? new Date(expiresRaw) : null;
  if (expires && Number.isNaN(expires.getTime())) fail('/admin/coupons', 'تاريخ الانتهاء غير صالح');

  const { error } = await supabase.from('coupons').insert({
    code: d.code.toUpperCase(),
    discount_type: d.discount_type,
    value: d.value,
    min_order: d.min_order,
    max_uses: maxUses !== null ? Math.floor(maxUses) : null,
    expires_at: expires ? expires.toISOString() : null,
  });
  if (error) fail('/admin/coupons', error.code === '23505' ? 'هذا الكود موجود بالفعل' : 'تعذر حفظ الكوبون');
  revalidatePath('/admin/coupons');
  redirect('/admin/coupons');
}

export async function toggleCoupon(formData: FormData) {
  const { supabase } = await assertPermission('coupons');
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  await supabase.from('coupons').update({ is_active: formData.get('is_active') === 'true' }).eq('id', id.data);
  revalidatePath('/admin/coupons');
}

export async function deleteCoupon(formData: FormData) {
  const { supabase } = await assertPermission('coupons');
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  await supabase.from('coupons').delete().eq('id', id.data);
  revalidatePath('/admin/coupons');
}

/* ───────────────────────── التقييمات ───────────────────────── */

export async function setReviewApproved(formData: FormData) {
  const { supabase } = await assertAdmin();
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  await supabase.from('reviews').update({ is_approved: formData.get('approved') === 'true' }).eq('id', id.data);
  revalidatePath('/admin/reviews');
}

export async function deleteReview(formData: FormData) {
  const { supabase } = await assertAdmin();
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  await supabase.from('reviews').delete().eq('id', id.data);
  revalidatePath('/admin/reviews');
}
