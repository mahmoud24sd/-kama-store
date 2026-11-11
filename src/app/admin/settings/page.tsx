import type { Metadata } from 'next';
import { saveContactSettings, savePublishSettings } from '@/app/actions/team';
import { requirePermission } from '@/lib/auth';
import { createAdminClient, hasServiceRole, serviceKeyInfo, serviceKeyPresent } from '@/lib/supabase/admin';
import { getContactSettings, getPublishSettings } from '@/lib/settings';
import { getBotInfo } from '@/lib/telegramBot';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'إعدادات التواصل' };

export default async function AdminSettings({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { profile } = await requirePermission('settings');
  const sp = await searchParams;
  const c = await getContactSettings();
  const pub = await getPublishSettings();
  const bot = await getBotInfo();

  // فحص المفتاح السري الذي يعتمد عليه التسجيل بدون بريد ونشر المنتجات
  let keyState: 'missing' | 'badformat' | 'rejected' | 'ok' = 'missing';
  let keyError = '';
  if (serviceKeyPresent) {
    if (!hasServiceRole) keyState = 'badformat';
    else {
      try {
        const { error } = await createAdminClient().auth.admin.listUsers({ page: 1, perPage: 1 });
        keyState = error ? 'rejected' : 'ok';
        keyError = error ? `${error.status ?? ''} ${error.message}` : '';
      } catch (e) {
        keyState = 'rejected';
        keyError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-extrabold">إعدادات التواصل</h1>

      <section className="space-y-2 rounded-xl border border-gray-200 p-4">
        <h2 className="font-bold">بوت تليجرام</h2>
        {bot ? (
          <p className="text-sm">
            البوت شغّال:{' '}
            <a href={`https://t.me/${bot.username}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-600 underline" dir="ltr">@{bot.username}</a>
            {' '}· <a href="/admin/telegram" className="font-semibold text-brand-600 underline">الأوامر والتفاصيل</a>
          </p>
        ) : (
          <p className="text-sm text-amber-700">البوت لسه مش مضبوط. ضيف TELEGRAM_BOT_TOKEN في Vercel (من BotFather) ثم Redeploy. <a href="/admin/telegram" className="underline">التفاصيل</a></p>
        )}
      </section>
      <p className="text-sm text-gray-600">تظهر هذه البيانات في أسفل كل صفحات الموقع وفي صفحة «تواصل معنا». اترك الخانة فارغة لإخفائها.</p>
      {sp.saved && <p className={ui.alertOk}>تم الحفظ.</p>}
      {sp.error && <p className={ui.alertError}>{sp.error}</p>}

      <form action={saveContactSettings} className="space-y-3">
        <div>
          <label className={ui.label} htmlFor="phone">رقم الهاتف</label>
          <input id="phone" name="phone" defaultValue={c.phone} dir="ltr" placeholder="01012345678" className={ui.input} />
        </div>
        <div>
          <label className={ui.label} htmlFor="whatsapp">واتساب (رقم بالصيغة الدولية أو رابط)</label>
          <input id="whatsapp" name="whatsapp" defaultValue={c.whatsapp} dir="ltr" placeholder="201012345678" className={ui.input} />
        </div>
        <div>
          <label className={ui.label} htmlFor="email">البريد الإلكتروني (Gmail)</label>
          <input id="email" name="email" type="email" defaultValue={c.email} dir="ltr" placeholder="yourname@gmail.com" className={ui.input} />
        </div>
        <div>
          <label className={ui.label} htmlFor="facebook">صفحة فيسبوك (رابط)</label>
          <input id="facebook" name="facebook" defaultValue={c.facebook} dir="ltr" placeholder="https://facebook.com/..." className={ui.input} />
        </div>
        <div>
          <label className={ui.label} htmlFor="instagram">صفحة إنستجرام (رابط)</label>
          <input id="instagram" name="instagram" defaultValue={c.instagram} dir="ltr" placeholder="https://instagram.com/..." className={ui.input} />
        </div>
        <div>
          <label className={ui.label} htmlFor="tiktok">حساب تيك توك (رابط)</label>
          <input id="tiktok" name="tiktok" defaultValue={c.tiktok} dir="ltr" placeholder="https://tiktok.com/@..." className={ui.input} />
        </div>
        <button className={ui.btnDark}>حفظ</button>
      </form>

      <hr className="my-6" />
      <h2 className="text-lg font-extrabold">حالة المفتاح السري (التسجيل بدون بريد)</h2>
      {keyState === 'ok' ? (
        <p className={ui.alertOk}>✅ المفتاح شغّال. التسجيل لا يعتمد على بريد التأكيد.</p>
      ) : (
        <p className={ui.alertError}>
          {keyState === 'missing' && '❌ المتغير SUPABASE_SERVICE_ROLE_KEY غير موجود في Vercel (أو لم تعمل Redeploy بعد إضافته، أو أضفته في بيئة Preview فقط بدل Production).'}
          {keyState === 'badformat' && '❌ المتغير موجود لكن قيمته تحتوي مسافات أو أسطرًا أو حروفًا غير صالحة. انسخ المفتاح من Supabase مرة أخرى بدون أي زيادات.'}
          {keyState === 'rejected' && '❌ المتغير موجود لكن Supabase يرفض المفتاح. تأكد أنه المفتاح السري (secret / service_role) وليس المفتاح العام (publishable / anon).'}
        </p>
      )}
      {serviceKeyPresent && keyState !== 'ok' && (
        <p className="rounded-lg bg-gray-50 p-2 text-xs text-gray-700" dir="ltr">
          نوع المفتاح الموجود: <b>{serviceKeyInfo.kind}</b> ({serviceKeyInfo.length} chars){serviceKeyInfo.kind === 'publishable' && ' ← هذا المفتاح العام وليس السري!'}
          {keyError && <><br />Supabase: {keyError}</>}
        </p>
      )}

      <hr className="my-6" />
      <h2 className="text-lg font-extrabold">نشر منتجات الغير (InstaPay / محفظة)</h2>
      <p className="text-sm text-gray-600">من يريد نشر منتج عندنا يحوّل الرسم إلى أحد هذه الحسابات ثم يرسل رقم العملية، وتؤكده أنت (أو أدمن لديه صلاحية «تأكيد دفع نشر المنتجات») من صفحة «طلبات النشر».</p>
      <form action={savePublishSettings} className="space-y-3">
        <div>
          <label className={ui.label} htmlFor="instapay">حسابات استلام الرسم (InstaPay أو محفظة) — سطر لكل حساب</label>
          <textarea id="instapay" name="instapay" rows={3} defaultValue={pub.instapay} dir="ltr" placeholder={'InstaPay: name@instapay\nفودافون كاش: 01012345678'} className={ui.input} />
        </div>
        <div>
          <label className={ui.label} htmlFor="fee">رسم نشر المنتج (ج.م)</label>
          <input id="fee" name="fee" type="number" min={0} step="1" defaultValue={pub.fee} className={ui.input} />
        </div>
        <button className={ui.btnDark}>حفظ إعدادات النشر</button>
      </form>

      {profile.role === 'owner' && (
        <>
      <h2 className="mt-8 text-lg font-bold">نسخة احتياطية (تصدير)</h2>
      <p className="mb-2 text-sm text-gray-600">حمّل ملفات CSV تفتح في إكسل. يُفضّل تحميلها كل أسبوع وحفظها عندك.</p>
      <div className="flex flex-wrap gap-2">
        {[['orders', 'الطلبات'], ['products', 'المنتجات'], ['customers', 'العملاء'], ['withdrawals', 'السحوبات']].map(([k, l]) => (
          <a key={k} href={`/admin/backup/${k}`} className={ui.btnOutline}>تحميل {l}</a>
        ))}
      </div>
        </>
      )}
    </div>
  );
}
