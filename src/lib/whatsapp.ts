import { CODE_VALID_DAYS } from '@/lib/resetCodes';

/** رقم واتساب بالأرقام فقط (دولي). أرقام مصر المحلية 01xxxxxxxxx تتحول إلى 201xxxxxxxxx */
export function waDigits(phone: string): string {
  const d = phone.replace(/\D/g, '');
  return d.length === 11 && d.startsWith('01') ? `20${d.slice(1)}` : d;
}

export function buildResetMessage(name: string | null, code: string, siteUrl: string): string {
  return [
    `مرحبًا ${name || ''}`.trim() + ' 👋',
    `رمز استعادة كلمة المرور في Kama Store: *${code}*`,
    `الرمز صالح لمدة ${CODE_VALID_DAYS} أيام.`,
    `أدخله من هنا: ${siteUrl}/auth/reset-code`,
    'لو لم تطلب استعادة كلمة المرور تجاهل هذه الرسالة ولا تشارك الرمز مع أحد.',
  ].join('\n');
}

/** رابط يفتح واتساب برسالة جاهزة، يكفي أن يضغط الأدمن «إرسال» */
export const waLink = (phone: string, text: string) => `https://wa.me/${waDigits(phone)}?text=${encodeURIComponent(text)}`;

const cfg = () => ({
  token: (process.env.WHATSAPP_CLOUD_TOKEN ?? '').trim(),
  phoneId: (process.env.WHATSAPP_PHONE_NUMBER_ID ?? '').trim(),
  template: (process.env.WHATSAPP_TEMPLATE_NAME ?? '').trim(),
  lang: (process.env.WHATSAPP_TEMPLATE_LANG ?? 'ar').trim(),
  version: (process.env.WHATSAPP_API_VERSION ?? 'v23.0').trim(),
  // auth = قالب مصادقة (زر نسخ الرمز، الأسهل والأضمن) | utility = قالب نصه متغيّران: الرمز ثم الرابط
  kind: (process.env.WHATSAPP_TEMPLATE_KIND ?? 'auth').trim().toLowerCase(),
});

/** هل الإرسال التلقائي عبر WhatsApp Cloud API مُعدّ؟ (اختياري: يحتاج حساب Meta Business وقالب معتمد) */
export const whatsappAutoConfigured = () => {
  const c = cfg();
  return Boolean(c.token && c.phoneId && c.template);
};

/**
 * إرسال تلقائي عبر WhatsApp Cloud API بقالب معتمد من Meta.
 * القالب (تصنيف Utility) نصه يحتوي متغيرين: {{1}} = الرمز، {{2}} = رابط صفحة الرمز.
 */
export async function sendResetViaCloudApi(phone: string, code: string, siteUrl: string): Promise<{ ok: boolean; error?: string }> {
  const c = cfg();
  if (!c.token || !c.phoneId || !c.template) return { ok: false, error: 'not_configured' };
  try {
    const res = await fetch(`https://graph.facebook.com/${c.version}/${c.phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: waDigits(phone),
        type: 'template',
        template: {
          name: c.template,
          language: { code: c.lang },
          components:
            c.kind === 'utility'
              ? [{ type: 'body', parameters: [{ type: 'text', text: code }, { type: 'text', text: `${siteUrl}/auth/reset-code` }] }]
              : [
                  { type: 'body', parameters: [{ type: 'text', text: code }] },
                  { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
                ],
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => null)) as { error?: { message?: string; code?: number } } | null;
    console.error('[whatsapp] send failed', res.status, body?.error?.code, body?.error?.message);
    return { ok: false, error: body?.error?.message ?? `HTTP ${res.status}` };
  } catch (e) {
    console.error('[whatsapp] send error', e instanceof Error ? e.message : e);
    return { ok: false, error: 'network' };
  }
}
