'use server';

import { revalidatePath } from 'next/cache';
import { assertPermission } from '@/lib/auth';
import { existingNames, hasTrashReason, normName } from '@/lib/dedupe';
import { readTable } from '@/lib/importFile';
import { enqueueFile } from '@/lib/social';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';
import { slugify } from '@/lib/utils';

export type ImportState = { created?: number; failed?: number; errors?: string[]; message?: string; fileId?: string; noImages?: number; duplicates?: number };

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
  image_urls: ['image_urls', 'images', 'image', 'image_url', 'imageurl', 'photo', 'photos', 'picture', 'pictures', 'img', 'روابط الصور', 'رابط الصورة', 'رابط صورة', 'الصور', 'الصورة', 'صورة', 'صور'],
  publish: ['publish', 'نشر', 'ظاهر'],
  affiliate_url: ['affiliate_url', 'رابط أمازون', 'رابط الأفيليت', 'amazon_url'],
  asin: ['asin', 'external_id'],
};

const YES = ['yes', 'y', 'true', '1', 'نعم', 'ايوه', 'أيوه', 'نشر', 'ظاهر'];

function num(v: string | undefined): number | null {
  if (v === undefined || v.trim() === '') return null;
  const n = Number(v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,٬\s]/g, '').replace('٫', '.'));
  return Number.isFinite(n) ? n : NaN;
}

