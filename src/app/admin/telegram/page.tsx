import type { Metadata } from 'next';
import Link from 'next/link';
import { addBotAdmin, removeBotAdmin, saveBotSettings } from '@/app/actions/telegramSettings';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';
import { getBotInfo } from '@/lib/telegramBot';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'بوت تليجرام' };
export const dynamic = 'force-dynamic';

export default async function TelegramBotPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { profile, supabase } = await requireAdmin();
  const sp = await searchParams;
  const bot = await getBotInfo();
  const isOwner = profile.role === 'owner';

  // إعدادات الملف وقائمة الأدمن: المالك فقط (الأدمن لا يرى بعضهم ولا الإعدادات)
  const st: Record<string, string> = {};
  let admins: string[] = [];
  let cats: string[] = [];
  if (isOwner && hasServiceRole) {
    try {
      const { data } = await createAdminClient().from('telegram_state').select('key,value').in('key', ['fixed', 'markup', 'category', 'publish', 'admins']);
      for (const r of data ?? []) st[r.key as string] = r.value as string;
      admins = (JSON.parse(st.admins ?? '[]') as unknown[]).map(String);
    } catch {
      admins = [];
    }
    const { data: c } = await supabase.from('categories').select('name').order('name');
    cats = (c ?? []).map((x) => x.name as string);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold">بوت تليجرام</h1>
      {sp.saved && <p className={ui.alertOk}>تم الحفظ.</p>}
      {sp.error && <p className={ui.alertError}>{sp.error}</p>}

      {bot ? (
        <section className="space-y-3 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="font-bold">البوت شغّال: {bot.name} (@{bot.username})</p>
          <a href={`https://t.me/${bot.username}`} target="_blank" rel="noopener noreferrer" className={`${ui.btnPrimary} inline-block`}>
            افتح البوت في تليجرام
          </a>
          <p className="text-sm text-gray-700">البوت يرد على المالك وأدمن البوت فقط، وأي شخص تاني بيتجاهله. اكتب له <b dir="ltr">/start</b> لتشوف الأوامر ومعرّفك.</p>
        </section>
      ) : (
        <section className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-bold">البوت لسه مش مضبوط.</p>
          <p>{isOwner ? 'ضيف TELEGRAM_BOT_TOKEN في Vercel (من https://t.me/BotFather) ثم اعمل Redeploy.' : 'اطلب من المالك يكمّل إعداد البوت.'}</p>
        </section>
      )}

      <section className="space-y-2 rounded-xl border border-gray-200 p-4 text-sm">
        <h2 className="font-bold">طريقة الاستخدام (للأدمن)</h2>
        <ol className="list-decimal space-y-1 pr-5">
          <li>افتح البوت واكتب <b dir="ltr">/start</b> وابعت للمالك رقمك عشان يضيفك.</li>
          <li>ابعت للبوت رابط قناة عامة، مثلًا <b dir="ltr">https://t.me/اسم_القناة</b> (أو <b dir="ltr">/channel الرابط 30</b> لآخر 30 يوم).</li>
          <li>لما يخلّص اكتب <b dir="ltr">/export</b> ويبعتلك ملف إكسل بالأسعار بعد الزيادة اللي حددها المالك.</li>
        </ol>
        <p className="text-gray-600">كل أدمن يشوف منتجاته هو بس.</p>
      </section>

      {isOwner && (
        <>
          <section className="space-y-3 rounded-xl border border-gray-200 p-4">
            <h2 className="font-bold">إعدادات الملف (بتتطبق على كل الأدمن)</h2>
            <form action={saveBotSettings} className="grid gap-3 sm:grid-cols-2">
              <div><label className={ui.label} htmlFor="fixed">زيادة ثابتة على كل منتج (جنيه)</label><input id="fixed" name="fixed" type="number" min={0} defaultValue={st.fixed ?? '0'} className={ui.input} /></div>
              <div><label className={ui.label} htmlFor="markup">زيادة نسبة % (اختياري)</label><input id="markup" name="markup" type="number" step="0.1" defaultValue={st.markup ?? '0'} className={ui.input} /></div>
              <div>
                <label className={ui.label} htmlFor="category">القسم اللي المنتجات هتنزل فيه</label>
                <select id="category" name="category" defaultValue={st.category ?? ''} className={ui.input}>
                  <option value="">بدون قسم</option>
                  {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm sm:mt-6"><input type="checkbox" name="publish" defaultChecked={st.publish === 'yes'} /> انشر مباشرة عند الاستيراد</label>
              <button className={`${ui.btnDark} sm:col-span-2`}>حفظ الإعدادات</button>
            </form>
            <p className="text-xs text-gray-500">سعر البيع في الملف = (السعر الأصلي × (1 + النسبة)) + الزيادة الثابتة. السعر الأصلي يتسجل كتكلفة خاصة.</p>
          </section>

          <section className="space-y-3 rounded-xl border border-gray-200 p-4">
            <h2 className="font-bold">أدمن البوت (إنت بس اللي تشوفهم)</h2>
            <form action={addBotAdmin} className="flex flex-wrap gap-2">
              <input name="id" inputMode="numeric" dir="ltr" placeholder="رقم تليجرام للأدمن" className={`${ui.input} max-w-xs`} />
              <button className={ui.btnDark}>إضافة</button>
            </form>
            <p className="text-xs text-gray-500">الأدمن يفتح البوت ويكتب /start فيطلعله رقمه، وتكتبه هنا.</p>
            {admins.length === 0 ? <p className="text-sm text-gray-500">مفيش أدمن مضاف.</p> : (
              <ul className="divide-y rounded-lg border border-gray-200 text-sm">
                {admins.map((a) => (
                  <li key={a} className="flex items-center justify-between gap-2 p-2">
                    <span dir="ltr">{a}</span>
                    <form action={removeBotAdmin}><input type="hidden" name="id" value={a} /><button className={ui.btnOutline}>حذف</button></form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {isOwner && (
        <p className="text-sm">
          للجروبات والقنوات الخاصة: <Link href="/admin/telegram-import" className="font-semibold text-brand-600 underline">استيراد من تصدير تليجرام</Link>
        </p>
      )}
    </div>
  );
}
