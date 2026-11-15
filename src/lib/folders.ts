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
    const { data } = await supabase
      .from('products')
      .select('id,name,price,is_active,file_id,brand,shop_name,published_at,published_by,categories(name),product_images(url,sort_order)')
      .in('file_id', files.map((f) => f.id))
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(5000);
    for (const p of data ?? []) {
      const fid = p.file_id as string;
      counts.set(fid, (counts.get(fid) ?? 0) + 1);
      const pa = p.published_at as string | null;
      if (pa && pa > (pubAt.get(fid) ?? '')) {
        pubAt.set(fid, pa);
        if (p.published_by) pubBy.set(fid, p.published_by as string);
      }
      const list = byFile.get(fid) ?? [];
      if (list.length < perFolder) {
        const imgs = [...((p.product_images as { url: string; sort_order: number }[]) ?? [])].sort((a, b) => a.sort_order - b.sort_order);
        list.push({ id: p.id as string, name: p.name as string, price: Number(p.price), is_active: Boolean(p.is_active), img: imgs[0]?.url, category: (p.categories as unknown as { name: string } | null)?.name, brand: (p.brand as string | null) ?? undefined, shop: (p.shop_name as string | null) ?? undefined });
        byFile.set(fid, list);
      }
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
