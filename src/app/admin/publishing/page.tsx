import type { Metadata } from 'next';
import { approvePublish, rejectPublish } from '@/app/actions/publishing';
import { requirePermission } from '@/lib/auth';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'طلبات النشر' };

export default async function PublishingPage({ searchParams }: { searchParams: Promise<{ error?: string; done?: string }> }) {
  await requirePermission('publishing');
  const sp = await searchParams;

  type Req = {
    id: string;
    amount: number;
    payment_ref: string;
    sender_phone: string | null;
    created_at: string;
    products: { name: string; shop_name: string | null } | null;
    seller: { full_name: string | null; email: string | null; phone: string | null } | null;
  };
  let reqs: Req[] = [];
  if (hasServiceRole) {
    const db = createAdminClient();
    const { data } = await db
      .from('publish_requests')
      .select('id,amount,payment_ref,sender_phone,created_at,user_id,products(name,shop_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    const ids = [...new Set((data ?? []).map((r) => r.user_id as string))];
    const { data: profs } = ids.length ? await db.from('profiles').select('id,full_name,email,phone').in('id', ids) : { data: [] };
    const byId = new Map((profs ?? []).map((p) => [p.id as string, p]));
    reqs = (data ?? []).map((r) => ({ ...(r as unknown as Req), seller: (byId.get(r.user_id as string) as Req['seller']) ?? null }));
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">طلبات نشر المنتجات</h1>
      <p className="text-sm text-gray-600">قارن رقم العملية بما وصلك في تطبيق InstaPay، ثم اضغط «تأكيد ونشر». لو لم يصل التحويل اضغط «رفض».</p>
      {sp.done && <p className={ui.alertOk}>تم.</p>}
      {sp.error && <p className={ui.alertError}>{sp.error}</p>}
      {!hasServiceRole && <p className={ui.alertError}>يلزم إعداد SUPABASE_SERVICE_ROLE_KEY في Vercel.</p>}
      {reqs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">لا توجد طلبات بانتظار المراجعة.</p>
      ) : (
        <ul className="space-y-3">
          {reqs.map((r) => (
            <li key={r.id} className={`${ui.card} space-y-2 p-4`}>
              <p className="font-bold">{r.products?.name} <span className="text-sm font-normal text-gray-500">— {r.products?.shop_name}</span></p>
              <p className="text-sm text-gray-700">
                {r.seller?.full_name || '—'} · <span dir="ltr">{r.seller?.email}</span> · <span dir="ltr">{r.seller?.phone}</span>
              </p>
              <p className="text-sm">المبلغ: <b>{r.amount} ج.م</b> · رقم العملية: <b dir="ltr">{r.payment_ref}</b>{r.sender_phone && <> · من: <span dir="ltr">{r.sender_phone}</span></>}</p>
              <div className="flex flex-wrap items-end gap-3">
                <form action={approvePublish}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className={ui.btnPrimary}>تأكيد ونشر</button>
                </form>
                <form action={rejectPublish} className="flex items-end gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input name="note" placeholder="سبب الرفض (اختياري)" className={ui.input} />
                  <button className={ui.btnDanger}>رفض</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
