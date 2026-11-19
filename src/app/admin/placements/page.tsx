import type { Metadata } from 'next';
import { createSiteAd, deleteSiteAd, toggleSiteAd } from '@/app/actions/siteAds';
import { requirePermission } from '@/lib/auth';
import { AD_PLACEMENTS } from '@/lib/siteAds';
import ZoomImage from '@/components/admin/ZoomImage';
import { ui } from '@/lib/ui';

const ytThumb = (u: string) => { try { const x = new URL(u); const id = x.hostname === 'youtu.be' ? x.pathname.slice(1) : x.hostname.endsWith('youtube.com') ? x.searchParams.get('v') : null; return id ? `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg` : null; } catch { return null; } };

export const metadata: Metadata = { title: 'إعلانات الموقع' };

type Row = { id: string; advertiser: string; placement: string; kind: string; media_url: string; link_url: string | null; price: number; starts_on: string; ends_on: string; is_active: boolean; impressions: number; clicks: number };

export default async function Placements({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { supabase } = await requirePermission('ads');
  const sp = await searchParams;
  const { data, error } = await supabase.from('site_ads').select('*').order('created_at', { ascending: false }).limit(200);
  const rows = (data ?? []) as Row[];
  const today = new Date().toISOString().slice(0, 10);
  const status = (r: Row) => (!r.is_active ? ['موقوف', 'bg-gray-100 text-gray-600'] : r.ends_on < today ? ['انتهى', 'bg-red-50 text-red-700'] : r.starts_on > today ? ['لسه ما بدأش', 'bg-amber-50 text-amber-800'] : ['شغّال دلوقتي', 'bg-green-50 text-green-700']);
  const total = rows.reduce((n, r) => n + Number(r.price), 0);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold">📢 إعلانات الموقع (من براندات بسعر ثابت)</h1>
      {sp.error && <p className={ui.alertError}>{sp.error}</p>}
      {sp.ok && <p className={ui.alertOk}>{sp.ok}</p>}
      {error && <p className={ui.alertError}>لازم تشغّل ملف 029_site_ads.sql في Supabase الأول.</p>}

      <form action={createSiteAd} encType="multipart/form-data" className={`${ui.card} grid gap-3 p-4 md:grid-cols-2`}>
        <h2 className="font-bold md:col-span-2">إضافة إعلان جديد</h2>
        <div><label className={ui.label}>اسم المعلن (الشركة)</label><input name="advertiser" required className={ui.input} /></div>
        <fieldset className="md:col-span-2 rounded-lg border border-gray-200 p-3">
          <legend className="px-1 text-sm font-semibold">اختار الأماكن اللي يظهر فيها (تقدر تختار أكتر من مكان)</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[...new Set(AD_PLACEMENTS.map((x) => x.page))].map((pg) => (
              <div key={pg}>
                <p className="mb-1 text-sm font-bold text-brand-700">{pg}</p>
                {AD_PLACEMENTS.filter((x) => x.page === pg).map((x) => (
                  <label key={x.value} className="flex items-center gap-2 py-0.5 text-sm"><input type="checkbox" name="placement" value={x.value} /> {x.label}</label>
                ))}
              </div>
            ))}
          </div>
        </fieldset>
        <div><label className={ui.label}>النوع</label>
          <select name="kind" className={ui.input}><option value="image">صورة (بانر)</option><option value="video">فيديو</option></select></div>
        <div><label className={ui.label}>رابط المعلن (لما الزائر يدوس)</label><input name="link_url" placeholder="https://..." dir="ltr" className={ui.input} /></div>
        <div><label className={ui.label}>صورة الإعلان (للنوع صورة)</label><input type="file" name="image" accept="image/*" className={ui.input} /></div>
        <div><label className={ui.label}>رابط الفيديو (للنوع فيديو: يوتيوب أو رابط مباشر)</label><input name="media_url" placeholder="https://youtube.com/watch?v=..." dir="ltr" className={ui.input} /></div>
        <div><label className={ui.label}>السعر اللي اتفقت عليه (لو اخترت أكتر من مكان بيتسجّل 0 لكل مكان، سجّله في ملاحظاتك)</label><input type="number" name="price" min="0" step="1" defaultValue="0" className={ui.input} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={ui.label}>من</label><input type="date" name="starts_on" defaultValue={today} required className={ui.input} /></div>
          <div><label className={ui.label}>إلى</label><input type="date" name="ends_on" required className={ui.input} /></div>
        </div>
        <div className="md:col-span-2"><button className={ui.btnDark}>➕ إضافة الإعلان</button>
          <p className="mt-1 text-xs text-gray-500">الإعلان بيظهر لوحده من تاريخ البداية ويختفي بعد تاريخ النهاية. خد الفلوس من المعلن قبل ما تضيفه. الفيديو: حط رابط يوتيوب أو رابط ملف مباشر (مفيش رفع فيديو، عشان المساحة).</p></div>
      </form>

      <p className="text-sm text-gray-600">إجمالي الاتفاقات المسجّلة: <b>{total.toLocaleString('en-US')}</b> ج.م · عدد الإعلانات: {rows.length}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {rows.length === 0 && <p className="text-sm text-gray-500">مفيش إعلانات لسه.</p>}
        {rows.map((r) => {
          const [st, cls] = status(r);
          return (
            <div key={r.id} className={`${ui.card} space-y-2 p-4`}>
              <div className="flex items-center justify-between gap-2">
                <b>{r.advertiser}</b><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${cls}`}>{st}</span>
              </div>
              <p className="text-xs text-gray-500">{AD_PLACEMENTS.find((p) => p.value === r.placement)?.page} › {AD_PLACEMENTS.find((p) => p.value === r.placement)?.label} · {r.kind === 'video' ? 'فيديو' : 'صورة'} · {r.starts_on} ← {r.ends_on} · {Number(r.price).toLocaleString('en-US')} ج.م</p>
              {r.kind === 'image' && <ZoomImage src={r.media_url} alt={r.advertiser} thumbClass="max-h-24 max-w-full" />}
              {r.kind === 'video' && ytThumb(r.media_url) && <ZoomImage src={ytThumb(r.media_url) as string} alt={r.advertiser} thumbClass="max-h-24 max-w-full" />}
              <p className="text-sm">👁 {Number(r.impressions).toLocaleString('en-US')} مشاهدة · 👆 {Number(r.clicks).toLocaleString('en-US')} نقرة · {r.impressions ? ((r.clicks / r.impressions) * 100).toFixed(2) : '0'}%</p>
              <div className="flex gap-2">
                <form action={toggleSiteAd}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="active" value={r.is_active ? '0' : '1'} /><button className={ui.btnOutline}>{r.is_active ? 'إيقاف' : 'تشغيل'}</button></form>
                <form action={deleteSiteAd}><input type="hidden" name="id" value={r.id} /><button className={ui.btnOutline}>حذف</button></form>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
