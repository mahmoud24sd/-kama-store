// طبقة نصوص بسيطة. لإضافة الإنجليزية لاحقًا:
// 1) أضف كائن `en` بنفس المفاتيح  2) اختر اللغة من cookie أو مسار /en
// 3) غيّر dir في src/app/layout.tsx حسب اللغة.
export const ar = {
  brand: 'Kama Store',
  announce: 'شحن مجاني للطلبات فوق 1000 ج.م · الدفع عند الاستلام متاح',
  search_placeholder: 'ابحث عن منتج، علامة تجارية، أو قسم...',
  search: 'بحث',
  all_categories: 'كل الأقسام',
  account: 'حسابي',
  login: 'تسجيل الدخول',
  register: 'إنشاء حساب',
  logout: 'تسجيل الخروج',
  favorites: 'المفضلة',
  cart: 'السلة',
  orders: 'طلباتي',
  add_to_cart: 'أضف إلى السلة',
  buy_now: 'اشترِ الآن',
  out_of_stock: 'غير متوفر',
  in_stock: 'متوفر',
  best_sellers: 'الأكثر مبيعًا',
  todays_deals: 'عروض اليوم',
  recommended: 'منتجات مقترحة',
  new_arrivals: 'وصل حديثًا',
  brands: 'تسوق حسب العلامة التجارية',
  view_all: 'عرض الكل',
  currency: 'ج.م',
} as const;

export type MessageKey = keyof typeof ar;
export const t = (key: MessageKey): string => ar[key];
