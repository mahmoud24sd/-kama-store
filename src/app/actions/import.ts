'use server';

import { revalidatePath } from 'next/cache';
import { assertAdmin } from '@/lib/auth';
import { parseCsv } from '@/lib/csv';
import { slugify } from '@/lib/utils';

export type ImportState = { created?: number; failed?: number; errors?: string[]; message?: string };

const MAX_ROWS = 500;
const BATCH = 50;

// أسماء الأعمدة المقبولة (إنجليزي أو عربي)
const ALIASES: Record<string, string[]> = {
  name: ['name', 'اسم المنتج', 'الاسم'],
  price: ['price', 'السعر'],
  compare_at_price: ['compare_at_price', 'السعر قبل الخصم'],
  stock: ['stock', 'المخزون', 'الكمية'],
  category: ['category', 'القسم'],
  brand: ['brand', 'العلامة التجارية', 'الماركة'],
  shop_name: ['shop_name', 'اسم المحل'],
  description: ['description', 'الوصف'],
  image_urls: ['image_urls', 'images', 'روابط الصور', 'الصور'],
  publish: ['publish', 'نشر', 'ظاهر'],
};

const YES = ['yes', 'y', 'true', '1', 'نعم', 'ايوه', 'أيوه', 'نشر', 'ظاهر'];

function num(v: string | undefined): number | null {
  if (v === undefined || v.trim() === '') return null;
  const n = Number(v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,٬\s]/g, '').replace('٫', '.'));
  return Number.isFinite(n) ? n : NaN;
}

export async function importProducts(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const { supabase } = await assertAdmin();

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { message: 'اختر ملف CSV أولًا' };
  if (file.size > 3 * 1024 * 1024) return { message: 'الملف أكبر من 3 ميجابايت' };

  const rows = parseCsv(await file.text());
  if (rows.length < 2) return { message: 'الملف فارغ أو بدون صفوف منتجات' };
  if (rows.length - 1 > MAX_ROWS) return { message: `الحد الأقصى ${MAX_ROWS} منتج في الملف الواحد. قسّم الملف.` };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col: Record<string, number> = {};
  for (const [key, names] of Object.entries(ALIASES)) {
    const idx = header.findIndex((h) => names.map((n) => n.toLowerCase()).includes(h));
    if (idx !== -1) col[key] = idx;
  }
  if (col.name === undefined || col.price === undefined) return { message: 'الملف يجب أن يحتوي على عمودي name و price على الأقل. حمّل القالب من الرابط أعلاه.' };
  const get = (r: string[], k: string) => (col[k] === undefined ? undefined : (r[col[k]] ?? '').trim());

  const { data: cats } = await supabase.from('categories').select('id,name,slug');
  const catMap = new Map<string, string>();
  for (const c of cats ?? []) {
    catMap.set(String(c.name).trim().toLowerCase(), c.id as string);
    catMap.set(String(c.slug).trim().toLowerCase(), c.id as string);
  }

  const errors: string[] = [];
  type Prepared = { row: Record<string, unknown>; images: string[]; line: number };
  const valid: Prepared[] = [];

  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const name = get(r, 'name') ?? '';
    const price = num(get(r, 'price'));
    const stock = num(get(r, 'stock'));
    const compare = num(get(r, 'compare_at_price'));
    if (name.length < 2) return void errors.push(`سطر ${line}: اسم المنتج مطلوب`);
    if (name.length > 200) return void errors.push(`سطر ${line}: الاسم أطول من 200 حرف`);
    if (price === null || Number.isNaN(price) || price < 0) return void errors.push(`سطر ${line} (${name}): السعر غير صالح`);
    if (stock !== null && (Number.isNaN(stock) || stock < 0 || !Number.isInteger(stock))) return void errors.push(`سطر ${line} (${name}): المخزون يجب أن يكون رقمًا صحيحًا`);
    if (compare !== null && (Number.isNaN(compare) || compare < price)) return void errors.push(`سطر ${line} (${name}): السعر قبل الخصم يجب أن يكون أكبر من أو يساوي السعر`);

    const catName = (get(r, 'category') ?? '').toLowerCase();
    if (catName && !catMap.has(catName)) return void errors.push(`سطر ${line} (${name}): القسم «${get(r, 'category')}» غير موجود، أنشئه أولًا من صفحة الأقسام`);

    const images = (get(r, 'image_urls') ?? '')
      .split(/[|\n\s]+/)
      .map((u) => u.trim())
      .filter(Boolean);
    for (const u of images) {
      try {
        if (new URL(u).protocol !== 'https:') throw new Error();
      } catch {
        return void errors.push(`سطر ${line} (${name}): رابط الصورة غير صالح (يجب أن يبدأ بـ https://): ${u.slice(0, 60)}`);
      }
    }
    if (images.length > 6) return void errors.push(`سطر ${line} (${name}): الحد الأقصى 6 صور`);

    const publish = YES.includes((get(r, 'publish') ?? '').toLowerCase());
    const shop = get(r, 'shop_name');
    valid.push({
      line,
      images,
      row: {
        name,
        slug: `${slugify(name) || 'p'}-${Math.random().toString(36).slice(2, 8)}`,
        description: get(r, 'description') || null,
        brand: get(r, 'brand') || null,
        ...(shop ? { shop_name: shop } : {}),
        category_id: catName ? catMap.get(catName) : null,
        price,
        compare_at_price: compare,
        stock: stock ?? 0,
        is_active: publish,
      },
    });
  });

  let created = 0;
  for (let i = 0; i < valid.length; i += BATCH) {
    const chunk = valid.slice(i, i + BATCH);
    const { data, error } = await supabase.from('products').insert(chunk.map((c) => c.row)).select('id,slug');
    if (error || !data) {
      chunk.forEach((c) => errors.push(`سطر ${c.line} (${c.row.name}): تعذّر الحفظ`));
      continue;
    }
    const idBySlug = new Map(data.map((d) => [d.slug as string, d.id as string]));
    const imgRows = chunk.flatMap((c) => {
      const pid = idBySlug.get(c.row.slug as string);
      return pid ? c.images.map((url, n) => ({ product_id: pid, url, sort_order: n })) : [];
    });
    if (imgRows.length > 0) {
      const { error: imgErr } = await supabase.from('product_images').insert(imgRows);
      if (imgErr) errors.push(`الدفعة التي تبدأ من سطر ${chunk[0].line}: حُفظت المنتجات لكن تعذّر حفظ بعض الصور`);
    }
    created += data.length;
  }

  revalidatePath('/', 'layout');
  return { created, failed: rows.length - 1 - created, errors: errors.slice(0, 100) };
}
