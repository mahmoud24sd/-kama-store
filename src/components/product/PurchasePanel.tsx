'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ShoppingCart } from 'lucide-react';
import { useCart } from '@/components/cart/CartProvider';
import FavoriteButton from './FavoriteButton';
import type { Variant } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import { ui } from '@/lib/ui';

type Props = {
  productId: string;
  basePrice: number;
  baseStock: number;
  variants: Variant[];
  isFavorite: boolean;
};

export default function PurchasePanel({ productId, basePrice, baseStock, variants, isFavorite }: Props) {
  const { add } = useCart();
  const router = useRouter();
  const hasVariants = variants.length > 0;

  const colors = useMemo(() => Array.from(new Set(variants.map((v) => v.color).filter((c): c is string => Boolean(c)))), [variants]);
  const sizes = useMemo(() => Array.from(new Set(variants.map((v) => v.size).filter((s): s is string => Boolean(s)))), [variants]);

  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');

  const selected = useMemo(() => {
    if (!hasVariants) return null;
    if (colors.length > 0 && !color) return null;
    if (sizes.length > 0 && !size) return null;
    return variants.find((v) => (colors.length === 0 || v.color === color) && (sizes.length === 0 || v.size === size)) ?? null;
  }, [hasVariants, colors, sizes, color, size, variants]);

  const price = selected?.price_override ?? basePrice;
  const stock = hasVariants ? (selected ? selected.stock : 0) : baseStock;
  const needsSelection = hasVariants && !selected;
  const optionStock = (c: string | null, s: string | null) =>
    variants.find((v) => (c === null || v.color === c) && (s === null || v.size === s) && v.stock > 0) !== undefined;

  function addToCart(): boolean {
    setError('');
    if (needsSelection) {
      setError(colors.length > 0 && !color ? 'اختر اللون' : 'اختر المقاس');
      return false;
    }
    if (stock < 1) {
      setError('هذا الخيار غير متوفر حاليًا');
      return false;
    }
    add({ productId, variantId: selected?.id ?? null, qty }, stock);
    return true;
  }

  return (
    <div className="space-y-4">
      <div className="text-3xl font-extrabold text-gray-900">{formatPrice(price)}</div>

      {colors.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">اللون: <span className="font-normal text-gray-600">{color ?? 'اختر'}</span></legend>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => {
              const ok = optionStock(c, size);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setColor(c); setQty(1); setError(''); }}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${color === c ? 'border-accent-500 bg-accent-300/20 font-bold' : 'border-gray-300 bg-white'} ${ok ? '' : 'text-gray-400 line-through'}`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {sizes.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">المقاس: <span className="font-normal text-gray-600">{size ?? 'اختر'}</span></legend>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => {
              const ok = optionStock(color, s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setSize(s); setQty(1); setError(''); }}
                  className={`min-w-10 rounded-lg border px-3 py-1.5 text-sm ${size === s ? 'border-accent-500 bg-accent-300/20 font-bold' : 'border-gray-300 bg-white'} ${ok ? '' : 'text-gray-400 line-through'}`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="text-sm">
        {needsSelection ? (
          <span className="text-gray-500">اختر الخيارات لمعرفة التوفر</span>
        ) : stock > 0 ? (
          <span className="font-semibold text-green-700">متوفر{stock <= 5 ? ` — متبقي ${stock} فقط` : ''}</span>
        ) : (
          <span className="font-semibold text-red-600">غير متوفر حاليًا</span>
        )}
      </div>

      {stock > 0 && (
        <div className="flex items-center gap-3">
          <label htmlFor="qty" className="text-sm font-semibold">الكمية</label>
          <select id="qty" value={qty} onChange={(e) => setQty(Number(e.target.value))} className={`${ui.input} !w-24`}>
            {Array.from({ length: Math.min(stock, 10) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      )}

      {error && <p className={ui.alertError}>{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!needsSelection && stock < 1}
          onClick={() => {
            if (addToCart()) {
              setAdded(true);
              setTimeout(() => setAdded(false), 1800);
            }
          }}
          className={`${ui.btnPrimary} flex-1 py-3`}
        >
          {added ? <Check className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
          {added ? 'تمت الإضافة للسلة' : 'أضف إلى السلة'}
        </button>
        <button
          type="button"
          disabled={!needsSelection && stock < 1}
          onClick={() => { if (addToCart()) router.push('/checkout'); }}
          className={`${ui.btnDark} flex-1 py-3`}
        >
          اشترِ الآن
        </button>
        <FavoriteButton productId={productId} initial={isFavorite} className="!h-11 !w-11 border border-gray-200" />
      </div>
    </div>
  );
}
