import type { Metadata } from 'next';
import Link from 'next/link';
import AutoRefresh from '@/components/chat/AutoRefresh';
import { requirePermission } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'الدردشة' };
export const dynamic = 'force-dynamic';

const LABEL: Record<string, { text: string; cls: string }> = {
  waiting: { text: 'ينتظر ردك', cls: 'bg-amber-100 text-amber-800' },
  open: { text: 'مفتوحة', cls: 'bg-green-100 text-green-800' },
  closed: { text: 'مغلقة', cls: 'bg-gray-100 text-gray-600' },
};

export default async function AdminChat() {
  const { supabase } = await requirePermission('chat');
  const { data } = await supabase
    .from('chat_conversations')
    .select('id,customer_name,status,last_message_at')
    .order('last_message_at', { ascending: false })
    .limit(100);
  const rows = (data ?? []).slice().sort((a, b) => Number(b.status === 'waiting') - Number(a.status === 'waiting'));

  return (
    <div className="space-y-4">
      <AutoRefresh seconds={10} />
      <h1 className="text-xl font-extrabold">الدردشة مع العملاء</h1>
      <p className="text-sm text-gray-600">المحادثات التي ينتظر فيها العميل ردًا تظهر في الأعلى، والقائمة تتحدّث تلقائيًا كل 10 ثوانٍ.</p>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">لا توجد محادثات بعد.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => {
            const st = LABEL[c.status as string] ?? LABEL.open;
            return (
              <li key={c.id as string}>
                <Link href={`/admin/chat/${c.id}`} className={`${ui.card} flex items-center justify-between gap-3 p-3 hover:bg-gray-50`}>
                  <div>
                    <p className="font-semibold">{(c.customer_name as string) || 'عميل'}</p>
                    <p className="text-xs text-gray-500">آخر رسالة: {formatDate(c.last_message_at as string)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${st.cls}`}>{st.text}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
