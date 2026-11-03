/**
 * طبقة الدفع.
 *
 * الحالة الحالية: الدفع عند الاستلام (cod) فقط يعمل فعليًا.
 * الدفع بالبطاقة معطّل عمدًا — لم يتم ربط أي بوابة دفع ولا توجد مفاتيح.
 *
 * لربط بوابة (Stripe / Paymob / Fawry ...):
 *  1) أنشئ حسابًا لدى البوابة. المفاتيح السرية تُوضع في متغيرات بيئة بدون NEXT_PUBLIC_.
 *  2) نفّذ createCardPaymentSession أدناه: أنشئ جلسة دفع على السيرفر بمبلغ الطلب المخزّن في قاعدة البيانات
 *     (لا تثق بأي مبلغ قادم من المتصفح) وأعد رابط صفحة الدفع المستضافة لدى البوابة.
 *  3) أضف Webhook route (مثل app/api/webhooks/<provider>/route.ts) يتحقق من توقيع البوابة ثم يحدّث
 *     payments.status و orders.payment_status عبر service role (يُحفظ في متغير بيئة سري).
 *  4) في قاعدة البيانات فعّل الإعداد:  update app_settings set value = 'true' where key = 'card_payments_enabled';
 *  5) أعد true من cardPaymentsEnabled() أدناه (أو اربطها بمتغير بيئة).
 * لا تخزّن بيانات البطاقات أبدًا: إدخالها يتم على صفحة البوابة المستضافة فقط.
 */

export function cardPaymentsEnabled(): boolean {
  return false;
}

export async function createCardPaymentSession(_input: {
  orderId: string;
  orderNumber: string;
  amount: number;
}): Promise<{ url: string }> {
  throw new Error('PAYMENT_GATEWAY_NOT_CONFIGURED');
}
