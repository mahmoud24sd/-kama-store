import type { Metadata, Viewport } from 'next';
import { Cairo } from 'next/font/google';
import './globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import StaffChatNotifier from '@/components/chat/StaffChatNotifier';
import ChatWidget from '@/components/chat/ChatWidget';
import { CartProvider } from '@/components/cart/CartProvider';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getSiteUrl } from '@/lib/site';

const cairo = Cairo({ subsets: ['arabic', 'latin'], variable: '--font-cairo', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: 'Kama Store — تسوق أونلاين', template: '%s | Kama Store' },
  description: 'Kama Store: متجر إلكتروني لكل احتياجاتك بأسعار مميزة وشحن سريع.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // اتجاه RTL. عند إضافة الإنجليزية: اجعل lang و dir ديناميكيين حسب اللغة المختارة
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body id="top" className="min-h-screen font-sans">
        {isSupabaseConfigured ? (
          <CartProvider>
            <Header />
            <main className="mx-auto min-h-[60vh] max-w-7xl px-3 py-4">{children}</main>
            <Footer />
            <ChatWidget />
            <StaffChatNotifier />
          </CartProvider>
        ) : (
          <SetupNotice />
        )}
      </body>
    </html>
  );
}

function SetupNotice() {
  return (
    <div className="mx-auto max-w-xl p-8">
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h1 className="mb-2 text-lg font-bold text-amber-900">Kama Store — الإعداد غير مكتمل</h1>
        <p className="mb-3 text-sm text-amber-900">
          لم يتم العثور على متغيرات البيئة الخاصة بـ Supabase. انسخ <code>.env.example</code> إلى <code>.env.local</code> وأضف
          <code> NEXT_PUBLIC_SUPABASE_URL </code> و <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> ثم أعد تشغيل الخادم.
        </p>
        <p className="text-sm text-amber-900">راجع ملف README.md لخطوات الإعداد الكاملة.</p>
      </div>
    </div>
  );
}
