'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getUser } from '@/lib/auth';
import { getPublishSettings } from '@/lib/settings';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';
import { slugify, toNumber } from '@/lib/utils';

const BUCKET = 'product-images';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 6;

function fail(path: string, message: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`);
}

/** المستخدم المسجّل + عميل السيرفر. كل عملية هنا تتحقق من ملكية المنتج بنفسها لأن العميل بصلاحيات كاملة. */
async function requireSeller(back: string) {
  const user = await getUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent('/sell')}`);
  if (!hasServiceRole) fail(back, 'خدمة نشر المنتجات غير مفعّلة بعد (تحتاج إعداد SUPABASE_SERVICE_ROLE_KEY).');
  return { user: user!, db: createAdminClient() };
}

const sellerSchema = z.object({
  name: z.string().trim().min(2, 'اسم المنتج مطلوب').max(200),
  shop_name: z.string().trim().min(2, 'اسم المحل مطلوب').max(100),
  description: z.string().trim().max(5000).optional(),
  category_id: z.string().uuid().or(z.literal('')).optional(),
  price: z.coerce.number().min(1, 'السعر غير صالح').max(10_000_000),
  stock: z.coerce.number().int('المخزون يجب أن يكون رقمًا صحيحًا').min(0).max(1_000_000),
});

/** حفظ مسودة المنتج (intent=save) أو حفظه ثم الانتقال لدفع رسم النشر (intent=publish) */
export async function saveSellerProduct(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const back = id ? `/sell/${id}` : '/sell/new';
  const { user, db } = await requireSeller(back);

  const parsed = sellerSchema.safeParse({
    name: formData.get('name'),
    shop_name: formData.get('shop_name'),
    description: formData.get('description') ?? '',
    category_id: formData.get('category_id') ?? '',
    price: formData.get('price'),
    stock: formData.get('stock') ?? 0,
  });
  if (!parsed.success) fail(back, parsed.error.issues[0].message);
  const d = parsed.data!;

  const compareAt = toNumber(formData.get('compare_at_price'));
  if (compareAt !== null && compareAt < d.price) fail(back, 'السعر قبل الخصم يجب أن يكون أكبر من أو يساوي السعر الحالي');

  const row = {
    name: d.name,
    shop_name: d.shop_name,
    description: d.description || null,
    category_id: d.category_id || null,
    price: d.price,
    compare_at_price: compareAt,
    stock: d.stock,
  };

  let productId = id;
  let status = 'draft';
  if (id) {
    const { data: existing } = await db.from('products').select('id, status, seller_id').eq('id', id).maybeSingle();
    if (!existing || existing.seller_id !== user.id) fail('/sell', 'المنتج غير موجود');
    status = existing!.status as string;
    if (status === 'pending') fail(back, 'المنتج قيد مراجعة الدفع حاليًا ولا يمكن تعديله');
    const { error } = await db.from('products').update(row).eq('id', id).eq('seller_id', user.id);
    if (error) fail(back, 'تعذر حفظ المنتج');
  } else {
    const slug = `${slugify(d.name) || 'p'}-${Math.random().toString(36).slice(2, 7)}`;
    const { data, error } = await db
      .from('products')
      .insert({ ...row, slug, seller_id: user.id, status: 'draft', is_active: false })
      .select('id')
      .single();
    if (error || !data) fail(back, 'تعذر إنشاء المنتج. تأكد من تشغيل ملف supabase/migrations/003 في Supabase');
    productId = data!.id as string;
  }
  const here = `/sell/${productId}`;

  // حذف الصور المحددة (مع التأكد أنها لهذا المنتج)
  const toDelete = formData.getAll('delete_images').map(String).filter(Boolean);
  if (toDelete.length > 0) {
    await db.from('product_images').delete().in('id', toDelete).eq('product_id', productId);
  }

  // رفع الصور الجديدة
  const files = formData.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > 0) {
    const { data: current } = await db.from('product_images').select('sort_order').eq('product_id', productId).order('sort_order', { ascending: false });
    if ((current?.length ?? 0) + files.length > MAX_IMAGES) fail(here, `الحد الأقصى ${MAX_IMAGES} صور للمنتج`);
    let order = ((current?.[0]?.sort_order as number | undefined) ?? -1) + 1;
    for (const file of files) {
      if (!file.type.startsWith('image/')) fail(here, `الملف ${file.name} ليس صورة`);
      if (file.size > MAX_IMAGE_BYTES) fail(here, `الصورة ${file.name} أكبر من 5 ميجابايت`);
      const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
      const path = `${productId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await db.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) fail(here, 'تعذر رفع الصورة');
      const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path);
      await db.from('product_images').insert({ product_id: productId, url: pub.publicUrl, sort_order: order++ });
    }
  }

  revalidatePath('/sell');
  if (String(formData.get('intent')) === 'publish' && status !== 'published') redirect(`/sell/${productId}/publish`);
  redirect(`${here}?saved=1`);
}

/** إرسال إثبات دفع رسم النشر. الاعتماد يتم يدويًا من الأدمن بعد التأكد من وصول التحويل. */
export async function submitPublishRequest(formData: FormData) {
  const productId = z.string().uuid().safeParse(formData.get('product_id'));
  if (!productId.success) redirect('/sell');
  const back = `/sell/${productId.data}/publish`;
  const { user, db } = await requireSeller(back);

  const parsed = z
    .object({
      payment_ref: z.string().trim().min(4, 'أدخل رقم العملية كما يظهر في InstaPay').max(60),
      sender_phone: z.string().trim().max(20).optional(),
    })
    .safeParse({ payment_ref: formData.get('payment_ref'), sender_phone: formData.get('sender_phone') ?? '' });
  if (!parsed.success) fail(back, parsed.error.issues[0].message);

  const { data: product } = await db.from('products').select('id, status, seller_id').eq('id', productId.data).maybeSingle();
  if (!product || product.seller_id !== user.id) fail('/sell', 'المنتج غير موجود');
  if (product!.status === 'pending') fail(back, 'طلب النشر قيد المراجعة بالفعل');
  if (product!.status === 'published') fail('/sell', 'المنتج منشور بالفعل');

  const { count } = await db.from('product_images').select('id', { count: 'exact', head: true }).eq('product_id', productId.data);
  if (!count) fail(`/sell/${productId.data}`, 'أضف صورة واحدة على الأقل قبل النشر');

  const { fee } = await getPublishSettings();
  const { error } = await db.from('publish_requests').insert({
    product_id: productId.data,
    user_id: user.id,
    amount: fee,
    payment_ref: parsed.data!.payment_ref,
    sender_phone: parsed.data!.sender_phone || null,
  });
  if (error) fail(back, error.code === '23505' ? 'رقم العملية هذا مستخدم من قبل' : 'تعذر إرسال الطلب. تأكد من تشغيل ملف migrations/003');

  await db.from('products').update({ status: 'pending' }).eq('id', productId.data).eq('seller_id', user.id);
  revalidatePath('/sell');
  redirect('/sell?submitted=1');
}
