import type { Metadata } from 'next';
import Link from 'next/link';
import AutoRefresh from '@/components/chat/AutoRefresh';
import { requireOwner } from '@/lib/auth';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'متابعة الأدمن' };
export const dynamic = 'force-dynamic';

type P = { id: string; full_name: string | null; email: string | null; phone: string | null; last_seen_at?: string | null };

const ago = (iso?: string | null) => {
  if (!iso) return 'ماظهرش لسه';
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'دلوقتي';
  if (m < 60) return `من ${m} دقيقة`;
  if (m < 1440) return `من ${Math.round(m / 60)} ساعة`;
  return `من ${Math.round(m / 1440)} يوم`;
};
const startOfDayCairo = () => {
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
  return new Date(`${d}T00:00:00+02:00`).toISOString();
};

export default async function TeamActivity() {
  const { supabase } = await requireOwner();
  const { data } = await supabase.from('profiles').select('*').eq('role', 'admin').order('created_at');
  const admins = (data ?? []) as P[];
  const today = startOfDayCairo();
  const week = new Date(Date.now() - 7 * 86400000).toISOString();

  const rows = await Promise.all(admins.map(async (a) => {
    const cnt = async (table: string, col: string, since: string, extra?: (q: any) => any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      let q = supabase.from(table).select('id', { count: 'exact', head: true }).eq(col === 'published_at' ? 'published_by' : 'created_by', a.id).gte(col, since);
      if (extra) q = extra(q);
      const { count } = await q;
      return count ?? 0;
    };
    const [pubToday, pubWeek, filesToday, filesWeek, last] = await Promise.all([
      cnt('products', 'published_at', today), cnt('products', 'published_at', week),
      cnt('product_files', 'created_at', today, (q) => q.is('deleted_at', null)), cnt('product_files', 'created_at', week, (q) => q.is('deleted_at', null)),
      supabase.from('products').select('published_at').eq('published_by', a.id).order('published_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    return { a, pubToday, pubWeek, filesToday, filesWeek, lastPub: (last.data?.published_at as string | null) ?? null };
  }));

  const online = (iso?: string | null) => Boolean(iso) && Date.now() - new Date(iso as string).getTime() < 5 * 60000;

  return (
    <div className="space-y-4">
      <AutoRefresh seconds={30} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold">👁 متابعة الأدمن</h1>
        <Link href="/admin/chat" className={ui.btnOutline}>← الدردشة</Link>
      </div>
      <p className="text-sm text-gray-600">بتشوف مين شغّال دلوقتي، وكل واحد نشر وجاب كام النهاردة وآخر 7 أيام. الصفحة بتتحدّث لوحدها كل 30 ثانية. ده للمالك بس.</p>
      {rows.length === 0 && <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">مفيش أدمن مضاف.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map(({ a, pubToday, pubWeek, filesToday, filesWeek, lastPub }) => (
          <div key={a.id} className={`${ui.card} space-y-3 p-4`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold">{a.full_name || a.email}</p>
                {a.phone && <p className="text-xs text-gray-500" dir="ltr">{a.phone}</p>}
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${online(a.last_seen_at) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {online(a.last_seen_at) ? '🟢 شغّال دلوقتي' : `⚪ آخر ظهور ${ago(a.last_seen_at)}`}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-sm">
              <div className="rounded-lg bg-brand-50 p-2"><p className="text-xl font-extrabold text-brand-700">{pubToday}</p><p className="text-xs text-gray-600">منتج نشره النهاردة</p></div>
              <div className="rounded-lg bg-gray-50 p-2"><p className="text-xl font-extrabold">{pubWeek}</p><p className="text-xs text-gray-600">نشر آخر 7 أيام</p></div>
              <div className="rounded-lg bg-brand-50 p-2"><p className="text-xl font-extrabold text-brand-700">{filesToday}</p><p className="text-xs text-gray-600">فولدر رفعه النهاردة</p></div>
              <div className="rounded-lg bg-gray-50 p-2"><p className="text-xl font-extrabold">{filesWeek}</p><p className="text-xs text-gray-600">رفع آخر 7 أيام</p></div>
            </div>
            <p className="text-xs text-gray-500">آخر نشر: {ago(lastPub)}</p>
          </div>
        ))}
      </div>
      {admins.length > 0 && !('last_seen_at' in admins[0]) && <p className={ui.alertError}>عشان يظهر «شغّال دلوقتي» لازم تشغّل ملف 035_admin_last_seen.sql في Supabase.</p>}
    </div>
  );
}
