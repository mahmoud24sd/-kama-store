import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { addAdCode, deleteAdCode, toggleAdCode, toggleAllAdCodes } from '@/app/actions/adCodes';
import { requireAdmin } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import type { AdCode } from '@/lib/adCodes';
import { AD_PLACEMENTS } from '@/lib/siteAds';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'أكواد الإعلانات' };

const TYPE: Record<string, string> = { script: 'سكربت', container: 'بانر Native', banner: 'بانر', link: 'رابط إعلان' };

export default async function AdCodesPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { supabase, profile } = await requireAdmin();
  if (!hasPermission(profile, 'ad_codes') && !hasPermission(profile, 'ad_codes_manage')) redirect('/admin/no-access');
  const sp = await searchParams;
  const isOwner = hasPermission(profile, 'ad_codes_manage'); // يضيف ويحذف
  const { data, error } = await supabase.from('ad_codes').select('*').order('sort_order').order('created_at');
  const codes = (data ?? []) as AdCode[];
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

      <div className="grid gap-3 md:grid-cols-2">
        {codes.map((c) => (
          <div key={c.id} className={`${ui.card} space-y-2 p-4 ${c.is_active ? '' : 'opacity-60'}`}>
            <div className="flex items-center justify-between gap-2">
              <b className="text-sm">{c.name}</b>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${c.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{c.is_active ? 'شغّال' : 'موقوف'}</span>
            </div>
            <p className="text-xs text-gray-500">{TYPE[c.type]} · {placeLabel(c.placement)}{c.type === 'banner' ? ` · ${c.width}×${c.height}` : ''}</p>
            <div className="flex gap-2">
              <form action={toggleAdCode}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="active" value={c.is_active ? '0' : '1'} /><button className={c.is_active ? ui.btnOutline : ui.btnDark}>{c.is_active ? '⏸ إيقاف' : '▶ تشغيل'}</button></form>
              {isOwner && <form action={deleteAdCode}><input type="hidden" name="id" value={c.id} /><button className={ui.btnOutline}>حذف</button></form>}
            </div>
          </div>
        ))}
        {codes.length === 0 && !error && <p className="text-sm text-gray-500">مفيش أكواد لسه.</p>}
      </div>

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
