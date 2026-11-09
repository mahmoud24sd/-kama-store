import type { Metadata } from 'next';
import Link from 'next/link';
import ImportForm from '@/components/admin/ImportForm';
import { requireAdmin } from '@/lib/auth';

export const metadata: Metadata = { title: 'استيراد منتجات' };

export default async function ImportPage() {
  await requireAdmin();
  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">استيراد منتجات بالجملة (حتى 500 منتج)</h1>
        <Link href="/admin/products" className="text-sm text-brand-600 hover:underline">← المنتجات</Link>
      </div>
      <ol className="list-decimal space-y-2 pe-5 text-sm leading-7">
        <li>افتح Excel أو Google Sheets، واكتب في الصف الأول أسماء الأعمدة (أو حمّل <a href="/admin/products/template" className="font-bold text-brand-600 underline">القالب الجاهز</a> وافتحه فيهم).</li>
        <li>املأ صفًّا لكل منتج. الأعمدة المطلوبة <b>name</b> و <b>price</b>، والباقي اختياري.</li>
        <li><b>category</b> اكتب اسم القسم كما هو في صفحة الأقسام (أنشئ الأقسام أولًا).</li>
        <li><b>image_urls</b> روابط الصور تبدأ بـ https وتفصل بينها بالعلامة | (حتى 6 صور). ارفع صورك على أي موقع استضافة صور أولًا وانسخ الروابط.</li>
        <li><b>publish</b> اكتب yes ليظهر المنتج في المتجر، أو اتركه فارغًا ليُحفظ كمسودة.</li>
        <li><b>بدون ملف:</b> حدّد الجدول كله (مع صف العناوين) وانسخه، ثم الصقه في الخانة أدناه واضغط «استيراد». الصفوف الخاطئة تُتجاهل ويظهر لك سبب كل واحد منها.</li>
      </ol>
      <ImportForm />
    </div>
  );
}
