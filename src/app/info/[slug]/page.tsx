import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

// ⚠️ نصوص أولية عامة. راجعها مع مستشار قانوني وعدّلها بما يناسب نشاطك قبل الإطلاق.
const PAGES: Record<string, { title: string; body: string[] }> = {
  privacy: {
    title: 'سياسة الخصوصية',
    body: [
      'نجمع البيانات اللازمة لإتمام طلباتك فقط: الاسم، البريد الإلكتروني، رقم الهاتف، وعنوان الشحن.',
      'لا نقوم بتخزين بيانات البطاقات البنكية على خوادمنا. أي دفع إلكتروني يتم عبر بوابة دفع خارجية مرخصة.',
      'لا نبيع بياناتك لأطراف ثالثة. نستخدمها فقط لتنفيذ الطلبات والتواصل معك بشأنها.',
      'يمكنك تعديل بياناتك أو عناوينك في أي وقت من صفحة حسابك.',
    ],
  },
  terms: {
    title: 'الشروط والأحكام',
    body: [
      'باستخدامك لموقع Kama Store فإنك توافق على هذه الشروط.',
      'الأسعار المعروضة بالجنيه المصري، وقد تتغير دون إشعار مسبق. السعر المعتمد هو السعر وقت تأكيد الطلب.',
      'نحتفظ بالحق في إلغاء أي طلب في حال عدم توفر المنتج أو وجود خطأ ظاهر في السعر، مع إبلاغك بذلك.',
      'يتحمل العميل مسؤولية صحة بيانات الشحن والتواصل التي يدخلها.',
    ],
  },
  'shipping-returns': {
    title: 'الشحن والاسترجاع',
    body: [
      'الشحن العادي: 60 ج.م (3 – 5 أيام عمل) ويكون مجانًا للطلبات التي تتجاوز قيمتها 1000 ج.م.',
      'الشحن السريع: 120 ج.م (1 – 2 يوم عمل).',
      'الدفع عند الاستلام متاح. يرجى فحص الطلب عند الاستلام.',
      'سياسة الاسترجاع والاستبدال: حدّد مدتها وشروطها هنا قبل الإطلاق.',
    ],
  },
};

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const title = slug === 'contact' ? 'تواصل معنا' : PAGES[slug]?.title;
  return { title: title ?? 'صفحة غير موجودة' };
}

export default async function InfoPage({ params }: Props) {
  const { slug } = await params;

  if (slug === 'contact') {
    const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
    const phone = process.env.NEXT_PUBLIC_CONTACT_PHONE;
    const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_URL;
    return (
      <article className="mx-auto max-w-2xl rounded-xl bg-white p-6 shadow-sm">
        <h1 className="mb-4 text-2xl font-extrabold">تواصل معنا</h1>
        {email || phone || whatsapp ? (
          <ul className="space-y-3 text-gray-700">
            {email && <li>البريد الإلكتروني: <a className="font-semibold text-brand-600" href={`mailto:${email}`} dir="ltr">{email}</a></li>}
            {phone && <li>الهاتف: <a className="font-semibold text-brand-600" href={`tel:${phone}`} dir="ltr">{phone}</a></li>}
            {whatsapp && <li><a className="font-semibold text-brand-600" href={whatsapp} target="_blank" rel="noopener noreferrer">راسلنا على واتساب</a></li>}
          </ul>
        ) : (
          <p className="text-gray-600">لم تُضف بيانات التواصل بعد. أضفها في متغيرات البيئة (NEXT_PUBLIC_CONTACT_EMAIL / PHONE / WHATSAPP_URL).</p>
        )}
      </article>
    );
  }

  const page = PAGES[slug];
  if (!page) notFound();

  return (
    <article className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow-sm">
      <h1 className="mb-4 text-2xl font-extrabold">{page.title}</h1>
      <div className="space-y-3 leading-8 text-gray-700">
        {page.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
    </article>
  );
}
