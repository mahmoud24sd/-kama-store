'use client';

import { useActionState, useState } from 'react';
import { Star } from 'lucide-react';
import { submitReview } from '@/app/actions/account';
import type { FormState } from '@/app/actions/auth';
import { ui } from '@/lib/ui';

export default function ReviewForm({ productId, slug }: { productId: string; slug: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitReview, {});
  const [rating, setRating] = useState(0);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="rating" value={rating} />
      <div>
        <span className={ui.label}>تقييمك</span>
        <div className="flex gap-1" dir="ltr">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} نجوم`}>
              <Star className={`h-7 w-7 ${n <= rating ? 'fill-accent-500 text-accent-500' : 'text-gray-300'}`} />
            </button>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor="comment" className={ui.label}>تعليقك (اختياري)</label>
        <textarea id="comment" name="comment" rows={3} maxLength={1000} className={ui.input} />
      </div>
      {state.error && <p className={ui.alertError}>{state.error}</p>}
      {state.message && <p className={ui.alertOk}>{state.message}</p>}
      <button type="submit" disabled={pending || rating === 0} className={ui.btnDark}>
        {pending ? 'جارٍ الإرسال...' : 'إرسال التقييم'}
      </button>
    </form>
  );
}
