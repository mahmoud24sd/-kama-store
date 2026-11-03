'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ImageOff, ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from './CartProvider';
import { useCartDetails } from './useCartDetails';
import { quoteCoupon } from '@/app/actions/cart';
import { FREE_SHIPPING_THRESHOLD, shippingFee } from '@/lib/shipping';
import { formatPrice } from '@/lib/utils';
import { ui } from '@/lib/ui';

export default function CartView() {
  const { setQty, remove } = useCart();
  const { items, subtotal, loading, hasUnavailable } = useCartDetails();
  const [code, setCode] = useState('');
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (loading) return <div className="rounded-xl bg-white p-10 text-center text-gray-500">جارٍ تحميل السلة...</div>;

  if (items.length === 0) {
    return (
      <div className="rounded-xl bg-white p-12 text-center shadow-sm">
        <ShoppingBag className="mx-auto h-14 w-14 text-gray-300" />
        <h1 className="mt-3 text-xl font-bold">سلتك فارغة</h1>
        <p className="mt-1 text-sm text-gray-600">ابدأ بإضافة منتجات تعجبك.</p>
        <Link href="/products" className={`${ui.btnPrimary} mt-5`}>تصفّح المنتجات</Link>
      </div>
    );
  }

  const discount = coupon ? Math.min(coupon.discount, subtotal) : 0;
  const after = subtotal - discount;
  const shipping = shippingFee('standard', after);
  const total = after + shipping;

  const applyCoupon = () =>
    start(async () => {
      const res = await quoteCoupon(code, subtotal);
      setCouponMsg({ ok: res.valid, text: res.message });
      setCoupon(res.valid ? { code: code.trim().toUpperCase(), discount: res.discount } : null);
    });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h1 className="mb-4 text-xl font-extrabold">سلة المشتريات</h1>
        <ul className="divide-y divide-gray-100">
          {items.map((it) => (
            <li key={`${it.productId}-${it.variantId}`} className="flex gap-3 py-4">
              <Link href={it.slug ? `/products/${encodeURIComponent(it.slug)}` : '#'} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                {it.image ? (
                  <Image src={it.image} alt={it.name} fill sizes="96px" className="object-contain p-1" />
                ) : (
                  <span className="flex h-full items-center justify-center text-gray-300"><ImageOff className="h-8 w-8" /></span>
                )}
              </Link>
              <div className="flex-1">
                <p className="font-semibold leading-snug">{it.name}</p>
                {it.variantLabel && <p className="text-sm text-gray-500">{it.variantLabel}</p>}
                {!it.available ? (
                  <p className="mt-1 text-sm font-semibold text-red-600">غير متوفر — احذفه لإتمام الطلب</p>
                ) : (
                  <>
                    <p className="mt-1 font-bold">{formatPrice(it.unitPrice)}</p>
                    {it.stock <= 5 && <p className="text-xs text-red-600">متبقي {it.stock} فقط</p>}
                  </>
                )}
                <div className="mt-2 flex items-center gap-3">
                  {it.available && (
                    <select
                      aria-label="الكمية"
                      value={it.qty}
                      onChange={(e) => setQty(it.productId, it.variantId, Number(e.target.value))}
                      className={`${ui.input} !w-20`}
                    >
                      {Array.from({ length: Math.min(it.stock, Math.max(10, it.qty)) }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  )}
                  <button type="button" onClick={() => remove(it.productId, it.variantId)} className="flex items-center gap-1 text-sm text-red-600 hover:underline">
                    <Trash2 className="h-4 w-4" /> حذف
                  </button>
                </div>
              </div>
              {it.available && <p className="font-extrabold">{formatPrice(it.unitPrice * it.qty)}</p>}
            </li>
          ))}
        </ul>
      </section>

      <aside className="h-fit space-y-4 rounded-xl bg-white p-4 shadow-sm lg:sticky lg:top-40">
        <h2 className="text-lg font-extrabold">ملخص الطلب</h2>

        <div className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="كود الخصم" dir="ltr" className={ui.input} aria-label="كود الخصم" />
          <button type="button" onClick={applyCoupon} disabled={pending || !code.trim()} className={ui.btnOutline}>تطبيق</button>
        </div>
        {couponMsg && <p className={couponMsg.ok ? ui.alertOk : ui.alertError}>{couponMsg.text}</p>}

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt>المجموع الفرعي</dt><dd>{formatPrice(subtotal)}</dd></div>
          {discount > 0 && <div className="flex justify-between text-green-700"><dt>الخصم ({coupon?.code})</dt><dd>- {formatPrice(discount)}</dd></div>}
          <div className="flex justify-between"><dt>الشحن (عادي)</dt><dd>{shipping === 0 ? 'مجاني' : formatPrice(shipping)}</dd></div>
          {shipping > 0 && after < FREE_SHIPPING_THRESHOLD && (
            <p className="text-xs text-gray-500">أضف {formatPrice(FREE_SHIPPING_THRESHOLD - after)} للحصول على شحن مجاني</p>
          )}
          <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-extrabold"><dt>الإجمالي</dt><dd>{formatPrice(total)}</dd></div>
        </dl>
        <p className="text-xs text-gray-500">الأسعار والمخزون والخصم يُعاد التحقق منها نهائيًا على الخادم عند تأكيد الطلب.</p>

        {hasUnavailable ? (
          <p className={ui.alertError}>احذف المنتجات غير المتوفرة للمتابعة.</p>
        ) : (
          <Link href={coupon ? `/checkout?coupon=${encodeURIComponent(coupon.code)}` : '/checkout'} className={`${ui.btnPrimary} w-full py-3`}>
            متابعة إلى إتمام الطلب
          </Link>
        )}
      </aside>
    </div>
  );
}
