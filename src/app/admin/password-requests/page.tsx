import type { Metadata } from 'next';
import { cancelResetRequest } from '@/app/actions/passwordRequests';
import IssueCode from '@/components/admin/IssueCode';
import { requirePermission } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { ui } from '@/lib/ui';
import { whatsappAutoConfigured } from '@/lib/whatsapp';

export const metadata: Metadata = { title: 'طلبات كلمة المرور' };
export const dynamic = 'force-dynamic';

type Row = {
  id: string;
  identifier: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  status: 'pending' | 'sent' | 'used' | 'cancelled';
  code_expires_at: string | null;
  handled_by_name: string | null;
  created_at: string;
};

const STATUS: Record<Row['status'], string> = { pending: 'ينتظر', sent: 'تم إرسال رمز', used: 'تم الاستخدام', cancelled: 'ملغي' };

export default async function PasswordRequests() {
  const { supabase } = await requirePermission('temp_password');
  const { data, error } = await supabase
    .from('password_reset_requests')
    .select('id,identifier,full_name,phone,email,status,code_expires_at,handled_by_name,created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  const rows = (data ?? []) as Row[];
  const open = rows.filter((r) => r.status === 'pending' || r.status === 'sent');
  const done = rows.filter((r) => r.status === 'used' || r.status === 'cancelled');
  const auto = whatsappAutoConfigured();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">طلبات استعادة كلمة المرور</h1>
      {error && (
        <p className={ui.alertError}>
          الجدول غير جاهز. شغّل ملف 009_password_reset_requests.sql في Supabase (SQL Editor) ثم حدّث الصفحة.
        </p>
      )}
      <p className="text-sm text-gray-600">
        {auto
          ? 'الإرسال التلقائي على واتساب مفعّل: الرمز يُرسل للعميل فور الضغط.'
          : 'اضغط «إنشاء رمز»، ثم «أرسل على واتساب» ليفتح واتساب والرسالة جاهزة. الرمز صالح 3 أيام ويُرسل فقط للرقم المسجّل في حساب العميل.'}
      </p>

      <section className="space-y-3">
        <h2 className="font-bold">طلبات مفتوحة ({open.length})</h2>
        {open.length === 0 && <p className="text-gray-500">لا توجد طلبات الآن.</p>}
        {open.map((r) => (
          <div key={r.id} className="space-y-3 rounded-xl border border-gray-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-bold">{r.full_name || '—'}</p>
                <p className="text-sm text-gray-600" dir="ltr">{r.phone || 'لا يوجد رقم مسجّل'}</p>
                <p className="text-sm text-gray-600" dir="ltr">{r.email}</p>
                <p className="text-xs text-gray-500">
                  {formatDate(r.created_at)} · {STATUS[r.status]}
                  {r.status === 'sent' && r.code_expires_at ? ` · ينتهي ${formatDate(r.code_expires_at)}` : ''}
                  {r.handled_by_name ? ` · بواسطة ${r.handled_by_name}` : ''}
                </p>
              </div>
              <form action={cancelResetRequest}>
                <input type="hidden" name="id" value={r.id} />
                <button className={ui.btnOutline}>إلغاء</button>
              </form>
            </div>
            <IssueCode id={r.id} resend={r.status === 'sent'} />
          </div>
        ))}
      </section>

      {done.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold">السجل</h2>
          <ul className="divide-y rounded-xl border border-gray-200 text-sm">
            {done.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 p-3">
                <span>{r.full_name || r.identifier}</span>
                <span className="text-gray-500">{STATUS[r.status]} · {formatDate(r.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
