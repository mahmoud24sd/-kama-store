'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { cardPaymentsEnabled, createCardPaymentSession } from '@/lib/payments';

const schema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().nullable(),
        qty: z.number().int().min(1).max(99),
      }),
    )
    .min(1, 'السلة فارغة')
    .max(50),
  address: z.object({
    full_name: z.string().trim().min(2, 'أدخل الاسم الكامل').max(100),
    phone: z.string().trim().regex(/^[0-9+\s-]{8,15}$/, 'رقم هاتف غير صالح'),
    line1: z.string().trim().min(5, 'أدخل العنوان بالتفصيل').max(200),
    city: z.string().trim().min(2, 'أدخل المدينة').max(80),
    governorate: z.string().trim().min(2, 'أدخل المحافظة').max(80),
    notes: z.string().trim().max(300).optional().nullable(),
  }),
  shippingMethod: z.enum(['standard', 'express']),
  paymentMethod: z.enum(['cod', 'card']),
  coupon: z.string().trim().max(40).optional().nullable(),
  saveAddress: z.boolean().optional(),
});

export type PlaceOrderResult =
  | { ok: true; orderNumber: string; paymentUrl?: string }
  | { ok: false; error: string; orderNumber?: string };

function mapRpcError(message: string): string {
  const [code, detail] = message.split(':');
  switch (code.trim()) {
    case 'not_authenticated':
      return 'يجب تسجيل الدخول لإتمام الطلب';
    case 'empty_cart':
      return 'السلة فارغة';
    case 'insufficient_stock':
      return `الكمية المطلوبة غير متوفرة${detail ? ` للمنتج: ${detail.trim()}` : ''}`;
    case 'product_unavailable':
    case 'variant_unavailable':
      return 'أحد المنتجات لم يعد متاحًا. حدّث السلة وحاول مرة أخرى';
    case 'variant_required':
      return `يرجى اختيار اللون/المقاس${detail ? ` للمنتج: ${detail.trim()}` : ''}`;
    case 'invalid_coupon':
      return 'الكوبون غير صالح أو منتهي';
    case 'coupon_min_order':
      return 'قيمة الطلب أقل من الحد الأدنى لاستخدام الكوبون';
    case 'invalid_quantity':
      return 'كمية غير صالحة';
    default:
      return 'تعذر إتمام الطلب، حاول مرة أخرى';
  }
}

export async function placeOrder(input: unknown): Promise<PlaceOrderResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (d.paymentMethod === 'card' && !cardPaymentsEnabled()) {
    return { ok: false, error: 'الدفع بالبطاقة غير متاح حاليًا' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'يجب تسجيل الدخول لإتمام الطلب' };

  // السعر والمخزون والشحن والخصم تُحسب كلها داخل الدالة في قاعدة البيانات
  const { data, error } = await supabase.rpc('create_order', {
    p_items: d.items.map((i) => ({ product_id: i.productId, variant_id: i.variantId, quantity: i.qty })),
    p_address: d.address,
    p_shipping_method: d.shippingMethod,
    p_payment_method: d.paymentMethod,
    p_coupon: d.coupon || null,
  });
  if (error || !data) return { ok: false, error: mapRpcError(error?.message ?? '') };

  const order = data as { id: string; order_number: string; total: number };

  if (d.saveAddress) {
    const { count } = await supabase.from('addresses').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
    await supabase.from('addresses').insert({
      user_id: user.id,
      ...d.address,
      notes: d.address.notes || null,
      is_default: (count ?? 0) === 0,
    });
  }

  if (d.paymentMethod === 'card') {
    try {
      const session = await createCardPaymentSession({ orderId: order.id, orderNumber: order.order_number, amount: order.total });
      return { ok: true, orderNumber: order.order_number, paymentUrl: session.url };
    } catch {
      return {
        ok: false,
        orderNumber: order.order_number,
        error: `تم تسجيل الطلب رقم ${order.order_number} لكن تعذر بدء الدفع الإلكتروني. تواصل معنا لإتمام الدفع.`,
      };
    }
  }

  return { ok: true, orderNumber: order.order_number };
}
