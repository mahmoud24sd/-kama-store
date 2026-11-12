import { getSiteUrl } from '@/lib/site';
import type { createAdminClient } from '@/lib/supabase/admin';

type Db = ReturnType<typeof createAdminClient>;
export type Platform = 'facebook' | 'instagram';

const GRAPH = 'https://graph.facebook.com/v21.0';
const env = (k: string) => (process.env[k] ?? '').trim();

/** المنصات اللي متغيراتها مضبوطة في Vercel */
export function configuredPlatforms(): Platform[] {
  const out: Platform[] = [];
  if (env('META_PAGE_ID') && env('META_PAGE_TOKEN')) out.push('facebook');
  if (env('META_IG_USER_ID') && env('META_PAGE_TOKEN')) out.push('instagram');
  return out;
}

export async function socialAutoOn(db: Db): Promise<boolean> {
  const { data } = await db.from('app_settings').select('value').eq('key', 'social_auto').maybeSingle();
  return String(data?.value ?? '') === 'on';
}

/** يضيف المنتجات المنشورة لطابور السوشيال (مرة واحدة لكل منتج ومنصة). لا يرمي أخطاء أبدًا */
export async function enqueueSocial(db: Db, productIds: string[]) {
  try {
    const platforms = configuredPlatforms();
    if (platforms.length === 0 || productIds.length === 0 || !(await socialAutoOn(db))) return;
    const rows = productIds.flatMap((product_id) => platforms.map((platform) => ({ product_id, platform })));
    for (let i = 0; i < rows.length; i += 200) {
      await db.from('social_posts').upsert(rows.slice(i, i + 200), { onConflict: 'product_id,platform', ignoreDuplicates: true });
    }
  } catch {
    /* الطابور اختياري */
  }
}

/** نفس الشيء لكل منتجات ملف */
export async function enqueueFile(db: Db, fileId: string) {
  try {
    const { data } = await db.from('products').select('id').eq('file_id', fileId).eq('is_active', true).is('deleted_at', null).limit(1000);
    await enqueueSocial(db, (data ?? []).map((p) => p.id as string));
  } catch {
    /* ignore */
  }
}

async function graph(path: string, params: Record<string, string>) {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...params, access_token: env('META_PAGE_TOKEN') }),
    signal: AbortSignal.timeout(25000),
  });
  const j = (await res.json().catch(() => ({}))) as { id?: string; post_id?: string; error?: { message?: string } };
  if (!res.ok || j.error) throw new Error(j.error?.message ?? `HTTP ${res.status}`);
  return j;
}

function caption(p: { name: string; price: number; description: string | null; slug: string }) {
  const tags = env('SOCIAL_HASHTAGS') || '#كاما_ستور #تسوق_اونلاين #مصر';
  const link = `${getSiteUrl()}/products/${p.slug}`;
  const desc = (p.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 250);
  return [p.name.slice(0, 150), `💰 ${p.price} جنيه`, desc, `🛒 اطلب من هنا: ${link}`, tags].filter(Boolean).join('\n\n').slice(0, 2000);
}

async function postOne(platform: Platform, text: string, image: string): Promise<string> {
  if (platform === 'facebook') {
    const j = await graph(`${env('META_PAGE_ID')}/photos`, { url: image, caption: text });
    return j.post_id ?? j.id ?? '';
  }
  const igId = env('META_IG_USER_ID');
  const c = await graph(`${igId}/media`, { image_url: image, caption: text });
  if (!c.id) throw new Error('انستجرام ما رجّعش container');
  try {
    return (await graph(`${igId}/media_publish`, { creation_id: c.id })).id ?? '';
  } catch {
    await new Promise((r) => setTimeout(r, 4000)); // أحيانًا الصورة لسه بتتجهّز
    return (await graph(`${igId}/media_publish`, { creation_id: c.id })).id ?? '';
  }
}

/** ينشر دفعة صغيرة من الطابور (للالتزام بحدود انستجرام: 100 منشور/24 ساعة) */
export async function runSocialBatch(db: Db, perPlatform = 2) {
  const result = { sent: 0, failed: 0, skipped: 0 };
  for (const platform of configuredPlatforms()) {
    const { data: queue } = await db.from('social_posts').select('id,product_id').eq('platform', platform).eq('status', 'pending').order('created_at', { ascending: true }).limit(perPlatform);
    for (const q of queue ?? []) {
      // احجز الصف عشان نفس المنشور ما يتبعتش مرتين
      const { data: claimed } = await db.from('social_posts').update({ status: 'sending' }).eq('id', q.id).eq('status', 'pending').select('id');
      if (!claimed?.length) continue;
      const { data: p } = await db.from('products').select('name,price,description,slug,is_active,deleted_at,product_images(url,sort_order)').eq('id', q.product_id).maybeSingle();
      const imgs = [...(((p?.product_images as { url: string; sort_order: number }[]) ?? []))].sort((a, b) => a.sort_order - b.sort_order);
      if (!p || !p.is_active || p.deleted_at || imgs.length === 0) {
        await db.from('social_posts').update({ status: 'skipped', error: !p || !p.is_active || p.deleted_at ? 'المنتج مش ظاهر دلوقتي' : 'بدون صورة' }).eq('id', q.id);
        result.skipped++;
        continue;
      }
      try {
        const id = await postOne(platform, caption({ name: p.name as string, price: Number(p.price), description: (p.description as string | null) ?? null, slug: p.slug as string }), imgs[0].url);
        await db.from('social_posts').update({ status: 'sent', external_id: id, posted_at: new Date().toISOString(), error: null }).eq('id', q.id);
        result.sent++;
      } catch (e) {
        const { data: cur } = await db.from('social_posts').select('attempts').eq('id', q.id).maybeSingle();
        await db.from('social_posts').update({ status: 'failed', attempts: Number(cur?.attempts ?? 0) + 1, error: (e instanceof Error ? e.message : 'خطأ').slice(0, 300) }).eq('id', q.id);
        result.failed++;
      }
    }
  }
  return result;
}
