import type { Metadata } from 'next';
import { recordWithdrawal } from '@/app/actions/team';
import { requirePermission } from '@/lib/auth';
import { formatDate, formatPrice } from '@/lib/utils';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'الأرباح والسحب' };

type Withdrawal = { id: string; amount: number; note: string | null; created_by_name: string | null; created_at: string };

export default async function AdminEarnings({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { supabase } = await requirePermission('withdraw');
  const sp = await searchParams;

  const [{ data: delivered }, { data: taken, error: wErr }, { data: fees }, { data: items }] = await Promise.all([
    supabase.from('orders').select('total,subtotal,discount').eq('status', 'delivered'),
    supabase.from('withdrawals').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('publish_requests').select('amount').eq('status', 'approved'),
    supabase.from('order_items').select('product_id,quantity,orders!inner(status)').eq('orders.status', 'delivered').limit(5000),
  ]);

  // تكلفة المنتجات المسلّمة: من سعر التكلفة الخاص بكل منتج (يتطلب ملف 006). منتج بلا سعر تكلفة يُحسب 0 ونُنبّهك
  const ids = [...new Set((items ?? []).map((i) => i.product_id).filter(Boolean))] as string[];
  const costById = new Map<string, number>();
  if (ids.length > 0) {
    const { data: priv } = await supabase.from('product_private').select('product_id,cost_price').in('product_id', ids);
    for (const p of priv ?? []) if (p.cost_price != null) costById.set(p.product_id as string, Number(p.cost_price));
  }
  let cost = 0;
  let missingCost = 0;
  for (const it of items ?? []) {
    const c = it.product_id ? costById.get(it.product_id as string) : undefined;
    if (c == null) missingCost += 1;
    else cost += c * Number(it.quantity);
  }
  const publishFees = (fees ?? []).reduce((s, f) => s + Number(f.amount), 0);
  const goods = (delivered ?? []).reduce((s, o) => s + Number(o.subtotal) - Number(o.discount), 0);
  const net = goods - cost + publishFees;
  const withdrawals = (taken ?? []) as Withdrawal[];
  const earned = (delivered ?? []).reduce((s, o) => s + Number(o.total), 0);
  const withdrawn = withdrawals.reduce((s, w) => s + Number(w.amount), 0);
  const available = earned - withdrawn;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">الأرباح والسحب</h1>
      {sp.saved && <p className={ui.alertOk}>تم تسجيل السحب.</p>}
      {sp.error && <p className={ui.alertError}>{sp.error}</p>}
      {wErr && <p className={ui.alertError}>تعذّر تحميل السحوبات. شغّل ملف supabase/migrations/001 في Supabase.</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 p-4"><p className="text-xs text-gray-500">إجمالي الطلبات المسلّمة</p><p className="text-lg font-extrabold">{formatPrice(earned)}</p></div>
        <div className="rounded-xl border border-gray-200 p-4"><p className="text-xs text-gray-500">تم سحبه</p><p className="text-lg font-extrabold">{formatPrice(withdrawn)}</p></div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4"><p className="text-xs text-green-700">الرصيد المتاح للسحب</p><p className="text-lg font-extrabold text-green-800">{formatPrice(available)}</p></div>
      </div>

      <section className="rounded-xl border border-gray-200 p-4">
        <h2 className="mb-3 font-bold">صافي الربح التقديري</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-4">
          <div><dt className="text-gray-500">مبيعات المنتجات (بعد الخصم، بدون الشحن)</dt><dd className="font-bold">{formatPrice(goods)}</dd></div>
          <div><dt className="text-gray-500">تكلفة المنتجات</dt><dd className="font-bold">- {formatPrice(cost)}</dd></div>
          <div><dt className="text-gray-500">رسوم النشر المؤكدة</dt><dd className="font-bold">+ {formatPrice(publishFees)}</dd></div>
          <div className="rounded-lg bg-green-50 p-2"><dt className="text-green-700">الصافي</dt><dd className="text-lg font-extrabold text-green-800">{formatPrice(net)}</dd></div>
        </dl>
        {missingCost > 0 && (
          <p className="mt-2 text-xs text-amber-700">
            {missingCost} صنف مسلّم بدون سعر تكلفة، فاتحسب تكلفته صفر. أضف «سعر التكلفة» في صفحة المنتج (تفاصيل خاصة) ليكون الرقم أدق.
          </p>
        )}
        <p className="mt-2 text-xs text-gray-500">التكلفة محسوبة بسعر التكلفة الحالي للمنتج، والشحن غير محسوب في الربح لأنه يذهب للمندوب.</p>
      </section>

      <section className="rounded-xl border border-gray-200 p-4">
        <h2 className="mb-3 font-bold">تسجيل سحب</h2>
        <form action={recordWithdrawal} className="grid gap-3 sm:grid-cols-3">
          <input name="amount" type="number" step="0.01" min="0" required placeholder="المبلغ بالجنيه" className={ui.input} aria-label="المبلغ" />
          <input name="note" placeholder="ملاحظة (اختياري)" className={`${ui.input} sm:col-span-1`} aria-label="ملاحظة" />
          <button className={ui.btnDark}>سحب</button>
        </form>
        <p className="mt-2 text-xs text-gray-500">الأرباح تُحسب من الطلبات التي حالتها «تم التسليم». يُسجَّل السحب هنا فقط، وتحويل المبلغ فعليًا يتم خارج الموقع.</p>
      </section>

      <section>
        <h2 className="mb-2 font-bold">سجل السحوبات</h2>
        <table className="w-full">
          <thead><tr className="border-b border-gray-200"><th className={ui.th}>التاريخ</th><th className={ui.th}>المبلغ</th><th className={ui.th}>بواسطة</th><th className={ui.th}>ملاحظة</th></tr></thead>
          <tbody>
            {withdrawals.map((w) => (
              <tr key={w.id} className="border-b border-gray-100">
                <td className={ui.td}>{formatDate(w.created_at)}</td>
                <td className={ui.td}>{formatPrice(Number(w.amount))}</td>
                <td className={ui.td}>{w.created_by_name || '—'}</td>
                <td className={ui.td}>{w.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {withdrawals.length === 0 && <p className="py-6 text-center text-gray-500">لا توجد سحوبات بعد.</p>}
      </section>
    </div>
  );
}
