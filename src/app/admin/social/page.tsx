import type { Metadata } from 'next';
import { postSocialNow, retryFailedSocial, setSocialAuto } from '@/app/actions/social';
import { requirePermission } from '@/lib/auth';
import { configuredPlatforms, socialAutoOn } from '@/lib/social';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'النشر على السوشيال' };

const ST: Record<string, string> = { pending: 'في الطابور', sending: 'جاري النشر', sent: 'اتنشر ✅', failed: 'فشل ❌', skipped: 'اتخطّى' };
const PL: Record<string, string> = { facebook: 'فيسبوك', instagram: 'انستجرام' };

export default async function SocialPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requirePermission('social');
  const sp = await searchParams;
  const platforms = configuredPlatforms();
  let on = false;
  type Row = { id: string; platform: string; status: string; error: string | null; created_at: string; posted_at: string | null; products: { name: string } | null };
  let rows: Row[] = [];
  let missing = false;
  if (hasServiceRole) {
    const db = createAdminClient();
    on = await socialAutoOn(db);
    const { data, error } = await db.from('social_posts').select('id,platform,status,error,created_at,posted_at,products(name)').order('created_at', { ascending: false }).limit(100);
    missing = Boolean(error);
    rows = (data ?? []) as unknown as Row[];
  }
  const count = (s: string) => rows.filter((r) => r.status === s).length;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">📣 النشر التلقائي على فيسبوك وانستجرام</h1>
      {sp.msg && <p className={ui.alertOk}>{sp.msg}</p>}
      {missing && <p className={ui.alertError}>شغّل ملف supabase/migrations/023_social_posts.sql في Supabase.</p>}
      {!hasServiceRole && <p className={ui.alertError}>يلزم إعداد SUPABASE_SERVICE_ROLE_KEY في Vercel.</p>}

      <section className={`${ui.card} space-y-2 p-4 text-sm`}>
        <h2 className="font-bold">الحسابات المربوطة</h2>
        <p>فيسبوك: {platforms.includes('facebook') ? <b className="text-green-700">مربوط ✓</b> : <span className="text-red-600">مش مربوط (ناقص META_PAGE_ID أو META_PAGE_TOKEN)</span>}</p>
        <p>انستجرام: {platforms.includes('instagram') ? <b className="text-green-700">مربوط ✓</b> : <span className="text-red-600">مش مربوط (ناقص META_IG_USER_ID أو META_PAGE_TOKEN)</span>}</p>
        <p className="text-gray-600">تيك توك: لسه مش متاح (محتاج موافقة من تيك توك بتاخد أسابيع).</p>
      </section>

      <section className={`${ui.card} space-y-3 p-4`}>
        <p className="text-sm">النشر التلقائي: {on ? <b className="text-green-700">شغّال</b> : <b className="text-gray-500">مقفول</b>}</p>
        <form action={setSocialAuto} className="flex flex-wrap gap-2">
          <button name="on" value={on ? '0' : '1'} className={on ? ui.btnOutline : ui.btnPrimary}>{on ? 'إيقاف النشر التلقائي' : 'تشغيل النشر التلقائي'}</button>
        </form>
        <div className="flex flex-wrap gap-2">
          <form action={postSocialNow}><button className={ui.btnOutline}>انشر دفعة دلوقتي</button></form>
          {count('failed') > 0 && <form action={retryFailedSocial}><button className={ui.btnOutline}>إعادة محاولة الفاشل ({count('failed')})</button></form>}
        </div>
        <p className="text-xs text-gray-500">أي منتج بيتنشر للعلن بيدخل الطابور، وبيتنشر على السوشيال بمعدل 2 لكل منصة في كل دفعة (حد انستجرام 100 منشور في اليوم). الدفعة بتتنفّذ تلقائي من cron-job.org على الرابط /api/cron/social كل 30 دقيقة، أو بزرار «انشر دفعة دلوقتي».</p>
      </section>

      <p className="text-sm text-gray-600">في الطابور: {count('pending')} · اتنشر: {count('sent')} · فشل: {count('failed')}</p>
      {rows.length > 0 && (
        <table className="w-full">
          <thead><tr className="border-b border-gray-200"><th className={ui.th}>المنتج</th><th className={ui.th}>المنصة</th><th className={ui.th}>الحالة</th><th className={ui.th}>ملاحظة</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-gray-100">
                <td className={ui.td}>{r.products?.name}</td>
                <td className={ui.td}>{PL[r.platform] ?? r.platform}</td>
                <td className={ui.td}>{ST[r.status] ?? r.status}</td>
                <td className={`${ui.td} text-xs text-red-600`}>{r.error}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
