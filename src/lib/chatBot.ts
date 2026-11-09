import { EXPRESS_FEE, FREE_SHIPPING_THRESHOLD, STANDARD_FEE } from '@/lib/shipping';

export type BotAnswer = { text: string; link?: { href: string; label: string } };

type Topic = { id: string; label: string; keywords: string[]; answer: BotAnswer };

/** ردود آلية مبنية على معلومات المتجر المعروفة فقط. أي سؤال غير مغطى يُحوَّل لشخص. */
export const TOPICS: Topic[] = [
  {
    id: 'shipping',
    label: 'الشحن والتوصيل',
    keywords: ['شحن', 'توصيل', 'مصاريف', 'مصروفات', 'delivery', 'shipping', 'ياخد كام', 'يوصل'],
    answer: {
      text: `الشحن العادي ${STANDARD_FEE} ج.م (3 – 5 أيام عمل) ومجاني للطلبات فوق ${FREE_SHIPPING_THRESHOLD} ج.م. الشحن السريع ${EXPRESS_FEE} ج.م (1 – 2 يوم عمل).`,
      link: { href: '/info/shipping-returns', label: 'تفاصيل الشحن' },
    },
  },
  {
    id: 'payment',
    label: 'طرق الدفع',
    keywords: ['دفع', 'كاش', 'استلام', 'فيزا', 'بطاقة', 'كارت', 'payment', 'pay'],
    answer: { text: 'المتاح حاليًا هو الدفع عند الاستلام. الدفع بالبطاقة غير متاح الآن.' },
  },
  {
    id: 'track',
    label: 'متابعة طلبي',
    keywords: ['طلبي', 'طلب', 'تتبع', 'وصل', 'فين', 'order', 'track'],
    answer: {
      text: 'تقدر تتابع مراحل طلبك وتأكيد التسليم من صفحة «طلباتي» بعد تسجيل الدخول.',
      link: { href: '/account/orders', label: 'طلباتي' },
    },
  },
  {
    id: 'sell',
    label: 'نشر منتج عندنا',
    keywords: ['انشر', 'نشر', 'ابيع', 'بيع', 'بايع', 'تاجر', 'منتجي', 'sell'],
    answer: {
      text: 'تقدر تنشر منتجك في المتجر برسم بسيط يُدفع عبر InstaPay أو محفظة. ابدأ من صفحة «انشر منتجك».',
      link: { href: '/sell', label: 'انشر منتجك' },
    },
  },
  {
    id: 'account',
    label: 'الحساب وكلمة المرور',
    keywords: ['حساب', 'تسجيل', 'باسورد', 'كلمة المرور', 'نسيت', 'دخول', 'password', 'login'],
    answer: {
      text: 'لو نسيت كلمة المرور اضغط «نسيت كلمة المرور؟» في صفحة الدخول، ولو واجهتك مشكلة في الحساب اضغط «تحدث مع شخص».',
      link: { href: '/auth/forgot', label: 'استعادة كلمة المرور' },
    },
  },
];

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ً-ٟ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');

/** يعيد أفضل موضوع مطابق، أو null لو لم يفهم السؤال */
export function matchTopic(input: string): Topic | null {
  const q = normalize(input);
  let best: { t: Topic; score: number } | null = null;
  for (const t of TOPICS) {
    const score = t.keywords.reduce((n, k) => (q.includes(normalize(k)) ? n + 1 : n), 0);
    if (score > 0 && (!best || score > best.score)) best = { t, score };
  }
  return best?.t ?? null;
}

export const WANTS_HUMAN = ['شخص', 'موظف', 'خدمه العملاء', 'خدمة العملاء', 'بني ادم', 'انسان', 'حد يكلمني', 'اكلم حد', 'human', 'agent'];

export const wantsHuman = (input: string) => WANTS_HUMAN.some((k) => normalize(input).includes(normalize(k)));
