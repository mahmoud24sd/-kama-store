import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { addAdCode, deleteAdCode, toggleAdCode, toggleAllAdCodes } from '@/app/actions/adCodes';
import { requireAdmin } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import type { AdCode } from '@/lib/adCodes';
import { AD_PLACEMENTS } from '@/lib/siteAds';
import AdCodeTree from '@/components/admin/AdCodeTree';
import Link from 'next/link';
import ZoomImage from '@/components/admin/ZoomImage';
import { ui } from '@/lib/ui';

const ytThumb = (u: string) => { try { const x = new URL(u); const id = x.hostname === 'youtu.be' ? x.pathname.slice(1) : x.hostname.endsWith('youtube.com') ? x.searchParams.get('v') : null; return id ? `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg` : null; } catch { return null; } };

export const metadata: Metadata = { title: 'أكواد الإعلانات' };

const TYPE: Record<string, string> = { script: 'سكربت', container: 'بانر Native', banner: 'بانر', link: 'رابط إعلان' };

export default async function AdCodesPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { supabase, profile } = await requireAdmin();
  if (!hasPermission(profile, 'ad_codes') && !hasPermission(profile, 'ad_codes_manage')) redirect('/admin/no-access');
  const sp = await searchParams;
  const isOwner = hasPermission(profile, 'ad_codes_manage'); // يضيف ويحذف
  const { data, error } = await supabase.from('ad_codes').select('*').order('sort_order').order('created_at');
  const codes = (data ?? []) as AdCode[];
  // اسم الأدمن اللي جاب الكود (الأدمن العادي ما بيشوفش أسماء غيره)
  const ids = [...new Set(codes.map((c) => c.created_by).filter(Boolean) as string[])];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: ps } = await supabase.from('profiles').select('id,full_name').in('id', ids);
    for (const u of ps ?? []) names.set(u.id as string, (u.full_name as string) || 'أدمن');
  }
  const { data: dAds, error: dAdsErr } = await supabase.from('site_ads').select('id,advertiser,kind,media_url,is_active').order('created_at', { ascending: false }).limit(20);
  const directAds = (dAds ?? []) as { id: string; advertiser: string; kind: string; media_url: string; is_active: boolean }[];
  const items = codes.map((c) => ({ ...c, adminName: !c.created_by ? 'غير محدد' : profile.role !== 'owner' && c.created_by !== profile.id ? 'أدمن' : names.get(c.created_by) ?? 'أدمن' }));
  const placeLabel = (v: string) => (v === 'global' ? 'كل الصفحات (خلفية)' : AD_PLACEMENTS.find((p) => p.value === v)?.label ?? v);
  const running = codes.filter((c) => c.is_active).length;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold">🔌 أكواد الإعلانات التلقائية (Adsterra / Monetag…)</h1>
      {sp.error && <p className={ui.alertError}>{sp.error}</p>}
      {sp.ok && <p className={ui.alertOk}>{sp.ok}</p>}
      {error && <p className={ui.alertError}>لازم تشغّل ملف 031_ad_codes.sql في Supabase الأول.</p>}

      <div className={`${ui.card} flex flex-wrap items-center justify-between gap-3 p-4`}>
        <p className="text-sm">شغّال دلوقتي: <b>{running}</b> من <b>{codes.length}</b> إعلان. الإعلانات مش بتظهر للمالك والأدمن، بتظهر للزوار والعملاء بس.</p>
        <div className="flex gap-2">
          <form action={toggleAllAdCodes}><input type="hidden" name="active" value="1" /><button className={ui.btnDark}>▶ شغّل الكل</button></form>
          <form action={toggleAllAdCodes}><input type="hidden" name="active" value="0" /><button className={ui.btnOutline}>⏸ أوقف الكل</button></form>
        </div>
      </div>

      <AdCodeTree
        items={items}
        card={(c) => (
          <div key={c.id} className={`rounded-lg border border-gray-200 p-2.5 text-xs ${c.is_active ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
            <div className="flex items-start justify-between gap-1">
              <b className="text-[13px] leading-5">{c.name}</b>
              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${c.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-200 text-gray-600'}`}>{c.is_active ? 'شغّال' : 'موقوف'}</span>
            </div>
            {c.type === 'banner' && c.width && c.height && (
              <div className="mt-1 flex items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 text-[10px] text-gray-500" style={{ width: Math.min(c.width, 220), aspectRatio: `${c.width}/${c.height}`, maxWidth: '100%' }}>{c.width}×{c.height}</div>
            )}
            <p className="mt-0.5 text-gray-500">{TYPE[c.type]} · {placeLabel(c.placement)}{c.type === 'banner' ? ` · ${c.width}×${c.height}` : ''}</p>
            <div className="mt-1.5 flex gap-1.5">
              <form action={toggleAdCode}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="active" value={c.is_active ? '0' : '1'} /><button className={c.is_active ? ui.btnOutline : ui.btnDark}>{c.is_active ? '⏸ إيقاف' : '▶ تشغيل'}</button></form>
              {isOwner && <form action={deleteAdCode}><input type="hidden" name="id" value={c.id} /><button className={ui.btnOutline}>حذف</button></form>}
            </div>
          </div>
        )}
      />
      {codes.length === 0 && !error && <p className="text-sm text-gray-500">مفيش أكواد لسه.</p>}

      {directAds.length === 0 && (
        <section className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 text-sm">
          <h2 className="font-bold">🖼 إعلانات المعلنين (صور وفيديو)</h2>
          <p className="text-gray-600">
            {dAdsErr
              ? 'الجدول بتاع الإعلانات المباشرة مش موجود. شغّل ملف SQL رقم 029 (و030) في Supabase.'
              : 'لسه مفيش إعلان صورة أو فيديو مضاف. ضيف واحد من صفحة الأماكن الإعلانية وهيظهر هنا.'}
          </p>
          <Link href="/admin/placements" className={ui.btnOutline}>صفحة إعلانات المعلنين ←</Link>
        </section>
      )}

      {directAds.length > 0 && (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">🖼 إعلانات المعلنين (صور وفيديو)</h2>
            <Link href="/admin/placements" className={ui.btnOutline}>إدارتها ←</Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {directAds.map((a) => {
              const thumb = a.kind === 'image' ? a.media_url : ytThumb(a.media_url);
              return (
                <div key={a.id} className={`rounded-lg border border-gray-200 bg-white p-2 text-xs ${a.is_active ? '' : 'opacity-60'}`}>
                  {thumb ? <ZoomImage src={thumb} alt={a.advertiser} thumbClass="h-20 w-full" /> : <div className="flex h-20 items-center justify-center rounded bg-gray-100 text-gray-500">🎬 فيديو</div>}
                  <p className="mt-1 truncate font-semibold">{a.advertiser}</p>
                  <p className="text-gray-500">{a.is_active ? '✅ شغّال' : '⏸ موقوف'} · {a.kind === 'video' ? 'فيديو' : 'صورة'}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {isOwner && (
        <form action={addAdCode} className={`${ui.card} grid gap-3 p-4 md:grid-cols-2`}>
          <h2 className="font-bold md:col-span-2">➕ إضافة كود إعلان جديد</h2>
          <div><label className={ui.label}>اسم للإعلان (لنفسك)</label><input name="name" required placeholder="مثلًا: Monetag بانر" className={ui.input} /></div>
          <div><label className={ui.label}>يظهر فين</label>
            <select name="placement" className={ui.input}>
              <option value="global">كل الصفحات (للأكواد الخلفية بدون شكل)</option>
              {AD_PLACEMENTS.map((p) => <option key={p.value} value={p.value}>{p.page} › {p.label}</option>)}
            </select></div>
          <div className="md:col-span-2"><label className={ui.label}>الصق كود الإعلان كامل (أو لينك إعلان بس)</label>
            <textarea name="code" required rows={5} dir="ltr" placeholder={'<script async src="https://..."></script>\n<div id="container-..."></div>'} className={`${ui.input} font-mono text-xs`} /></div>
          <div><label className={ui.label}>لو لينك: النص اللي يظهر على الزرار</label><input name="link_label" placeholder="🎁 عروض مميزة" className={ui.input} /></div>
          <div className="flex items-end"><button className={ui.btnDark}>إضافة وتشغيل</button></div>
          <p className="text-xs text-gray-500 md:col-span-2">الموقع بيقرا من الكود بس عنوان السكربت والمقاس والمعرّف، وبيبني الإعلان بنفسه. الأكواد دي بتشتغل عند كل زائر، فالإضافة والحذف للمالك أو لأدمن معاه صلاحية خاصة.</p>
        </form>
      )}
    </div>
  );
}
