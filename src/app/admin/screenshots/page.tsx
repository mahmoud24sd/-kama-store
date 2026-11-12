import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'الاسكرينات' };

const STATUS: Record<string, string> = { pending: 'بانتظار المراجعة', approved: 'تم النشر', rejected: 'مرفوض' };

export default async function ScreenshotsPage() {
  await requirePermission('screenshots');

  type Row = {
    id: string;
    amount: number;
    payment_ref: string;
    sender_phone: string | null;
    status: string;
    created_at: string;
    screenshot_path: string | null;
    user_id: string;
    products: { name: string } | null;
  };
  let rows: Row[] = [];
  let urls = new Map<string, string>();
  let names = new Map<string, string>();
  let missing = false;

  if (hasServiceRole) {
    const db = createAdminClient();
    const { data, error } = await db
      .from('publish_requests')
      .select('id,amount,payment_ref,sender_phone,status,created_at,screenshot_path,user_id,products(name)')
      .not('screenshot_path', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) missing = true;
    rows = (data ?? []) as unknown as Row[];
    const paths = rows.map((r) => r.screenshot_path as string);
    if (paths.length) {
      const { data: signed } = await db.storage.from('payment-screenshots').createSignedUrls(paths, 3600);
      urls = new Map((signed ?? []).filter((s) => s.path && s.signedUrl).map((s) => [s.path as string, s.signedUrl]));
    }
    const ids = [...new Set(rows.map((r) => r.user_id))];
    if (ids.length) {
      const { data: profs } = await db.from('profiles').select('id,full_name,phone').in('id', ids);
      names = new Map((profs ?? []).map((p) => [p.id as string, `${p.full_name ?? ''} ${p.phone ?? ''}`.trim()]));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">الاسكرينات</h1>
      <p className="text-sm text-gray-600">صور تحويل رسم النشر اللي رفعها أصحاب المنتجات. اضغط على الصورة لتكبيرها.</p>
      {!hasServiceRole && <p className={ui.alertError}>يلزم إعداد SUPABASE_SERVICE_ROLE_KEY في Vercel.</p>}
      {missing && <p className={ui.alertError}>شغّل ملف migrations/019_payment_screenshots.sql في Supabase.</p>}
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">مفيش اسكرينات لسه.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((r) => {
            const url = urls.get(r.screenshot_path as string);
            return (
              <li key={r.id} className={`${ui.card} space-y-2 p-3`}>
                {url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="اسكرين التحويل" className="max-h-64 w-full rounded-lg border object-contain" />
                  </a>
                ) : (
                  <p className="text-sm text-gray-500">تعذر عرض الصورة</p>
                )}
                <p className="text-sm font-bold">{r.products?.name}</p>
                <p className="text-xs text-gray-700">{names.get(r.user_id) || '—'}</p>
                <p className="text-xs">المبلغ: <b>{r.amount} ج.م</b> · رقم العملية: <b dir="ltr">{r.payment_ref}</b></p>
                <p className="text-xs text-gray-500">{STATUS[r.status] ?? r.status} · {new Date(r.created_at).toLocaleDateString('ar-EG')}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
