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
  details: ['details', 'التفاصيل', 'تفاصيل', 'التفاصيل العامة', 'المواصفات'],
  cost_price: ['cost_price', 'سعر التكلفة', 'التكلفة'],
  supplier: ['supplier', 'المورد'],
  private_notes: ['private_notes', 'ملاحظات خاصة', 'تفاصيل خاصة'],
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

  // إما نص ملصوق من Excel / Google Sheets، أو ملف CSV
  const pasted = String(formData.get('text') ?? '').trim();
  const file = formData.get('file');
  let content = pasted;
  if (!content) {
    if (!(file instanceof File) || file.size === 0) return { message: 'الصق الجدول في الخانة أو اختر ملف CSV' };
    if (file.size > 3 * 1024 * 1024) return { message: 'الملف أكبر من 3 ميجابايت' };
    content = await file.text();
  } else if (content.length > 3 * 1024 * 1024) return { message: 'النص أكبر من 3 ميجابايت' };

  const rows = parseCsv(content);
  if (rows.length < 2) return { message: 'الملف فارغ أو بدون صفوف منتجات' };
  if (rows.length - 1 > MAX_ROWS) return { message: `الحد الأقصى ${MAX_ROWS} منتج في الملف الواحد. قسّم الملف.` };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col: Record<string, number> = {};
  for (const [key, names] of Object.entries(ALIASES)) {
    const idx = header.findIndex((h) => names.map((n) => n.toLowerCase()).includes(h));
    if (idx !== -1) col[key] = idx;
  }
  if (col.name === undefined || col.price === undefined) return { message: 'الملف يجب أن يحتوي على عمودي name و price على الأقل. السطر الأول يجب أن يكون أسماء الأعمدة (انسخه مع الجدول).' };
  const get = (r: string[], k: string) => (col[k] === undefined ? undefined : (r[col[k]] ?? '').trim());

  const { data: cats } = await supabase.from('categories').select('id,name,slug');
  const catMap = new Map<string, string>();
  for (const c of cats ?? []) {
    catMap.set(String(c.name).trim().toLowerCase(), c.id as string);
    catMap.set(String(c.slug).trim().toLowerCase(), c.id as string);
  }

  const errors: string[] = [];
  type PrivateRow = { cost_price: number | null; supplier: string | null; notes: string | null };
  type Prepared = { row: Record<string, unknown>; images: string[]; line: number; priv: PrivateRow | null };
  const valid: Prepared[] = [];

  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const name = get(r, 'name') ?? '';
    const price = num(get(r, 'price'));
    const stock = num(get(r, 'stock'));
    const compare = num(get(r, 'compare_at_price'));
    const cost = num(get(r, 'cost_price'));
    if (name.length < 2) return void errors.push(`سطر ${line}: اسم المنتج مطلوب`);
    if (name.length > 200) return void errors.push(`سطر ${line}: الاسم أطول من 200 حرف`);
    if (price === null || Number.isNaN(price) || price < 0) return void errors.push(`سطر ${line} (${name}): السعر غير صالح`);
    if (stock !== null && (Number.isNaN(stock) || stock < 0 || !Number.isInteger(stock))) return void errors.push(`سطر ${line} (${name}): المخزون يجب أن يكون رقمًا صحيحًا`);
    if (compare !== null && (Number.isNaN(compare) || compare < price)) return void errors.push(`سطر ${line} (${name}): السعر قبل الخصم يجب أن يكون أكبر من أو يساوي السعر`);

    if (cost !== null && (Number.isNaN(cost) || cost < 0)) return void errors.push(`سطر ${line} (${name}): سعر التكلفة غير صالح`);

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
    // التفاصيل العامة: كل خاصية في سطر، أو افصل بينها بالعلامة |
    const details = (get(r, 'details') ?? '').replace(/\s*\|\s*/g, '\n').trim().slice(0, 5000);
    const supplier = (get(r, 'supplier') ?? '').slice(0, 200);
    const pNotes = (get(r, 'private_notes') ?? '').slice(0, 3000);
    valid.push({
      line,
      images,
      priv: cost !== null || supplier || pNotes ? { cost_price: cost, supplier: supplier || null, notes: pNotes || null } : null,
      row: {
        name,
        slug: `${slugify(name) || 'p'}-${Math.random().toString(36).slice(2, 8)}`,
        description: get(r, 'description') || null,
        brand: get(r, 'brand') || null,
        ...(shop ? { shop_name: shop } : {}),
        ...(details ? { details } : {}),
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
    const privRows = chunk.flatMap((c) => {
      const pid = idBySlug.get(c.row.slug as string);
      return pid && c.priv ? [{ product_id: pid, ...c.priv }] : [];
    });
    if (privRows.length > 0) {
      const { error: privErr } = await supabase.from('product_private').insert(privRows);
      if (privErr) errors.push(`الدفعة التي تبدأ من سطر ${chunk[0].line}: حُفظت المنتجات لكن تعذّر حفظ التفاصيل الخاصة (شغّل ملف supabase/migrations/006_product_details.sql)`);
    }
    created += data.length;
  }

  revalidatePath('/', 'layout');
  return { created, failed: rows.length - 1 - created, errors: errors.slice(0, 100) };
}
