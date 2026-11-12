import type { Metadata } from 'next';
import FolderCard from '@/components/admin/FolderCard';
import { requirePermission } from '@/lib/auth';
import { loadFolders } from '@/lib/folders';
import { hasPermission } from '@/lib/permissions';
import { getCategories } from '@/lib/queries';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'الملفات' };

export default async function FilesPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { supabase, profile } = await requirePermission('files');
  const sp = await searchParams;
  const canPublish = (['products', 'bot_publish', 'published'] as const).some((k) => hasPermission(profile, k));
  const canTrash = (['products', 'files'] as const).some((k) => hasPermission(profile, k));
  const canEdit = (['drafts_edit', 'products'] as const).some((k) => hasPermission(profile, k));
  const [{ folders }, cats] = await Promise.all([loadFolders(supabase, 'inbox'), getCategories()]);

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold">📁 الملفات الجديدة</h1>
      <p className="text-sm text-gray-600">كل ملف جاي من بوت تليجرام بيظهر كفولدر. افتحه تشوف المنتجات، عدّل القسم والسعر، وقرّر: يروح للمسودة، أو للعلن، أو يتحذف.</p>
      {sp.msg && <p className={ui.alertOk}>{sp.msg}</p>}
      {folders.length === 0 ? (
        <p className="py-8 text-center text-gray-500">مفيش ملفات جديدة.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {folders.map((f) => <FolderCard key={f.id} f={f} back="/admin/files" cats={cats} canEdit={canEdit} canPublish={canPublish} canDraft canTrash={canTrash} />)}
        </div>
      )}
    </div>
  );
}
