import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { getSiteUrl } from '@/lib/site';
import { formatPrice } from '@/lib/utils';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'لينك الإحالة' };
export const dynamic = 'force-dynamic';

type Row = { admin_id: string; name: string; visits: number | string; orders: number | string; total: number | string };

export default async function Referrals() {
  const { user, profile, supabase } = await requireAdmin();
  const link = `${getSiteUrl()}/?ref=${user.id}`;
  const { data, error } = await supabase.rpc('admin_ref_stats');
  const rows = (error ? [] : (data ?? [])) as Row[];
  const owner = profile.role === 'owner';

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">🔗 لينك الإحالة بتاعي</h1>
      <section className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 text-sm">
        <p>انسخ اللينك ده وانشره في الجروبات. أي زبون يدخل منه وتتم عنده الطلبات، بتتحسب على حسابك. اللينك صالح 30 يوم من أول دخول للزبون.</p>
        <input readOnly value={link} dir="ltr" className={ui.input} />
        <p className="text-xs text-gray-500">تقدر كمان تضيف <code dir="ltr">?ref={user.id}</code> في آخر أي لينك منتج. وأزرار المشاركة في صفحة المنتج بتضيفه تلقائيًا وإنت مسجل دخول.</p>
        <a href={`https://wa.me/?text=${encodeURIComponent(link)}`} target="_blank" rel="noopener noreferrer" className={ui.btnOutline}>شاركه على واتساب</a>
      </section>

      {error ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">الإحصائيات مش شغالة لسه. شغّل ملف SQL رقم 037 في Supabase.</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">لسه مفيش زيارات من لينكات الإحالة.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr><th className="p-2 text-start">{owner ? 'الأدمن' : 'أنا'}</th><th className="p-2">زيارات</th><th className="p-2">طلبات</th><th className="p-2">قيمة الطلبات</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.admin_id} className="border-t border-gray-100 text-center">
                  <td className="p-2 text-start font-semibold">{r.name}</td>
                  <td className="p-2">{Number(r.visits)}</td>
                  <td className="p-2">{Number(r.orders)}</td>
                  <td className="p-2">{formatPrice(Number(r.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
