import type { Metadata } from 'next';
import { deleteReview, setReviewApproved } from '@/app/actions/admin';
import Stars from '@/components/product/Stars';
import { requireAdmin } from '@/lib/auth';
import type { Review } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'التقييمات' };

type Row = Review & { products: { name: string } | null };

export default async function AdminReviews() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from('reviews').select('*, products(name)').order('created_at', { ascending: false }).limit(200);
  const reviews = (data ?? []) as unknown as Row[];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">التقييمات ({reviews.length})</h1>
      {reviews.length === 0 ? (
        <p className="py-8 text-center text-gray-500">لا توجد تقييمات.</p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className={`rounded-xl border p-4 ${r.is_approved ? 'border-gray-200' : 'border-amber-300 bg-amber-50'}`}>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <b>{r.author_name || 'عميل'}</b>
                <Stars rating={r.rating} />
                <span className="text-gray-500">على: {r.products?.name ?? 'منتج محذوف'}</span>
                <span className="text-xs text-gray-400">{formatDate(r.created_at)}</span>
                {!r.is_approved && <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900">مخفي</span>}
              </div>
              {r.comment && <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{r.comment}</p>}
              <div className="mt-3 flex gap-2">
                <form action={setReviewApproved}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="approved" value={String(!r.is_approved)} />
                  <button className={ui.btnOutline}>{r.is_approved ? 'إخفاء' : 'إظهار'}</button>
                </form>
                <form action={deleteReview}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className={ui.btnDanger}>حذف</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
