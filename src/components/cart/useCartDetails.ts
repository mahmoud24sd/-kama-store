'use client';

import { useEffect, useMemo, useState } from 'react';
import { getCartLines } from '@/app/actions/cart';
import type { CartLineDetail } from '@/lib/types';
import { useCart } from './CartProvider';

/**
 * يجلب من السيرفر الأسعار والمخزون الحقيقيين لعناصر السلة،
 * ويدمجها مع الكميات المحفوظة (الكمية تُقيَّد بالمخزون المتاح).
 */
export function useCartDetails() {
  const { lines, ready } = useCart();
  const [details, setDetails] = useState<CartLineDetail[]>([]);
  const [loading, setLoading] = useState(true);

  const key = useMemo(() => JSON.stringify(lines.map((l) => [l.productId, l.variantId])), [lines]);

  useEffect(() => {
    if (!ready) return;
    if (lines.length === 0) {
      setDetails([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getCartLines(lines)
      .then((d) => {
        if (!cancelled) setDetails(d);
      })
      .catch(() => {
        if (!cancelled) setDetails([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // نعيد الجلب فقط عند تغيّر العناصر (وليس الكميات)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  const items = useMemo(
    () =>
      lines
        .map((l) => {
          const d = details.find((x) => x.productId === l.productId && x.variantId === l.variantId);
          if (!d) return null;
          const qty = d.available ? Math.min(l.qty, Math.max(d.stock, 1)) : l.qty;
          return { ...d, qty };
        })
        .filter((x): x is CartLineDetail & { qty: number } => x !== null),
    [lines, details],
  );

  const subtotal = items.filter((i) => i.available).reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const hasUnavailable = items.some((i) => !i.available);

  return { items, subtotal, loading: loading || !ready, hasUnavailable };
}
