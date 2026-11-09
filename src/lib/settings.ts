import { cache } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type ContactSettings = {
  phone: string;
  email: string;
  whatsapp: string;
  facebook: string;
  instagram: string;
  tiktok: string;
};

/** مفتاح الإعداد في app_settings لكل حقل */
export const SETTING_KEYS: Record<keyof ContactSettings, string> = {
  phone: 'contact_phone',
  email: 'contact_email',
  whatsapp: 'contact_whatsapp',
  facebook: 'social_facebook',
  instagram: 'social_instagram',
  tiktok: 'social_tiktok',
};

/** بيانات التواصل: من قاعدة البيانات (يعدّلها المالك)، وإلا من متغيرات البيئة القديمة. لا تُسبب خطأ أبدًا. */
export const getContactSettings = cache(async (): Promise<ContactSettings> => {
  const result: ContactSettings = {
    phone: process.env.NEXT_PUBLIC_CONTACT_PHONE ?? '',
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? '',
    whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_URL ?? '',
    facebook: process.env.NEXT_PUBLIC_FACEBOOK_URL ?? '',
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? '',
    tiktok: '',
  };
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('app_settings').select('key,value').in('key', Object.values(SETTING_KEYS));
    const map = new Map<string, string>((data ?? []).map((r) => [String(r.key), String(r.value ?? '').trim()] as [string, string]));
    (Object.keys(SETTING_KEYS) as (keyof ContactSettings)[]).forEach((k) => {
      const v = map.get(SETTING_KEYS[k]);
      if (v) result[k] = v;
    });
  } catch (e) {
    unstable_rethrow(e); // لا نبتلع إشارات Next الداخلية (الصفحة الديناميكية)
    // الجدول أو الإعدادات غير جاهزة: نكتفي بالقيم الاحتياطية
  }
  return result;
});

/** رقم واتساب (أرقام فقط) أو رابط كامل → رابط wa.me */
export function whatsappLink(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  const digits = value.replace(/[^\d]/g, '');
  return digits ? `https://wa.me/${digits}` : '';
}

export type PublishSettings = { instapay: string; fee: number };

/** حساب InstaPay ورسم نشر المنتج (يحدده المالك). الافتراضي 10 جنيه. */
export const getPublishSettings = cache(async (): Promise<PublishSettings> => {
  const result: PublishSettings = { instapay: '', fee: 10 };
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('app_settings').select('key,value').in('key', ['instapay_handle', 'publish_fee']);
    for (const r of data ?? []) {
      const v = String(r.value ?? '').trim();
      if (r.key === 'instapay_handle') result.instapay = v;
      if (r.key === 'publish_fee' && Number(v) >= 0 && v !== '') result.fee = Number(v);
    }
  } catch (e) {
    unstable_rethrow(e);
  }
  return result;
});
