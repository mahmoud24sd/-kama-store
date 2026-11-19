import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { getAdStats } from '@/lib/adsterra';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'إحصائيات الإعلانات' };

const RANGES = [{ d: 1, label: 'النهاردة' }, { d: 7, label: 'آخر 7 أيام' }, { d: 30, label: 'آخر 30 يوم' }, { d: 90, label: 'آخر 90 يوم' }];
const fmt = (n: number, f = 0) => n.toLocaleString('en-US', { maximumFractionDigits: f, minimumFractionDigits: f });

export default async function AdStatsPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  await requirePermission('ad_stats');
  const sp = await searchParams;
  const d = RANGES.some((r) => String(r.d) === sp.d) ? Number(sp.d) : 7;
  const { stats, error } = await getAdStats(d);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold">📈 إحصائيات الإعلانات والأرباح</h1>
      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Link key={r.d} href={`/admin/ad-stats?d=${r.d}`} className={r.d === d ? ui.btnDark : ui.btnOutline}>{r.label}</Link>
        ))}
      </div>

      {error === 'nokey' && (
        <div className={`${ui.card} space-y-2 p-5 text-sm leading-7`}>
          <p className="font-bold">لسه الربط مع Adsterra مش متفعّل. اعمل كده مرة واحدة:</p>
          <ol className="list-decimal space-y-1 pr-5">
            <li>افتح <a className="text-brand-600 underline" href="https://publishers.adsterra.com" target="_blank" rel="noopener noreferrer">لوحة Adsterra</a> ← <b>Settings</b> ← تبويب <b>API</b> ← <b>Generate new token</b>، وانسخ الرمز (بيظهر مرة واحدة بس).</li>
            <li>افتح <a className="text-brand-600 underline" href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer">Vercel</a> ← مشروعك ← <b>Settings</b> ← <b>Environment Variables</b>.</li>
            <li>أضف متغير اسمه <code dir="ltr">ADSTERRA_API_KEY</code> وقيمته الرمز، واضغط <b>Save</b>.</li>
            <li>اعمل <b>Redeploy</b> من تبويب Deployments. <b>ما تبعتش الرمز لأي حد في الشات.</b></li>
          </ol>
        </div>
      )}
      {error === 'auth' && <p className={ui.alertError}>الرمز مرفوض من Adsterra. ولّد رمز جديد وحدّث المتغير ADSTERRA_API_KEY في Vercel.</p>}
      {error && error !== 'nokey' && error !== 'auth' && <p className={ui.alertError}>تعذّر جلب الأرقام من Adsterra دلوقتي ({error}). جرّب بعد شوية.</p>}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              ['المشاهدات', fmt(stats.impressions)],
              ['النقرات', fmt(stats.clicks)],
              ['نسبة النقر', `${fmt(stats.ctr, 2)}%`],
              ['متوسط الأجر لكل 1000 مشاهدة', `$${fmt(stats.cpm, 2)}`],
              ['الأرباح', `$${fmt(stats.revenue, 2)}`],
            ].map(([l, v]) => (
              <div key={l} className={`${ui.card} p-4`}>
                <p className="text-xs text-gray-500">{l}</p>
                <p className="mt-1 text-xl font-extrabold text-brand-700" dir="ltr">{v}</p>
              </div>
            ))}
          </div>
          <div className={`${ui.card} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr><th className="p-2 text-right">اليوم</th><th className="p-2 text-right">المشاهدات</th><th className="p-2 text-right">النقرات</th><th className="p-2 text-right">نسبة النقر</th><th className="p-2 text-right">الأرباح</th></tr>
              </thead>
              <tbody>
                {stats.days.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-gray-500">مفيش أرقام في الفترة دي لسه.</td></tr>}
                {stats.days.map((x) => (
                  <tr key={x.date} className="border-t border-gray-100">
                    <td className="p-2" dir="ltr">{x.date}</td>
                    <td className="p-2">{fmt(x.impressions)}</td>
                    <td className="p-2">{fmt(x.clicks)}</td>
                    <td className="p-2">{x.impressions ? fmt((x.clicks / x.impressions) * 100, 2) : '0'}%</td>
                    <td className="p-2 font-semibold" dir="ltr">${fmt(x.revenue, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500">الأرقام من Adsterra مباشرة (بتتحدّث كل 5 دقايق تقريبًا). الأرباح بالدولار، وممكن تتأخر ساعات لحد ما تتأكد.</p>
        </>
      )}
    </div>
  );
}
