import type { Profile } from '@/lib/types';

/** صلاحيات الأدمن التي يمنحها المالك. المالك يملكها كلها دائمًا. */
export const PERMISSIONS = [
  { key: 'dashboard', label: 'لوحة الإحصائيات' },
  { key: 'categories', label: 'الأقسام' },
  { key: 'withdraw', label: 'الأرباح والسحب' },
  { key: 'users', label: 'المستخدمون (العملاء)' },
  { key: 'coupons', label: 'أكواد الخصم' },
  { key: 'chat', label: 'الدردشة (الرد على العملاء)' },
  { key: 'temp_password', label: 'باسورد مؤقت' },
  { key: 'delete_user', label: 'حذف المستخدم' },
  { key: 'publishing', label: 'تأكيد دفع نشر المنتجات (10 ج)' },
  { key: 'orders', label: 'الطلبات' },
  { key: 'products', label: 'المنتجات (إضافة وتعديل واستيراد)' },
  { key: 'inventory', label: 'المخزون' },
  { key: 'offers', label: 'العروض' },
  { key: 'reviews', label: 'التقييمات' },
  { key: 'ads', label: 'طلبات الإعلانات' },
  { key: 'telegram_bot', label: 'بوت تليجرام (الوصول)' },
  { key: 'telegram_import', label: 'استيراد من تليجرام' },
  { key: 'sources', label: 'ربط المتاجر' },
  { key: 'settings', label: 'إعدادات التواصل' },
  { key: 'visits', label: 'عدد الزيارات' },
  { key: 'social', label: 'النشر على فيسبوك وانستجرام' },
  { key: 'files', label: 'صفحة الملفات (ملفات تليجرام الجديدة)' },
  { key: 'drafts_edit', label: 'تعديل جماعي للمسودات (قسم / سعر / ماركة / محل)' },
  { key: 'drafts', label: 'صفحة المسودات' },
  { key: 'published', label: 'صفحة المنشور للعلن' },
  { key: 'trash', label: 'صفحة المهملات (الحذف)' },
  { key: 'trash_purge', label: 'الحذف النهائي من الموقع' },
  { key: 'bot_publish', label: 'نشر المنتجات من بوت تليجرام' },
  { key: 'screenshots', label: 'الاسكرينات (صور إثبات الدفع)' },
] as const;

export type Permission = (typeof PERMISSIONS)[number]['key'];

export const PERMISSION_KEYS: string[] = PERMISSIONS.map((p) => p.key);

export const isStaff = (p: Pick<Profile, 'role'> | null | undefined) => p?.role === 'admin' || p?.role === 'owner';

export function hasPermission(p: Pick<Profile, 'role' | 'permissions'> | null | undefined, perm: Permission): boolean {
  if (!p) return false;
  if (p.role === 'owner') return true;
  return p.role === 'admin' && (p.permissions ?? []).includes(perm);
}
