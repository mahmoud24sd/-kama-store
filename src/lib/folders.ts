import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';
import type { createClient } from '@/lib/supabase/server';

type Sb = Awaited<ReturnType<typeof createClient>>;
export type FolderProduct = { id: string; name: string; price: number; is_active: boolean; img?: string; category?: string; brand?: string; shop?: string };
export type Folder = { id: string; name: string; source: string; markup: number; is_public: boolean; created_at: string; published_at: string; stage?: string; by: string; publisher: string; products: FolderProduct[]; count: number };
export type FolderKind = 'inbox' | 'draft' | 'public' | 'bot'; // bot = كل ملفات البوت بغض النظر عن المرحلة

/** الملفات كفولدرات: بمنتجاتها، ووقت الرفع، واسم اللي رفع (أدمن الموقع أو أدمن البوت) */
export async function loadFolders(supabase: Sb, kind: FolderKind, page = 1, size = 10, perFolder = 60) {
  const base = () => supabase.from('product_files').select('id,name,source,markup,is_public,created_at,created_by,tg_by', { count: 'exact' }).is('deleted_at', null).order('created_at', { ascending: false }).order('id', { ascending: false }).range((page - 1) * size, page * size - 1);
  let res = kind === 'bot' ? await base().eq('source', 'bot') : await base().eq('stage', kind);
  const noStage = kind !== 'bot' && Boolean(res.error);
  if (noStage) res = kind === 'public' ? await base().eq('is_public', true) : kind === 'inbox' ? await base().eq('source', 'bot').eq('is_public', false) : await base().eq('is_public', false).neq('source', 'bot');
  const files = (res.data ?? []) as { id: string; name: string; source: string; markup: number; is_public: boolean; created_at: string; created_by: string | null; tg_by: number | null }[];

  const byFile = new Map<string, FolderProduct[]>();
  const counts = new Map<string, number>();
  const pubAt = new Map<string, string>();
  const pubBy = new Map<string, string>();
  if (files.length) {
    // Supabase يرجّع 1000 صف بس في الطلب الواحد: نقرأ الخفيف صفحات، وبعدين تفاصيل أول perFolder منتج لكل فولدر
    const fileIds = files.map((f) => f.id);
    const light: { id: string; file_id: string; published_at: string | null; published_by: string | null }[] = [];
    for (let from = 0; from < 40000; from += 1000) {
      const { data } = await supabase.from('products').select('id,file_id,published_at,published_by').in('file_id', fileIds).is('deleted_at', null).order('created_at', { ascending: true }).order('id', { ascending: true }).range(from, from + 999);
      light.push(...((data ?? []) as typeof light));
      if (!data || data.length < 1000) break;
    }
    const picked = new Map<string, number>();
    const pickIds: string[] = [];
    for (const p of light) {
      counts.set(p.file_id, (counts.get(p.file_id) ?? 0) + 1);
      if (p.published_at && p.published_at > (pubAt.get(p.file_id) ?? '')) {
        pubAt.set(p.file_id, p.published_at);
        if (p.published_by) pubBy.set(p.file_id, p.published_by);
      }
      const n = picked.get(p.file_id) ?? 0;
      if (n < perFolder) { picked.set(p.file_id, n + 1); pickIds.push(p.id); }
    }
    const chunks: string[][] = [];
    for (let i = 0; i < pickIds.length; i += 100) chunks.push(pickIds.slice(i, i + 100));
    const details = await Promise.all(chunks.map((ids) => supabase.from('products').select('id,name,price,is_active,file_id,brand,shop_name,categories(name),product_images(url,sort_order)').in('id', ids)));
    const order = new Map(pickIds.map((id, i) => [id, i]));
    const rows = details.flatMap((r) => r.data ?? []).sort((x, y) => (order.get(x.id as string) ?? 0) - (order.get(y.id as string) ?? 0));
    for (const p of rows) {
      const fid = p.file_id as string;
      const list = byFile.get(fid) ?? [];
      const imgs = [...((p.product_images as { url: string; sort_order: number }[]) ?? [])].sort((a, b) => a.sort_order - b.sort_order);
      list.push({ id: p.id as string, name: p.name as string, price: Number(p.price), is_active: Boolean(p.is_active), img: imgs[0]?.url, category: (p.categories as unknown as { name: string } | null)?.name, brand: (p.brand as string | null) ?? undefined, shop: (p.shop_name as string | null) ?? undefined });
      byFile.set(fid, list);
    }
  }

  const stages = new Map<string, string>();
  if (kind === 'bot' && files.length) {
    const { data } = await supabase.from('product_files').select('id,stage').in('id', files.map((f) => f.id));
    for (const r of data ?? []) if (r.stage) stages.set(r.id as string, r.stage as string);
  }

  // أسماء اللي رفع
  const names = new Map<string, string>();
  const uids = [...new Set([...files.map((f) => f.created_by), ...pubBy.values()].filter(Boolean) as string[])];
  if (uids.length) {
    const { data } = await supabase.from('profiles').select('id,full_name,email').in('id', uids);
    for (const u of data ?? []) names.set(`u:${u.id}`, (u.full_name as string) || (u.email as string) || '');
  }
  const tids = [...new Set(files.map((f) => f.tg_by).filter((x): x is number => x != null))];
  if (tids.length && hasServiceRole) {
    const { data } = await createAdminClient().from('telegram_state').select('key,value').in('key', tids.map((t) => `name:${t}`));
    for (const r of data ?? []) names.set(`t:${String(r.key).slice(5)}`, String(r.value));
    // أدمن رفع قبل ما نحفظ اسمه: نجيبه من تليجرام ونخزّنه مرة واحدة
    const token = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
    const missingIds = tids.filter((t) => !names.has(`t:${t}`));
    if (token && missingIds.length) {
      await Promise.all(missingIds.slice(0, 5).map(async (t) => {
        try {
          const r = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${t}`, { signal: AbortSignal.timeout(4000) });
          const c = (await r.json())?.result as { first_name?: string; last_name?: string; username?: string } | undefined;
          const nm = c ? [c.first_name, c.last_name].filter(Boolean).join(' ') || (c.username ? `@${c.username}` : '') : '';
          if (nm) {
            names.set(`t:${t}`, nm);
            await createAdminClient().from('telegram_state').upsert({ key: `name:${t}`, value: nm });
          }
        } catch { /* نكمّل بالاسم العام */ }
      }));
    }
  }

  const folders: Folder[] = files.map((f) => ({
    id: f.id,
    name: f.name,
    source: f.source,
    markup: Number(f.markup),
    is_public: f.is_public,
    created_at: f.created_at,
    published_at: pubAt.get(f.id) ?? f.created_at,
    stage: stages.get(f.id),
    publisher: (pubBy.get(f.id) && names.get(`u:${pubBy.get(f.id)}`)) || (f.created_by && names.get(`u:${f.created_by}`)) || (f.tg_by != null ? names.get(`t:${f.tg_by}`) || 'أدمن البوت' : '') || '—',
    by: (f.created_by && names.get(`u:${f.created_by}`)) || (f.tg_by != null ? names.get(`t:${f.tg_by}`) || 'أدمن البوت' : '') || '—',
    products: byFile.get(f.id) ?? [],
    count: counts.get(f.id) ?? 0,
  }));
  return { folders, legacy: noStage, total: res.count ?? folders.length };
}
