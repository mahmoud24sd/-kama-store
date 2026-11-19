import { after } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/config';
import { getProfile } from '@/lib/auth';
import { embedUrl, getAds } from '@/lib/siteAds';
import { getAdCodes } from '@/lib/adCodes';
import AdCodeSlot from './AdCodeSlot';

/** إعلانات مباشرة من براندات في مكان معيّن. مش بتظهر للمالك والأدمن (عشان العدّاد ميتلخبطش) */
export default async function SiteAds({ placement, className = '' }: { placement: string; className?: string }) {
  const viewer = await getProfile().catch(() => null);
  if (viewer && (viewer.role === 'owner' || viewer.role === 'admin')) return null;
  const [ads, codes] = await Promise.all([getAds(placement), getAdCodes(placement)]);
  if (!ads.length && !codes.length) return null;

  if (ads.length) after(async () => {
    try {
      const sb = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      await Promise.all(ads.map((a) => sb.rpc('ad_view', { p_id: a.id })));
    } catch { /* ignore */ }
  });

  return (
    <div className={`space-y-3 ${className}`}>
      {codes.map((c) => <AdCodeSlot key={c.id} code={c} />)}
      {ads.map((a) => {
        const emb = a.kind === 'video' ? embedUrl(a.media_url) : null;
        return (
          <div key={a.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between px-3 py-1 text-[11px] text-gray-500">
              <span>إعلان · {a.advertiser}</span>
            </div>
            {a.kind === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              a.link_url ? <a href={`/go/${a.id}`} target="_blank" rel="sponsored noopener noreferrer"><img src={a.media_url} alt={a.advertiser} loading="lazy" className="mx-auto max-h-64 w-full object-contain" /></a> : <img src={a.media_url} alt={a.advertiser} loading="lazy" className="mx-auto max-h-64 w-full object-contain" />
            ) : emb ? (
              <div className="aspect-video w-full"><iframe src={emb} title={a.advertiser} loading="lazy" allow="encrypted-media; picture-in-picture" allowFullScreen className="h-full w-full border-0" /></div>
            ) : (
              <video src={a.media_url} controls muted playsInline preload="metadata" className="mx-auto max-h-80 w-full bg-black" />
            )}
            {a.kind === 'video' && a.link_url && (
              <a href={`/go/${a.id}`} target="_blank" rel="sponsored noopener noreferrer" className="block bg-brand-800 px-3 py-2 text-center text-sm font-bold text-white hover:bg-brand-700">اعرف أكتر ←</a>
            )}
          </div>
        );
      })}
    </div>
  );
}
