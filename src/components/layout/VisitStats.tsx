import { unstable_rethrow } from 'next/navigation';
import { getProfile } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { getAdminVisitCountries, getAdminVisitCount } from '@/lib/visits';

const flag = (code: string) => (/^[A-Z]{2}$/.test(code) && code !== 'XX' ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '🌍');

/** إحصائيات الزوار حسب الدولة: بتظهر في آخر الموقع للأدمن اللي المالك داله صلاحية «عدد الزيارات» (والمالك) بس */
export default async function VisitStats() {
  try {
    const profile = await getProfile();
    if (!hasPermission(profile, 'visits')) return null;
    const supabase = await createClient();
    const [rows, totalVisits] = await Promise.all([getAdminVisitCountries(supabase), getAdminVisitCount(supabase)]);
    if (!rows || rows.length === 0) {
      return rows === null ? null : <p className="py-3 text-center text-xs text-gray-400">📊 لسه مفيش زيارات متسجّلة بالدول.</p>;
    }
    const sum = rows.reduce((n, r) => n + r.visits, 0) || 1;
    const names = new Intl.DisplayNames(['ar'], { type: 'region' });
    const label = (c: string) => (c === 'XX' ? 'دولة غير معروفة' : (() => { try { return names.of(c) ?? c; } catch { return c; } })());
    const top = rows.slice(0, 15);
    const rest = rows.slice(15).reduce((n, r) => n + r.visits, 0);
    return (
      <section className="border-t border-white/10 bg-black/20" aria-label="إحصائيات الزوار">
        <div className="mx-auto max-w-3xl px-4 py-5">
          <h3 className="mb-1 text-center font-bold text-white">📊 إحصائيات الزوار (للإدارة فقط)</h3>
          <p className="mb-3 text-center text-xs text-gray-400">
            إجمالي الزيارات: <b dir="ltr" className="text-white">{(totalVisits ?? sum).toLocaleString('en-US')}</b> · متسجّل بالدول: <b dir="ltr" className="text-white">{sum.toLocaleString('en-US')}</b>
          </p>
          <ul className="space-y-1.5">
            {top.map((r) => {
              const pct = (r.visits / sum) * 100;
              return (
                <li key={r.country} className="grid grid-cols-[9rem_1fr_7rem] items-center gap-2 text-xs sm:grid-cols-[11rem_1fr_8rem]">
                  <span className="truncate text-white">{flag(r.country)} {label(r.country)}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-accent-400" style={{ width: `${Math.max(pct, 1)}%` }} /></span>
                  <span className="text-gray-300" dir="ltr">{r.visits.toLocaleString('en-US')} · {pct.toFixed(1)}%</span>
                </li>
              );
            })}
            {rest > 0 && (
              <li className="grid grid-cols-[9rem_1fr_7rem] items-center gap-2 text-xs sm:grid-cols-[11rem_1fr_8rem]">
                <span className="text-white">🌍 دول أخرى</span>
                <span className="h-2 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-accent-400/60" style={{ width: `${Math.max((rest / sum) * 100, 1)}%` }} /></span>
                <span className="text-gray-300" dir="ltr">{rest.toLocaleString('en-US')} · {((rest / sum) * 100).toFixed(1)}%</span>
              </li>
            )}
          </ul>
        </div>
      </section>
    );
  } catch (e) {
    unstable_rethrow(e);
    return null;
  }
}
