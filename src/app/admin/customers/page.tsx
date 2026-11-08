import type { Metadata } from 'next';
import UserActions from '@/components/admin/UserActions';
import { requirePermission } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import type { Profile } from '@/lib/types';
import { formatDate, formatPrice } from '@/lib/utils';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'العملاء' };

const ROLE_LABEL: Record<string, string> = { owner: 'المالك', admin: 'أدمن', customer: 'عميل' };

export default async function AdminCustomers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; saved?: string }>;
}) {
  const { supabase, profile: me } = await requirePermission('users');
  const sp = await searchParams;
  const canTemp = hasPermission(me, 'temp_password');
  const canDelete = hasPermission(me, 'delete_user');

  let query = supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(300);
  const term = sp.q?.replace(/[,()%_\\*]/g, ' ').trim();
  if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  const { data } = await query;
  const profiles = (data ?? []) as Profile[];

  // إجمالي مشتريات كل عميل (من الطلبات غير الملغاة)
  const { data: orderRows } = await supabase.from('orders').select('user_id,total,status').neq('status', 'cancelled');
  const totals = new Map<string, { count: number; sum: number }>();
  (orderRows ?? []).forEach((o) => {
    const r = totals.get(o.user_id as string) ?? { count: 0, sum: 0 };
    r.count += 1;
    r.sum += Number(o.total);
    totals.set(o.user_id as string, r);
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">العملاء ({profiles.length})</h1>
      {sp.saved && <p className={ui.alertOk}>تم تنفيذ العملية.</p>}
      {sp.error && <p className={ui.alertError}>{sp.error}</p>}
      <form className="flex gap-2" role="search">
        <input name="q" defaultValue={sp.q} placeholder="الاسم / البريد / الهاتف" className={ui.input} />
        <button className={ui.btnOutline}>بحث</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className={ui.th}>الاسم</th><th className={ui.th}>البريد</th><th className={ui.th}>الهاتف</th>
              <th className={ui.th}>الدور</th><th className={ui.th}>الطلبات</th><th className={ui.th}>المشتريات</th><th className={ui.th}>التسجيل</th>
              {(canTemp || canDelete) && <th className={ui.th}>إجراءات</th>}
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const t = totals.get(p.id);
              // المالك لا يُمَس، وحسابك أنت لا يُحذف، وحسابات الأدمن يديرها المالك فقط
              const manageable = p.role === 'customer' || (p.role === 'admin' && me.role === 'owner');
              const isMe = p.id === me.id;
              return (
                <tr key={p.id} className="border-b border-gray-100 align-top">
                  <td className={ui.td}>{p.full_name || '—'}</td>
                  <td className={ui.td} dir="ltr">{p.email}</td>
                  <td className={ui.td} dir="ltr">{p.phone || '—'}</td>
                  <td className={ui.td}>{p.role === 'customer' ? 'عميل' : <b className="text-brand-700">{ROLE_LABEL[p.role] ?? p.role}</b>}</td>
                  <td className={ui.td}>{t?.count ?? 0}</td>
                  <td className={ui.td}>{formatPrice(t?.sum ?? 0)}</td>
                  <td className={ui.td}>{formatDate(p.created_at)}</td>
                  {(canTemp || canDelete) && (
                    <td className={ui.td}>
                      {manageable && !isMe ? <UserActions id={p.id} canTemp={canTemp} canDelete={canDelete} /> : '—'}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {profiles.length === 0 && <p className="py-8 text-center text-gray-500">لا يوجد عملاء.</p>}
      </div>
    </div>
  );
}
