import { slugify } from '@/lib/utils';
import type { createAdminClient } from '@/lib/supabase/admin';

type Db = ReturnType<typeof createAdminClient>;

export type Source = {
  id: string;
  name: string;
  kind: 'shopify' | 'woocommerce';
  base_url: string;
  category_id: string | null;
  markup_percent: number;
  rate: number;
  per_run: number;
  cursor_page: number;
};

type Item = {
  externalId: string;
  name: string;
  description: string;
  brand: string | null;
  price: number;
  compare: number | null;
  inStock: boolean;
  images: string[];
};

const PAGE_SIZE = 50;
const strip = (html: string) =>
  html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/p>|<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 4000);

const httpsOnly = (u: unknown): string | null => {
  try {
    const url = new URL(String(u));
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
};

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'KamaStoreImporter/1.0' }, signal: AbortSignal.timeout(15000), cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchPage(src: Source, page: number): Promise<Item[]> {
  const base = src.base_url.replace(/\/+$/, '');
  if (src.kind === 'shopify') {
    const data = (await getJson(`${base}/products.json?limit=${PAGE_SIZE}&page=${page}`)) as { products?: Record<string, unknown>[] };
    return (data.products ?? []).flatMap((p) => {
      const variants = (p.variants as Record<string, unknown>[] | undefined) ?? [];
      const v = variants.find((x) => x.available) ?? variants[0];
      const price = Number(v?.price);
      if (!Number.isFinite(price) || price <= 0) return [];
      const compare = Number(v?.compare_at_price);
      return [{
        externalId: String(p.id),
        name: String(p.title ?? '').slice(0, 200),
        description: strip(String(p.body_html ?? '')),
        brand: p.vendor ? String(p.vendor).slice(0, 100) : null,
        price,
        compare: Number.isFinite(compare) && compare > price ? compare : null,
        inStock: variants.some((x) => x.available),
        images: ((p.images as { src?: string }[] | undefined) ?? []).map((i) => httpsOnly(i.src)).filter((x): x is string => Boolean(x)).slice(0, 6),
      }];
    });
  }
  const data = (await getJson(`${base}/wp-json/wc/store/v1/products?per_page=${PAGE_SIZE}&page=${page}`)) as Record<string, unknown>[];
  return (Array.isArray(data) ? data : []).flatMap((p) => {
    const prices = (p.prices as Record<string, string> | undefined) ?? {};
    const minor = Number(prices.currency_minor_unit ?? 2);
    const div = 10 ** (Number.isFinite(minor) ? minor : 2);
    const price = Number(prices.price) / div;
    if (!Number.isFinite(price) || price <= 0) return [];
    const regular = Number(prices.regular_price) / div;
    return [{
      externalId: String(p.id),
      name: strip(String(p.name ?? '')).slice(0, 200),
      description: strip(String(p.description || p.short_description || '')),
      brand: null,
      price,
      compare: Number.isFinite(regular) && regular > price ? regular : null,
      inStock: p.is_in_stock !== false,
      images: ((p.images as { src?: string }[] | undefined) ?? []).map((i) => httpsOnly(i.src)).filter((x): x is string => Boolean(x)).slice(0, 6),
    }];
  });
}

/** يشغّل مصدرًا واحدًا: يجلب صفحة، يتخطى المنتجات الموجودة، ويضيف حتى per_run منتج جديد. لا يحذف شيئًا أبدًا */
export async function runSource(db: Db, src: Source): Promise<{ added: number; status: string }> {
  const tag = `src-${src.id}`;
  let page = Math.max(1, src.cursor_page);
  let items: Item[];
  try {
    items = await fetchPage(src, page);
  } catch (e) {
    return { added: 0, status: `فشل الجلب: ${e instanceof Error ? e.message : 'خطأ'}` };
  }
  // وصلنا لنهاية المتجر: نبدأ من الأول في المرة القادمة لالتقاط ما أُضيف حديثًا
  if (items.length === 0) {
    await db.from('product_sources').update({ cursor_page: 1 }).eq('id', src.id);
    return { added: 0, status: page === 1 ? 'المتجر لا يعرض منتجات' : 'اكتملت الدورة، سنبدأ من الأول' };
  }

  const { data: existing } = await db.from('products').select('external_id').eq('affiliate_source', tag).in('external_id', items.map((i) => i.externalId));
  const have = new Set((existing ?? []).map((r) => String(r.external_id)));
  const fresh = items.filter((i) => !have.has(i.externalId) && i.name.length >= 2);
  const batch = fresh.slice(0, src.per_run);
  const pageDone = fresh.length <= src.per_run;

  let added = 0;
  if (batch.length > 0) {
    const calc = (n: number) => Math.round(n * src.rate * (1 + src.markup_percent / 100) * 100) / 100;
    const rows = batch.map((i) => ({
      name: i.name,
      slug: `${slugify(i.name) || 'p'}-${Math.random().toString(36).slice(2, 8)}`,
      description: i.description || null,
      brand: i.brand,
      category_id: src.category_id,
      price: calc(i.price),
      compare_at_price: i.compare ? calc(i.compare) : null,
      stock: i.inStock ? 10 : 0,
      is_active: true,
      affiliate_source: tag,
      external_id: i.externalId,
    }));
    const { data, error } = await db.from('products').insert(rows).select('id,external_id');
    if (error || !data) return { added: 0, status: 'تعذّر الحفظ (تأكد من تشغيل ملف 010 و011)' };
    const idByExt = new Map(data.map((d) => [String(d.external_id), d.id as string]));
    const imgs = batch.flatMap((i) => {
      const pid = idByExt.get(i.externalId);
      return pid ? i.images.map((url, n) => ({ product_id: pid, url, sort_order: n })) : [];
    });
    if (imgs.length > 0) await db.from('product_images').insert(imgs);
    const priv = batch.flatMap((i) => {
      const pid = idByExt.get(i.externalId);
      return pid ? [{ product_id: pid, cost_price: Math.round(i.price * src.rate * 100) / 100, supplier: src.name, notes: `مصدر: ${src.base_url}` }] : [];
    });
    if (priv.length > 0) await db.from('product_private').insert(priv);
    added = data.length;
  }

  await db
    .from('product_sources')
    .update({ cursor_page: pageDone ? page + 1 : page })
    .eq('id', src.id);
  return { added, status: added > 0 ? `أُضيف ${added} منتج` : 'لا جديد في هذه الصفحة' };
}
