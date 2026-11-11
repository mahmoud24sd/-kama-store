import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContactSettings, whatsappLink } from '@/lib/settings';

// ⚠️ نصوص أولية عامة. راجعها مع مستشار قانوني وعدّلها بما يناسب نشاطك قبل الإطلاق.
const PAGES: Record<string, { title: string; body: string[] }> = {
  privacy: {
    title: 'سياسة الخصوصية',
    body: [
      'نجمع البيانات اللازمة لإتمام طلباتك فقط: الاسم، البريد الإلكتروني، رقم الهاتف، المحافظة، وعنوان الشحن.',
      'رقم هاتفك يُستخدم للتواصل بشأن الطلب، ولإرسال رمز استعادة كلمة المرور على واتساب عند طلبك ذلك.',
      'لا نقوم بتخزين بيانات البطاقات البنكية على خوادمنا. أي دفع إلكتروني يتم عبر بوابة دفع خارجية مرخصة.',
      'لا نبيع بياناتك لأطراف ثالثة. نشارك الحد الأدنى (الاسم والعنوان والهاتف) مع شركة الشحن لتوصيل طلبك فقط.',
      'نستخدم ملفات تعريف الارتباط الضرورية لتسجيل الدخول وسلة التسوق، وعدّادًا مجهولًا لعدد الزيارات.',
      'يمكنك تعديل بياناتك أو عناوينك من صفحة حسابك، أو طلب حذف حسابك بالتواصل معنا عبر صفحة «تواصل معنا».',
    ],
  },
  terms: {
    title: 'الشروط والأحكام',
    body: [
      'باستخدامك لموقع Kama Store فإنك توافق على هذه الشروط.',
      'الأسعار المعروضة بالجنيه المصري، وقد تتغير دون إشعار مسبق. السعر المعتمد هو السعر وقت تأكيد الطلب.',
      'نحتفظ بالحق في إلغاء أي طلب في حال عدم توفر المنتج أو وجود خطأ ظاهر في السعر، مع إبلاغك بذلك واسترداد أي مبلغ مدفوع.',
      'يتحمل العميل مسؤولية صحة بيانات الشحن والتواصل التي يدخلها، وسرية كلمة مروره ورمز الاستعادة.',
      'البائعون الذين ينشرون منتجاتهم يدفعون رسم نشر ثابتًا لكل منتج، ولا يُنشر المنتج إلا بعد تأكيد الدفع ومراجعته. نحتفظ بحق رفض أو إزالة أي منتج مخالف أو مضلّل أو ممنوع قانونًا.',
      'الإعلانات المدفوعة تخضع لموافقتنا، ولا نضمن نتائج محددة منها.',
      'نحتفظ بالحق في إيقاف أي حساب يسيء استخدام الموقع أو يخالف هذه الشروط.',
    ],
  },
  'shipping-returns': {
    title: 'الشحن والاسترجاع',
    body: [
      'الشحن العادي: 60 ج.م (3 – 5 أيام عمل) ويكون مجانًا للطلبات التي تتجاوز قيمتها 1000 ج.م.',
      'الشحن السريع: 120 ج.م (1 – 2 يوم عمل).',
      'الدفع عند الاستلام متاح. يرجى فحص الطلب بحضور المندوب عند الاستلام.',
      'الاسترجاع والاستبدال: يحق لك طلب الاسترجاع أو الاستبدال خلال 14 يومًا من تاريخ الاستلام، بشرط أن يكون المنتج بحالته الأصلية وغير مستعمل وبعبوته.',
      'لا يشمل الاسترجاع المنتجات القابلة للتلف أو الاستخدام الشخصي المغلقة التي فُتحت (مثل مستحضرات التجميل والملابس الداخلية).',
      'في حال وصول منتج تالف أو مختلف عن طلبك، تواصل معنا خلال 48 ساعة من الاستلام وسنستبدله أو نسترد قيمته دون تكلفة إضافية.',
      'يُرد المبلغ بنفس وسيلة الدفع أو عبر InstaPay خلال 3 – 7 أيام عمل من استلام المرتجع وفحصه. مصاريف الشحن العادية غير مستردة إلا إذا كان الخطأ منا.',
      'لطلب استرجاع: تواصل معنا من صفحة «تواصل معنا» برقم الطلب.',
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
    const c = await getContactSettings();
    const wa = c.whatsapp ? whatsappLink(c.whatsapp) : '';
    const has = Boolean(c.email || c.phone || wa || c.facebook || c.instagram || c.tiktok);
    return (
      <article className="mx-auto max-w-2xl rounded-xl bg-white p-6 shadow-sm">
        <h1 className="mb-4 text-2xl font-extrabold">تواصل معنا</h1>
        {has ? (
          <ul className="space-y-3 text-gray-700">
            {c.phone && <li>الهاتف: <a className="font-semibold text-brand-600" href={`tel:${c.phone}`} dir="ltr">{c.phone}</a></li>}
            {wa && <li><a className="font-semibold text-brand-600" href={wa} target="_blank" rel="noopener noreferrer">راسلنا على واتساب</a></li>}
            {c.email && <li>البريد الإلكتروني: <a className="font-semibold text-brand-600" href={`mailto:${c.email}`} dir="ltr">{c.email}</a></li>}
            {c.facebook && <li><a className="font-semibold text-brand-600" href={c.facebook} target="_blank" rel="noopener noreferrer">صفحتنا على فيسبوك</a></li>}
            {c.instagram && <li><a className="font-semibold text-brand-600" href={c.instagram} target="_blank" rel="noopener noreferrer">حسابنا على إنستجرام</a></li>}
            {c.tiktok && <li><a className="font-semibold text-brand-600" href={c.tiktok} target="_blank" rel="noopener noreferrer">حسابنا على تيك توك</a></li>}
          </ul>
        ) : (
          <p className="text-gray-600">سيتم إضافة بيانات التواصل قريبًا.</p>
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
