import type { FileRow } from '@/components/admin/FileBar';
import type { PickRow } from '@/components/admin/ProductPick';
import type { createClient } from '@/lib/supabase/server';

type Sb = Awaited<ReturnType<typeof createClient>>;

/** ملفات المنتجات + منتجات (مسودة أو منشورة) لصفحتي المسودات والمنشور */
export async function loadList(supabase: Sb, publicState: boolean) {
  const { data: fdata, error } = await supabase
    .from('product_files')
    .select('id,name,source,markup,is_public,created_at')
    .eq('is_public', publicState)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100);
  const { data: pdata } = await supabase
    .from('products')
    .select('id,name,price,is_active,published_at,file_id,product_images(url,sort_order)')
    .eq('is_active', publicState)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500);
  const rows: PickRow[] = (pdata ?? []).map((p) => {
    const imgs = [...((p.product_images as { url: string; sort_order: number }[]) ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    return { id: p.id as string, name: p.name as string, price: Number(p.price), is_active: Boolean(p.is_active), published_at: (p.published_at as string | null) ?? null, file_id: (p.file_id as string | null) ?? null, img: imgs[0]?.url };
  });
  const counts = new Map<string, number>();
  for (const r of rows) if (r.file_id) counts.set(r.file_id, (counts.get(r.file_id) ?? 0) + 1);
  const files: FileRow[] = (fdata ?? []).map((f) => ({ ...(f as Omit<FileRow, 'count'>), markup: Number(f.markup), count: counts.get(f.id as string) ?? 0 }));
  return { files, rows, missing: Boolean(error), fileNames: new Map(files.map((f) => [f.id, f.name])) };
}
