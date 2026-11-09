'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ImageOff } from 'lucide-react';
import { useCart } from '@/components/cart/CartProvider';
import { useCartDetails } from '@/components/cart/useCartDetails';
import { quoteCoupon } from '@/app/actions/cart';
import { placeOrder } from '@/app/actions/orders';
import { EXPRESS_FEE, SHIPPING_OPTIONS, shippingFee, type ShippingMethod } from '@/lib/shipping';
import type { Address } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import { ui } from '@/lib/ui';
import { GOVERNORATES } from '@/lib/governorates';

type Props = {
  addresses: Address[];
  defaultName: string;
  defaultPhone: string;
  cardEnabled: boolean;
  initialCoupon?: string;
};

export default function CheckoutForm({ addresses, defaultName, defaultPhone, cardEnabled, initialCoupon }: Props) {
  const router = useRouter();
  const { clear } = useCart();
  const { items, subtotal, loading, hasUnavailable } = useCartDetails();
  const [pending, start] = useTransition();

  const defaultAddr = addresses.find((a) => a.is_default) ?? addresses[0];
  const [addressId, setAddressId] = useState<string>(defaultAddr?.id ?? 'new');
  const [form, setForm] = useState({ full_name: defaultName, phone: defaultPhone, line1: '', city: '', governorate: '', notes: '' });
  const [saveAddress, setSaveAddress] = useState(true);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('standard');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'card'>('cod');
  const [code, setCode] = useState(initialCoupon ?? '');
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [error, setError] = useState('');

  const selected = addresses.find((a) => a.id === addressId);
  const address = useMemo(
    () => (selected ? { full_name: selected.full_name, phone: selected.phone, line1: selected.line1, city: selected.city, governorate: selected.governorate, notes: selected.notes ?? '' } : form),
    [selected, form],
  );

  const checkCoupon = (c: string, sub: number) =>
    quoteCoupon(c, sub).then((res) => {
      setCouponMsg({ ok: res.valid, text: res.message });
      setCoupon(res.valid ? { code: c.trim().toUpperCase(), discount: res.discount } : null);
    });

  // تطبيق الكوبون القادم من صفحة السلة بعد معرفة المجموع الفعلي
  useEffect(() => {
    if (initialCoupon && subtotal > 0 && !coupon && !couponMsg) void checkCoupon(initialCoupon, subtotal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  if (loading) return <div className="rounded-xl bg-white p-10 text-center text-gray-500">جارٍ التحميل...</div>;

  if (items.length === 0) {
    return (
      <div className="rounded-xl bg-white p-12 text-center shadow-sm">
        <h1 className="text-xl font-bold">سلتك فارغة</h1>
        <Link href="/products" className={`${ui.btnPrimary} mt-4`}>تصفّح المنتجات</Link>
      </div>
    );
  }

  const discount = coupon ? Math.min(coupon.discount, subtotal) : 0;
  const after = subtotal - discount;
  const shipping = shippingFee(shippingMethod, after);
  const total = after + shipping;

  const submit = () => {
    setError('');
    if (hasUnavailable) return setError('السلة تحتوي على منتجات غير متوفرة. ارجع للسلة واحذفها.');
    start(async () => {
      const res = await placeOrder({
        items: items.filter((i) => i.available).map((i) => ({ productId: i.productId, variantId: i.variantId, qty: i.qty })),
        address: { ...address, notes: address.notes || null },
        shippingMethod,
        paymentMethod,
        coupon: coupon?.code ?? null,
        saveAddress: addressId === 'new' && saveAddress,
      });
      if (!res.ok) {
        setError(res.error);
        if (res.orderNumber) clear(); // الطلب سُجّل فعلًا
        return;
      }
      clear();
      if (res.paymentUrl) {
        window.location.href = res.paymentUrl;
        return;
      }
      router.push(`/checkout/success/${encodeURIComponent(res.orderNumber)}`);
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
      <div className="space-y-4">
        {/* 1. العنوان */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-extrabold">1. بيانات الشحن</h2>

          {addresses.length > 0 && (
            <div className="mb-4 space-y-2">
              {addresses.map((a) => (
                <label key={a.id} className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${addressId === a.id ? 'border-accent-500 bg-accent-300/10' : 'border-gray-200'}`}>
                  <input type="radio" name="address" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                  <span>
                    <b>{a.full_name}</b> · <span dir="ltr">{a.phone}</span>
                    <br />
                    {a.line1}، {a.city}، {a.governorate}
                  </span>
                </label>
              ))}
              <label className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${addressId === 'new' ? 'border-accent-500 bg-accent-300/10' : 'border-gray-200'}`}>
                <input type="radio" name="address" checked={addressId === 'new'} onChange={() => setAddressId('new')} />
                عنوان جديد
              </label>
            </div>
          )}

          {addressId === 'new' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="c_name" className={ui.label}>الاسم الكامل</label>
                <input id="c_name" className={ui.input} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} autoComplete="name" />
              </div>
              <div>
                <label htmlFor="c_phone" className={ui.label}>رقم الهاتف</label>
                <input id="c_phone" dir="ltr" className={ui.input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" inputMode="tel" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="c_line" className={ui.label}>العنوان بالتفصيل</label>
                <input id="c_line" className={ui.input} value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} autoComplete="street-address" placeholder="الشارع، رقم المبنى، الشقة" />
              </div>
              <div>
                <label htmlFor="c_city" className={ui.label}>المدينة / المنطقة</label>
                <input id="c_city" className={ui.input} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div>
                <label htmlFor="c_gov" className={ui.label}>المحافظة</label>
                <select id="c_gov" className={ui.input} value={form.governorate} onChange={(e) => setForm({ ...form, governorate: e.target.value })}>
                  <option value="">اختر المحافظة</option>
                  {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="c_notes" className={ui.label}>ملاحظات للمندوب (اختياري)</label>
                <input id="c_notes" className={ui.input} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={300} />
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} /> احفظ هذا العنوان في حسابي
              </label>
            </div>
          )}
        </section>

        {/* 2. الشحن */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-extrabold">2. طريقة الشحن</h2>
          <div className="space-y-2">
            {SHIPPING_OPTIONS.map((o) => {
              const fee = shippingFee(o.id, after);
              return (
                <label key={o.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 text-sm ${shippingMethod === o.id ? 'border-accent-500 bg-accent-300/10' : 'border-gray-200'}`}>
                  <span className="flex items-center gap-3">
                    <input type="radio" name="shipping" checked={shippingMethod === o.id} onChange={() => setShippingMethod(o.id)} />
                    <span><b>{o.label}</b> <span className="text-gray-500">· {o.eta}</span></span>
                  </span>
                  <b>{fee === 0 ? 'مجاني' : formatPrice(o.id === 'express' ? EXPRESS_FEE : fee)}</b>
                </label>
              );
            })}
          </div>
        </section>

        {/* 3. الدفع */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-extrabold">3. طريقة الدفع</h2>
          <div className="space-y-2">
            <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${paymentMethod === 'cod' ? 'border-accent-500 bg-accent-300/10' : 'border-gray-200'}`}>
              <input type="radio" name="payment" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
              <b>الدفع عند الاستلام</b>
            </label>
            {cardEnabled ? (
              <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${paymentMethod === 'card' ? 'border-accent-500 bg-accent-300/10' : 'border-gray-200'}`}>
                <input type="radio" name="payment" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} />
                <span><b>بطاقة بنكية</b> <span className="text-gray-500">· ستُحوَّل إلى صفحة الدفع الآمنة</span></span>
              </label>
            ) : (
              <p className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">الدفع بالبطاقة غير مفعّل حاليًا.</p>
            )}
          </div>
        </section>
      </div>

      {/* 4. المراجعة */}
      <aside className="h-fit space-y-4 rounded-xl bg-white p-4 shadow-sm lg:sticky lg:top-40">
        <h2 className="text-lg font-extrabold">4. مراجعة الطلب</h2>
        <ul className="max-h-64 space-y-3 overflow-y-auto">
          {items.map((it) => (
            <li key={`${it.productId}-${it.variantId}`} className="flex gap-3 text-sm">
              <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                {it.image ? <Image src={it.image} alt="" fill sizes="56px" className="object-contain p-1" /> : <span className="flex h-full items-center justify-center text-gray-300"><ImageOff className="h-5 w-5" /></span>}
              </span>
              <span className="flex-1">
                <span className="line-clamp-2 font-semibold">{it.name}</span>
                {it.variantLabel && <span className="block text-xs text-gray-500">{it.variantLabel}</span>}
                <span className="text-xs text-gray-500">الكمية: {it.qty}</span>
              </span>
              <b>{formatPrice(it.unitPrice * it.qty)}</b>
            </li>
          ))}
        </ul>

        <div className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="كود الخصم" dir="ltr" className={ui.input} aria-label="كود الخصم" />
          <button type="button" disabled={!code.trim()} onClick={() => void checkCoupon(code, subtotal)} className={ui.btnOutline}>تطبيق</button>
        </div>
        {couponMsg && <p className={couponMsg.ok ? ui.alertOk : ui.alertError}>{couponMsg.text}</p>}

        <dl className="space-y-2 border-t border-gray-100 pt-3 text-sm">
          <div className="flex justify-between"><dt>المجموع الفرعي</dt><dd>{formatPrice(subtotal)}</dd></div>
          {discount > 0 && <div className="flex justify-between text-green-700"><dt>الخصم</dt><dd>- {formatPrice(discount)}</dd></div>}
          <div className="flex justify-between"><dt>الشحن</dt><dd>{shipping === 0 ? 'مجاني' : formatPrice(shipping)}</dd></div>
          <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-extrabold"><dt>الإجمالي</dt><dd>{formatPrice(total)}</dd></div>
        </dl>

        {error && <p className={ui.alertError} role="alert">{error}</p>}

        <button type="button" onClick={submit} disabled={pending} className={`${ui.btnPrimary} w-full py-3 text-base`}>
          {pending ? 'جارٍ تأكيد الطلب...' : 'تأكيد الطلب'}
        </button>
        <p className="text-xs text-gray-500">بالضغط على تأكيد الطلب فأنت توافق على <Link href="/info/terms" className="text-brand-600 hover:underline">الشروط والأحكام</Link>.</p>
      </aside>
    </div>
  );
}
