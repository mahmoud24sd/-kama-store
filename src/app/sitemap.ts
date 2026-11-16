import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getSiteUrl } from '@/lib/site';
import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/config';

export const revalidate = 3600;

/** خريطة الموقع لجوجل: الرئيسية والأقسام وكل المنتجات الظاهرة */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const out: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/products`, changeFrequency: 'daily', priority: 0.9 },
  ];
  try {
    const db = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const [{ data: cats }, { data: prods }] = await Promise.all([
      db.from('categories').select('*'),
      db.from('products').select('slug,created_at').eq('is_active', true).order('created_at', { ascending: false }).limit(5000),
    ]);
    for (const c of cats ?? []) if (!c.admin_only) out.push({ url: `${base}/products?category=${encodeURIComponent(c.slug as string)}`, changeFrequency: 'weekly', priority: 0.7 });
    for (const p of prods ?? []) out.push({ url: `${base}/products/${encodeURIComponent(p.slug as string)}`, lastModified: p.created_at ? new Date(p.created_at as string) : undefined, changeFrequency: 'weekly', priority: 0.6 });
  } catch {
    /* نرجع الصفحات الأساسية بس */
  }
  return out;
}
