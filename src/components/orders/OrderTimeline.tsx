import { CheckCircle2, Circle } from 'lucide-react';
import type { OrderEvent } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { ORDER_STATUS_LABEL } from '@/lib/ui';

/** مراحل الطلب بالترتيب الزمني: تم استلام الطلب ثم كل تغيير حالة (مع ملاحظة التسليم إن وُجدت) */
export default function OrderTimeline({ createdAt, events }: { createdAt: string; events: OrderEvent[] }) {
  const steps = [
    { id: 'created', label: 'تم استلام الطلب', note: null as string | null, by: null as string | null, at: createdAt, done: false },
    ...events.map((e) => ({
      id: e.id,
      label: ORDER_STATUS_LABEL[e.status] ?? e.status,
      note: e.note,
      by: e.created_by_name,
      at: e.created_at,
      done: e.status === 'delivered',
    })),
  ];
  return (
    <ol className="space-y-3 text-sm" aria-label="مراحل الطلب">
      {steps.map((s) => (
        <li key={s.id} className="flex gap-2">
          {s.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />}
          <div>
            <p className={s.done ? 'font-bold text-green-700' : 'font-semibold text-gray-800'}>{s.label}</p>
            <p className="text-xs text-gray-500">{formatDate(s.at)}{s.by ? ` · ${s.by}` : ''}</p>
            {s.note && <p className="mt-0.5 rounded bg-gray-50 px-2 py-1 text-xs text-gray-600">{s.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
