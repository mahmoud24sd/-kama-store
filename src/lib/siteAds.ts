import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/config';

export const AD_PLACEMENTS = [
  { value: 'home_top', label: 'الصفحة الرئيسية (فوق الأقسام)' },
  { value: 'products_top', label: 'صفحة المنتجات (فوق الشبكة)' },
  { value: 'product_page', label: 'صفحة المنتج (تحت زر الشراء)' },
  { value: 'footer_top', label: 'أسفل كل الصفحات (فوق الفوتر)' },
] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number]['value'];

export type SiteAd = { id: string; advertiser: string; placement: string; kind: 'image' | 'video'; media_url: string; link_url: string | null };

/** الإعلانات الشغّالة النهاردة في مكان معيّن (تتخزن دقيقة) */
export const getAds = unstable_cache(
  async (placement: string): Promise<SiteAd[]> => {
    try {
      const sb = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data } = await sb.from('site_ads').select('id,advertiser,placement,kind,media_url,link_url').eq('placement', placement).order('created_at', { ascending: false }).limit(3);
      return (data ?? []) as SiteAd[];
    } catch {
      return [];
    }
  },
  ['site-ads'],
  { revalidate: 60, tags: ['site-ads'] },
);

/** يحوّل رابط يوتيوب/فيميو لرابط تضمين. null لو مش مدعوم (يتعامل معاه كملف فيديو مباشر) */
export function embedUrl(u: string): string | null {
  try {
    const x = new URL(u);
    if (x.hostname.endsWith('youtube.com') || x.hostname === 'youtu.be') {
      const id = x.hostname === 'youtu.be' ? x.pathname.slice(1) : x.searchParams.get('v') ?? x.pathname.split('/').pop();
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0` : null;
    }
    if (x.hostname.endsWith('vimeo.com')) {
      const id = x.pathname.split('/').filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${encodeURIComponent(id)}` : null;
    }
  } catch { /* ignore */ }
  return null;
}
