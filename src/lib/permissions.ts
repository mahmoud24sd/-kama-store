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
] as const;

export type Permission = (typeof PERMISSIONS)[number]['key'];

export const PERMISSION_KEYS: string[] = PERMISSIONS.map((p) => p.key);

export const isStaff = (p: Pick<Profile, 'role'> | null | undefined) => p?.role === 'admin' || p?.role === 'owner';

export function hasPermission(p: Pick<Profile, 'role' | 'permissions'> | null | undefined, perm: Permission): boolean {
  if (!p) return false;
  if (p.role === 'owner') return true;
  return p.role === 'admin' && (p.permissions ?? []).includes(perm);
}
