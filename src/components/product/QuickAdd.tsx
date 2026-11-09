'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ShoppingCart } from 'lucide-react';
import { useCart } from '@/components/cart/CartProvider';
import { ui } from '@/lib/ui';

/** إضافة سريعة من البطاقة (للمنتجات التي بلا خيارات لون/مقاس) */
export default function QuickAdd({ productId, stock }: { productId: string; stock: number }) {
  const { add } = useCart();
  const router = useRouter();
  const [done, setDone] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={stock < 1}
        onClick={() => {
          add({ productId, variantId: null, qty: 1 }, stock);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }}
        className={`${ui.btnPrimary} w-full`}
      >
        {done ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
        {stock < 1 ? 'غير متوفر' : done ? 'تمت الإضافة' : 'أضف إلى السلة'}
      </button>
      {stock >= 1 && (
        <button
          type="button"
          onClick={() => {
            add({ productId, variantId: null, qty: 1 }, stock);
            router.push('/checkout');
          }}
          className={`${ui.btnDark} w-full`}
        >
          اشترِ الآن
        </button>
      )}
    </div>
  );
}
