import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { getBotInfo } from '@/lib/telegramBot';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'بوت تليجرام' };
export const dynamic = 'force-dynamic';

export default async function TelegramBotPage() {
  const { profile } = await requireAdmin();
  const bot = await getBotInfo();
  const isOwner = profile.role === 'owner';

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold">بوت تليجرام</h1>

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
        <h2 className="font-bold">الأوامر</h2>
        <ul className="list-disc space-y-1 pr-5" dir="rtl">
          <li><b dir="ltr">/channel رابط_القناة 30</b>: يسحب منتجات آخر 30 يوم من قناة عامة.</li>
          <li><b dir="ltr">/add 50</b>: يزود 50 جنيه على كل منتج.</li>
          <li><b dir="ltr">/category اسم_القسم</b>: القسم اللي هتنزل فيه المنتجات.</li>
          <li><b dir="ltr">/export</b>: يبعتلك ملف إكسل جاهز للاستيراد.</li>
          {isOwner && <li><b dir="ltr">/addadmin رقم</b> و<b dir="ltr">/removeadmin رقم</b> و<b dir="ltr">/admins</b>: إدارة أدمن البوت (للمالك فقط).</li>}
        </ul>
      </section>

      {isOwner && (
        <p className="text-sm">
          للجروبات والقنوات الخاصة: <Link href="/admin/telegram-import" className="font-semibold text-brand-600 underline">استيراد من تصدير تليجرام</Link>
        </p>
      )}
    </div>
  );
}
