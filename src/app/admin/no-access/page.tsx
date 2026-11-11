import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';

export const metadata: Metadata = { title: 'لا توجد صلاحية' };

export default async function NoAccess() {
  await requireAdmin();
  return (
    <div className="rounded-xl border border-gray-200 p-6 text-center">
      <h1 className="text-lg font-extrabold">ليس لديك صلاحية لهذه الصفحة</h1>
      <p className="mt-2 text-sm text-gray-600">اختر من القائمة صفحة متاحة لك. لو محتاج صلاحية إضافية اطلبها من المالك.</p>
    </div>
  );
}
