import Link from 'next/link';
import { ui } from '@/lib/ui';

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="text-6xl font-extrabold text-brand-800">404</p>
      <h1 className="mt-3 text-xl font-bold">الصفحة غير موجودة</h1>
      <p className="mt-1 text-gray-600">ربما تم نقل الصفحة أو حذفها.</p>
      <Link href="/" className={`${ui.btnPrimary} mt-6`}>
        العودة للرئيسية
      </Link>
    </div>
  );
}
