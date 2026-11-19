import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/config';

export type AdCode = {
  id: string; name: string; type: 'script' | 'container' | 'banner' | 'link';
  src: string | null; container_id: string | null; ad_key: string | null; width: number | null; height: number | null;
  link_url: string | null; link_label: string | null; placement: string; is_active: boolean; sort_order: number;
};

export const getAdCodes = unstable_cache(
  async (placement: string): Promise<AdCode[]> => {
    try {
      const sb = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data } = await sb.from('ad_codes').select('*').eq('placement', placement).eq('is_active', true).order('sort_order');
      return (data ?? []) as AdCode[];
    } catch { return []; }
  },
  ['ad-codes'],
  { revalidate: 60, tags: ['ad-codes'] },
);

export type ParsedCode = Pick<AdCode, 'type' | 'src' | 'container_id' | 'ad_key' | 'width' | 'height' | 'link_url' | 'link_label'>;

const https = (u: string | undefined | null) => (u && /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : null);

/** يحلّل كود إعلان ملصوق (سكربت / حاوية / بانر / رابط) لحقول منظّمة وآمنة. لا نخزّن HTML خام أبدًا */
export function parseAdCode(raw: string): ParsedCode | { error: string } {
  const text = raw.trim();
  if (!text) return { error: 'الصق الكود الأول' };
  if (/^https?:\/\/\S+$/i.test(text)) {
    const u = https(text);
    return u ? { type: 'link', src: null, container_id: null, ad_key: null, width: null, height: null, link_url: u, link_label: '🎁 عروض مميزة' } : { error: 'الرابط لازم يبدأ بـ https://' };
  }
  const srcs = [...text.matchAll(/<script[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
  const src = https(srcs[srcs.length - 1]);
  if (!src) return { error: 'ما لقيتش في الكود سكربت بعنوان https. تأكد إنك نسخت الكود كامل' };
  const key = text.match(/['"]key['"]\s*:\s*['"]([a-z0-9]{8,64})['"]/i)?.[1];
  if (key) {
    const w = Number(text.match(/['"]width['"]\s*:\s*(\d{2,4})/i)?.[1]);
    const h = Number(text.match(/['"]height['"]\s*:\s*(\d{2,4})/i)?.[1]);
    if (!w || !h) return { error: 'ما قدرتش أقرا مقاس البانر (width/height) من الكود' };
    return { type: 'banner', src, container_id: null, ad_key: key, width: w, height: h, link_url: null, link_label: null };
  }
  const cid = text.match(/\bid\s*=\s*["'](container-[a-z0-9]+)["']/i)?.[1];
  if (cid) return { type: 'container', src, container_id: cid, ad_key: null, width: null, height: null, link_url: null, link_label: null };
  return { type: 'script', src, container_id: null, ad_key: null, width: null, height: null, link_url: null, link_label: null };
}