export async function importProducts(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const { supabase, profile } = await assertPermission('products');

  // إما نص ملصوق من Excel / Google Sheets، أو ملف (إكسل .xlsx أو CSV أو JSON)
  const pasted = String(formData.get('text') ?? '').trim();
  const file = formData.get('file');
  let rows: string[][];
  let fileName = `ملصوق ${new Date().toLocaleDateString('en-GB')}`;
  try {
    if (pasted) {
      if (pasted.length > 3 * 1024 * 1024) return { message: 'النص أكبر من 3 ميجابايت' };
      rows = (await readTable(pasted)).rows;
    } else {
      if (!(file instanceof File) || file.size === 0) return { message: 'الصق الجدول في الخانة أو اختر ملف إكسل / CSV / JSON' };
      if (file.size > 8 * 1024 * 1024) return { message: 'الملف أكبر من 8 ميجابايت' };
      rows = (await readTable(file)).rows;
      fileName = (file.name || fileName).replace(/\.(xlsx|csv|json|txt)$/i, '').slice(0, 120) || fileName;
    }
  } catch (e) {
    return { message: e instanceof Error && e.message ? `تعذّر قراءة الملف: ${e.message}` : 'تعذّر قراءة الملف. اتأكد إنه إكسل (xlsx) أو CSV أو JSON سليم.' };
  }
  const mode = String(formData.get('mode') ?? 'csv');
  const catPick = String(formData.get('category_id') ?? '');
  const addMoney = Math.min(Math.max(Number(formData.get('markup') ?? 0) || 0, 0), 1_000_000);
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
      .split(/[|\n\s,;،]+/)
      .map((u) => u.trim().replace(/^<|>$/g, '').replace(/^http:\/\//i, 'https://'))
      .filter(Boolean);
    for (const u of images) {
      try {
        if (new URL(u).protocol !== 'https:') throw new Error();
      } catch {
        return void errors.push(`سطر ${line} (${name}): رابط الصورة غير صالح (يجب أن يبدأ بـ https://): ${u.slice(0, 60)}`);
      }
    }
    if (images.length > 6) return void errors.push(`سطر ${line} (${name}): الحد الأقصى 6 صور`);

    // منتج أفيليت: رابط أمازون (https). الشراء يتم على أمازون ولا يدخل سلة الموقع
    const affRaw = get(r, 'affiliate_url') ?? '';
    let affiliate: string | null = null;
    if (affRaw) {
      try {
        const u = new URL(affRaw);
        const okHost = /(^|\.)amazon\.[a-z.]+$/i.test(u.hostname) || /(^|\.)amzn\.(to|eu|asia)$/i.test(u.hostname) || u.hostname === 'a.co';
        if (u.protocol !== 'https:' || !okHost) throw new Error();
        affiliate = u.toString();
      } catch {
        return void errors.push(`سطر ${line} (${name}): رابط أمازون غير صالح (يجب أن يكون https من amazon أو amzn.to)`);
      }
    }
    const asin = (get(r, 'asin') ?? '').toUpperCase().slice(0, 20);

    const publish = mode === 'public' ? true : mode === 'draft' ? false : YES.includes((get(r, 'publish') ?? '').toLowerCase());
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
        category_id: catName ? catMap.get(catName) : ([...catMap.values()].includes(catPick) ? catPick : null),
        price,
        compare_at_price: compare,
        stock: stock ?? 0,
        is_active: publish,
        ...(affiliate ? { affiliate_url: affiliate, affiliate_source: 'amazon', stock: 0, ...(asin ? { external_id: asin } : {}) } : {}),
      },
    });
  });

  // الزيادة المختارة (جنيه) تتطبق تلقائيًا على كل منتج
  const origPrice = new Map<number, number>();
  if (addMoney > 0) {
    for (const c of valid) {
      const orig = Number(c.row.price);
      origPrice.set(c.line, orig);
      c.row.price = orig + addMoney;
      if (c.row.compare_at_price != null && Number(c.row.compare_at_price) < orig + addMoney) c.row.compare_at_price = null;
    }
  }

  // الملف نفسه = مجموعة. الزيادة = الفرق الأكثر تكرارًا بين السعر وسعر التكلفة (لو الملف جاي من البوت)
  const diffs = valid.map((c) => (c.priv?.cost_price != null && Number(c.row.price) >= c.priv.cost_price ? Number(c.row.price) - c.priv.cost_price : null)).filter((d): d is number => d !== null && d > 0);
  const freq = new Map<number, number>();
  for (const d of diffs) freq.set(d, (freq.get(d) ?? 0) + 1);
  const markup = addMoney > 0 ? addMoney : ([...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0);
  let fileId: string | null = null;
  if (valid.length > 0) {
    const base = { name: fileName, source: 'import', markup, is_public: mode === 'public', created_by: profile.id };
    let { data: pf } = await supabase.from('product_files').insert({ ...base, stage: mode === 'public' ? 'public' : 'draft' }).select('id').single();
    if (!pf) ({ data: pf } = await supabase.from('product_files').insert(base).select('id').single()); // قبل تشغيل 024
    fileId = (pf?.id as string | undefined) ?? null;
    if (fileId) {
      for (const c of valid) {
        const cost = c.priv?.cost_price;
        c.row.file_id = fileId;
        c.row.base_price = origPrice.has(c.line) ? origPrice.get(c.line) : cost != null && cost <= Number(c.row.price) ? cost : Math.max(Number(c.row.price) - markup, 0);
      }
    } else {
      errors.push('المنتجات اتحفظت لكن من غير «ملف» لأن ملف supabase/migrations/020_product_files.sql لسه ما اتشغّلش.');
    }
  }
  // المنتج المتكرر (نفس الاسم موجود قبل كده أو مكرر في الملف) ما بيترفعش: بيتحط في المهملات بسبب «متكرر»
  const seen = await existingNames(supabase);
  const canReason = await hasTrashReason(supabase);
  const dupLines = new Set<number>();
  for (const c of valid) {
    const key = normName(String(c.row.name));
    if (seen.has(key)) dupLines.add(c.line);
    else seen.add(key);
  }
  if (dupLines.size > 0) {
    if (canReason && fileId) {
      const now = new Date().toISOString();
      for (const c of valid) {
        if (!dupLines.has(c.line)) continue;
        c.row.deleted_at = now;
        c.row.is_active = false;
        c.row.trash_reason = 'متكرر';
        c.images = [];
        c.priv = null;
      }
    } else {
      for (let i = valid.length - 1; i >= 0; i--) if (dupLines.has(valid[i].line)) valid.splice(i, 1);
      errors.push(`${dupLines.size} منتج متكرر ما اترفعش (شغّل ملفي 020 و022 عشان يتسجّلوا في المهملات).`);
    }
  }
  const noImages = valid.filter((c) => !dupLines.has(c.line) && c.images.length === 0).length;

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
    // سجّل من نشر المنتجات المنشورة (لا يؤثر على الاستيراد لو لم يُشغَّل ملف 008 بعد)
    const publishedIds = chunk
      .filter((c) => c.row.is_active)
      .map((c) => idBySlug.get(c.row.slug as string))
      .filter((x): x is string => Boolean(x));
    if (publishedIds.length > 0) {
      await supabase.from('products').update({ published_by: profile.id, published_at: new Date().toISOString() }).in('id', publishedIds);
    }
    const privRows = chunk.flatMap((c) => {
      const pid = idBySlug.get(c.row.slug as string);
      return pid && c.priv ? [{ product_id: pid, ...c.priv }] : [];
    });
    if (privRows.length > 0) {
      const { error: privErr } = await supabase.from('product_private').insert(privRows);
      if (privErr) errors.push(`الدفعة التي تبدأ من سطر ${chunk[0].line}: حُفظت المنتجات لكن تعذّر حفظ التفاصيل الخاصة (شغّل ملف supabase/migrations/006_product_details.sql)`);
    }
    created += data.filter((d) => !chunk.some((c) => c.row.slug === d.slug && dupLines.has(c.line))).length;
  }

  if (fileId && mode === 'public' && hasServiceRole) await enqueueFile(createAdminClient(), fileId);
  revalidatePath('/', 'layout');
  return { created, failed: rows.length - 1 - created - dupLines.size, errors: errors.slice(0, 100), fileId: fileId ?? undefined, noImages, duplicates: dupLines.size };
}
