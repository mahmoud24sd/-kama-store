import Link from 'next/link';
import { Facebook, Instagram, Mail, MessageCircle, Phone } from 'lucide-react';
import Logo from './Logo';

export default function Footer() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  const phone = process.env.NEXT_PUBLIC_CONTACT_PHONE;
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_URL;
  const facebook = process.env.NEXT_PUBLIC_FACEBOOK_URL;
  const instagram = process.env.NEXT_PUBLIC_INSTAGRAM_URL;
  const hasContact = Boolean(email || phone || whatsapp || facebook || instagram);

  return (
    <footer className="mt-10 text-sm text-gray-300">
      <a href="#top" className="block bg-brand-800 py-3 text-center text-white hover:bg-brand-700">
        العودة للأعلى
      </a>
      <div className="bg-brand-900">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo className="text-white" />
            <p className="mt-3 leading-7 text-gray-400">متجر إلكتروني لكل احتياجاتك. منتجات متنوعة وشحن موثوق ودعم عملاء حقيقي.</p>
          </div>

          <div>
            <h3 className="mb-3 font-bold text-white">تسوق</h3>
            <ul className="space-y-2">
              <li><Link href="/products" className="hover:text-white">كل المنتجات</Link></li>
              <li><Link href="/products?deals=1" className="hover:text-white">عروض اليوم</Link></li>
              <li><Link href="/products?sort=best" className="hover:text-white">الأكثر مبيعًا</Link></li>
              <li><Link href="/products?sort=newest" className="hover:text-white">وصل حديثًا</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 font-bold text-white">خدمة العملاء</h3>
            <ul className="space-y-2">
              <li><Link href="/account/orders" className="hover:text-white">تتبع طلباتي</Link></li>
              <li><Link href="/info/shipping-returns" className="hover:text-white">الشحن والاسترجاع</Link></li>
              <li><Link href="/info/privacy" className="hover:text-white">سياسة الخصوصية</Link></li>
              <li><Link href="/info/terms" className="hover:text-white">الشروط والأحكام</Link></li>
              <li><Link href="/info/contact" className="hover:text-white">تواصل معنا</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 font-bold text-white">تواصل معنا</h3>
            {hasContact ? (
              <ul className="space-y-2">
                {email && (
                  <li>
                    <a href={`mailto:${email}`} className="flex items-center gap-2 hover:text-white">
                      <Mail className="h-4 w-4" /> <span dir="ltr">{email}</span>
                    </a>
                  </li>
                )}
                {phone && (
                  <li>
                    <a href={`tel:${phone}`} className="flex items-center gap-2 hover:text-white">
                      <Phone className="h-4 w-4" /> <span dir="ltr">{phone}</span>
                    </a>
                  </li>
                )}
                {whatsapp && (
                  <li>
                    <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white">
                      <MessageCircle className="h-4 w-4" /> واتساب
                    </a>
                  </li>
                )}
                {facebook && (
                  <li>
                    <a href={facebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white">
                      <Facebook className="h-4 w-4" /> فيسبوك
                    </a>
                  </li>
                )}
                {instagram && (
                  <li>
                    <a href={instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white">
                      <Instagram className="h-4 w-4" /> إنستجرام
                    </a>
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-gray-400">أضف بيانات التواصل في ملف البيئة لتظهر هنا.</p>
            )}
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Kama Store. جميع الحقوق محفوظة.
        </div>
      </div>
    </footer>
  );
}
