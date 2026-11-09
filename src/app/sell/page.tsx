import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getPublishSettings } from '@/lib/settings';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';
import { formatPrice } from '@/lib/utils';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'منتجاتي' };

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'مسودة (غير منشور)', cls: 'bg-gray-100 text-gray-700' },
  pending: { label: 'بانتظار تأكيد الدفع', cls: 'bg-amber-100 text-amber-800' },
  published: { label: 'منشور', cls: 'bg-green-100 text-green-800' },
  rejected: { label: 'مرفوض — راجع السبب', cls: 'bg-red-100 text-red-700' },
};

export default async function SellPage({ searchParams }: { searchParams: Promise<{ submitted?: string; error?: string }> }) {
  const user = await requireUser('/sell');
  const sp = await searchParams;
  const { fee } = await getPublishSettings();

  type Row = { id: string; name: string; price: number; status: string; shop_name: string | null };
  let rows: Row[] = [];
  const notes = new Map<string, string>();
  if (hasServiceRole) {
    const db = createAdminClient();
    const { data } = await db.from('products').select('id,name,price,status,shop_name').eq('seller_id', user.id).order('created_at', { ascending: false });
    rows = (data ?? []) as Row[];
    const { data: reqs } = await db.from('publish_requests').select('product_id,admin_note,status,created_at').eq('user_id', user.id).eq('status', 'rejected').order('created_at', { ascending: true });
    for (const r of reqs ?? []) if (r.admin_note) notes.set(r.product_id as string, r.admin_note as string);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">منتجاتي</h1>
        <Link href="/sell/new" className={ui.btnPrimary}>+ إضافة منتج</Link>
      </div>
      <p className="text-sm text-gray-600">انشر منتجك في متجرنا برسم {fee} جنيه فقط عبر InstaPay أو محفظة. احفظ منتجك كمسودة، وعند الجاهزية اضغط «نشر المنتج».</p>
      {sp.submitted && <p className={ui.alertOk}>وصلنا طلب النشر. سنراجع الدفع وننشر المنتج بعد التأكيد.</p>}
      {sp.error && <p className={ui.alertError}>{sp.error}</p>}
      {!hasServiceRole && <p className={ui.alertError}>خدمة نشر المنتجات غير مفعّلة بعد من إعدادات الموقع.</p>}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">لم تضف أي منتج بعد.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((p) => {
            const st = STATUS[p.status] ?? STATUS.draft;
            return (
              <li key={p.id} className={`${ui.card} flex flex-wrap items-center justify-between gap-3 p-3`}>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.shop_name} · {formatPrice(p.price)}</p>
                  {p.status === 'rejected' && notes.get(p.id) && <p className="mt-1 text-xs text-red-600">السبب: {notes.get(p.id)}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                  {p.status !== 'pending' && <Link href={`/sell/${p.id}`} className={ui.btnOutline}>تعديل</Link>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
